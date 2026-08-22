import {createReadStream,existsSync} from "node:fs";
import {stat} from "node:fs/promises";
import path from "node:path";

const BILLING_STATUSES=new Set(["Not Set","Active","Pending","Paid","Due","Overdue","Suspended"]);
const clean=(value="",limit=5000)=>String(value??"").replace(/[<>]/g,"").trim().slice(0,limit);
const positive=(value,fallback,max=100)=>{const number=Number.parseInt(value,10);return Number.isFinite(number)&&number>0?Math.min(number,max):fallback};
const indiaDate=()=>{const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).filter(part=>part.type!=="literal").map(part=>[part.type,part.value]));return`${parts.year}-${parts.month}-${parts.day}`};
const expiryStatus=(expiry,today=indiaDate())=>{if(!expiry)return"No Expiry";const days=Math.round((Date.parse(`${expiry}T00:00:00Z`)-Date.parse(`${today}T00:00:00Z`))/864e5);return days<0?"Expired":days<=10?"Expiring Soon":"Valid"};
const customerSql="u.role='user' AND COALESCE(u.account_kind,'customer')='customer'";

export function createVehicleAdminApi({db,root,currentUser,admin,json}){
 const store=path.join(root,"data","private-vehicle-documents");
 db.exec(`CREATE TABLE IF NOT EXISTS vehicle_customer_billing(
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT DEFAULT '',
  billing_cycle TEXT DEFAULT '',
  amount REAL NOT NULL DEFAULT 0 CHECK(amount>=0),
  billing_status TEXT NOT NULL DEFAULT 'Not Set' CHECK(billing_status IN ('Not Set','Active','Pending','Paid','Due','Overdue','Suspended')),
  next_billing_date TEXT,
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
 ); CREATE INDEX IF NOT EXISTS idx_vehicle_billing_status ON vehicle_customer_billing(billing_status);`);
 const billingColumns=new Set(db.prepare("PRAGMA table_info(vehicle_customer_billing)").all().map(column=>column.name));if(!billingColumns.has("due_date"))db.exec("ALTER TABLE vehicle_customer_billing ADD COLUMN due_date TEXT");

 const read=async req=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);return JSON.parse(Buffer.concat(chunks).toString()||"{}")};
 const customer=id=>db.prepare(`SELECT u.id,u.name,u.organization_name,u.email,u.mobile,u.active,u.created_at,u.last_login_at,u.force_password_reset,b.plan,b.billing_cycle,b.amount,COALESCE(b.billing_status,'Not Set') billing_status,b.next_billing_date,b.due_date,b.notes billing_notes FROM users u LEFT JOIN vehicle_customer_billing b ON b.user_id=u.id WHERE u.id=? AND ${customerSql}`).get(id);
 const requireCustomer=(res,id)=>{const row=customer(id);if(!row){json(res,404,{error:"Vehicle Portal customer not found"});return null}return row};
 const storageFor=userId=>db.prepare(`SELECT
  COUNT(DISTINCT CASE WHEN d.deleted_at IS NULL THEN d.id END) total_documents,
  COUNT(DISTINCT CASE WHEN d.deleted_at IS NULL AND x.is_active=1 AND x.deleted_at IS NULL THEN d.id END) active_documents,
  SUM(CASE WHEN d.deleted_at IS NOT NULL OR x.is_active=0 OR x.deleted_at IS NOT NULL THEN 1 ELSE 0 END) archived_versions,
  COALESCE(SUM(x.file_size),0) total_storage_bytes,
  COALESCE(SUM(CASE WHEN d.deleted_at IS NULL AND x.is_active=1 AND x.deleted_at IS NULL THEN x.file_size ELSE 0 END),0) active_storage_bytes,
  COALESCE(SUM(CASE WHEN d.deleted_at IS NOT NULL OR x.is_active=0 OR x.deleted_at IS NOT NULL THEN x.file_size ELSE 0 END),0) archived_storage_bytes
  FROM vehicles v LEFT JOIN vehicle_documents d ON d.vehicle_id=v.id LEFT JOIN document_versions x ON x.document_id=d.id WHERE v.user_id=?`).get(userId);
 const vehicleCounts=userId=>db.prepare(`SELECT COUNT(*) total_vehicles,SUM(CASE WHEN type='Car' THEN 1 ELSE 0 END) cars,SUM(CASE WHEN type='Bike' THEN 1 ELSE 0 END) bikes,SUM(CASE WHEN type='Other' OR type IS NULL OR type='' THEN 1 ELSE 0 END) other FROM vehicles WHERE user_id=?`).get(userId);
 const summary=()=>{
  const base=db.prepare(`SELECT
   COUNT(*) total_users,
   SUM(CASE WHEN active=1 THEN 1 ELSE 0 END) active_users,
   SUM(CASE WHEN active=0 THEN 1 ELSE 0 END) disabled_users
   FROM users u WHERE ${customerSql}`).get();
  const usage=db.prepare(`SELECT
   (SELECT COUNT(*) FROM vehicles v JOIN users u ON u.id=v.user_id WHERE ${customerSql}) total_vehicles,
   (SELECT COUNT(*) FROM vehicle_documents d JOIN vehicles v ON v.id=d.vehicle_id JOIN users u ON u.id=v.user_id WHERE d.deleted_at IS NULL AND ${customerSql}) total_documents,
   (SELECT COALESCE(SUM(x.file_size),0) FROM document_versions x JOIN vehicle_documents d ON d.id=x.document_id JOIN vehicles v ON v.id=d.vehicle_id JOIN users u ON u.id=v.user_id WHERE ${customerSql}) total_storage_bytes,
   (SELECT COUNT(*) FROM users m JOIN users o ON o.id=m.created_by_user_id WHERE m.account_kind='managed' AND ${customerSql.replaceAll('u.','o.')}) total_organization_users`).get();
  const today=indiaDate(),expiryRows=db.prepare(`SELECT d.expiry_date FROM vehicle_documents d JOIN vehicles v ON v.id=d.vehicle_id JOIN users u ON u.id=v.user_id WHERE d.deleted_at IS NULL AND d.expiry_date IS NOT NULL AND d.expiry_date<>'' AND ${customerSql}`).all();
  let expired_documents=0,expiring_soon=0;for(const row of expiryRows){const status=expiryStatus(row.expiry_date,today);if(status==="Expired")expired_documents++;else if(status==="Expiring Soon")expiring_soon++}
  return{totalOrganizations:Number(base.total_users||0),activeOrganizations:Number(base.active_users||0),disabledOrganizations:Number(base.disabled_users||0),totalVehicles:Number(usage.total_vehicles||0),totalDocuments:Number(usage.total_documents||0),totalStorageBytes:Number(usage.total_storage_bytes||0),totalOrganizationUsers:Number(usage.total_organization_users||0),expiredDocuments:expired_documents,expiringSoon:expiring_soon};
 };

 const customerList=url=>{
  const page=positive(url.searchParams.get("page"),1,1e9),pageSize=positive(url.searchParams.get("pageSize"),20,100),query=clean(url.searchParams.get("q"),160).toLowerCase(),status=clean(url.searchParams.get("status"),20),billingStatus=clean(url.searchParams.get("billingStatus"),20);
  const where=[customerSql],args=[];
  if(query){where.push("(LOWER(u.organization_name) LIKE ? OR LOWER(u.name) LIKE ? OR LOWER(u.email) LIKE ? OR EXISTS(SELECT 1 FROM vehicles qv WHERE qv.user_id=u.id AND LOWER(qv.vehicle_number) LIKE ?))");const like=`%${query}%`;args.push(like,like,like,like)}
  if(status==="active")where.push("u.active=1");else if(status==="disabled")where.push("u.active=0");
  if(BILLING_STATUSES.has(billingStatus))where.push("COALESCE(b.billing_status,'Not Set')=?"),args.push(billingStatus);
  const clause=where.join(" AND "),total=Number(db.prepare(`SELECT COUNT(*) n FROM users u LEFT JOIN vehicle_customer_billing b ON b.user_id=u.id WHERE ${clause}`).get(...args).n);
  const rows=db.prepare(`SELECT u.id,u.name,u.organization_name,u.email,u.active,u.created_at,u.last_login_at,b.plan,COALESCE(b.billing_status,'Not Set') billing_status,
   (SELECT COUNT(*) FROM vehicles v WHERE v.user_id=u.id) total_vehicles,
   (SELECT COUNT(*) FROM vehicles v WHERE v.user_id=u.id AND v.type='Car') cars,
   (SELECT COUNT(*) FROM vehicles v WHERE v.user_id=u.id AND v.type='Bike') bikes,
   (SELECT COUNT(*) FROM vehicles v WHERE v.user_id=u.id AND (v.type='Other' OR v.type IS NULL OR v.type='')) other,
   (SELECT COUNT(*) FROM vehicle_documents d JOIN vehicles v ON v.id=d.vehicle_id WHERE v.user_id=u.id AND d.deleted_at IS NULL) documents,
   (SELECT COALESCE(SUM(x.file_size),0) FROM document_versions x JOIN vehicle_documents d ON d.id=x.document_id JOIN vehicles v ON v.id=d.vehicle_id WHERE v.user_id=u.id) storage_bytes,
   (SELECT COUNT(*) FROM users m WHERE m.created_by_user_id=u.id AND m.account_kind='managed') organization_users
   FROM users u LEFT JOIN vehicle_customer_billing b ON b.user_id=u.id WHERE ${clause} ORDER BY u.created_at DESC,u.id DESC LIMIT ? OFFSET ?`).all(...args,pageSize,(page-1)*pageSize);
  return{summary:summary(),items:rows,page,pageSize,total,totalPages:Math.ceil(total/pageSize)};
 };

 const customerDetail=(userId,url)=>{
  const user=customer(userId),vehiclePage=positive(url.searchParams.get("vehiclePage"),1,1e9),documentPage=positive(url.searchParams.get("documentPage"),1,1e9),pageSize=positive(url.searchParams.get("pageSize"),20,100),today=indiaDate();
  const counts=vehicleCounts(userId),storage=storageFor(userId);
  const locations=db.prepare("SELECT l.id,l.name,COUNT(v.id) vehicle_count FROM vehicle_locations l LEFT JOIN vehicles v ON v.location_id=l.id AND v.user_id=l.user_id WHERE l.user_id=? GROUP BY l.id ORDER BY l.name COLLATE NOCASE").all(userId);
  const sharing=db.prepare(`SELECT s.id,l.name location_name,g.name grantee_name,g.email grantee_email,s.permission,s.scope,CASE WHEN s.scope='selected' THEN COUNT(DISTINCT a.vehicle_id) ELSE COUNT(DISTINCT v.id) END vehicle_count FROM location_shares s JOIN vehicle_locations l ON l.id=s.location_id JOIN users g ON g.id=s.grantee_user_id LEFT JOIN shared_vehicle_assignments a ON a.share_id=s.id LEFT JOIN vehicles v ON v.user_id=s.owner_user_id AND v.location_id=s.location_id WHERE s.owner_user_id=? GROUP BY s.id ORDER BY l.name,g.name`).all(userId);
  const organizationUsers=db.prepare(`SELECT m.id,m.name,m.email,m.mobile,m.active,m.last_login_at,m.created_at,CASE WHEN MAX(CASE WHEN s.permission='editor' THEN 1 ELSE 0 END)=1 THEN 'ORGANIZATION_EDITOR' ELSE 'ORGANIZATION_VIEWER' END organization_role,COUNT(DISTINCT s.id) share_count FROM users m LEFT JOIN location_shares s ON s.grantee_user_id=m.id AND s.owner_user_id=? WHERE m.created_by_user_id=? AND m.account_kind='managed' GROUP BY m.id ORDER BY m.name COLLATE NOCASE`).all(userId,userId);
  const vehicleTotal=Number(counts.total_vehicles||0),vehicles=db.prepare(`SELECT v.*,l.name location_name,(SELECT COUNT(*) FROM vehicle_documents d WHERE d.vehicle_id=v.id AND d.deleted_at IS NULL) document_count FROM vehicles v LEFT JOIN vehicle_locations l ON l.id=v.location_id AND l.user_id=v.user_id WHERE v.user_id=? ORDER BY v.vehicle_number COLLATE NOCASE LIMIT ? OFFSET ?`).all(userId,pageSize,(vehiclePage-1)*pageSize);
  for(const vehicle of vehicles){const expiries=db.prepare("SELECT expiry_date FROM vehicle_documents WHERE vehicle_id=? AND deleted_at IS NULL").all(vehicle.id).map(row=>row.expiry_date);for(const value of[vehicle.first_party_expiry_date,vehicle.third_party_expiry_date,vehicle.puc_expiry_date])if(value)expiries.push(value);const statuses=expiries.map(value=>expiryStatus(value,today));vehicle.expiry_status=statuses.includes("Expired")?"Expired":statuses.includes("Expiring Soon")?"Expiring Soon":statuses.includes("Valid")?"Valid":statuses.includes("No Expiry")?"No Expiry":"No Documents"}
  const documentTotal=Number(storage.total_documents||0),documents=db.prepare(`SELECT d.id,d.vehicle_id,d.name,d.category,d.expiry_date,d.created_at,v.vehicle_number,x.original_name,x.file_size,x.mime_type FROM vehicle_documents d JOIN vehicles v ON v.id=d.vehicle_id LEFT JOIN document_versions x ON x.document_id=d.id AND x.is_active=1 AND x.deleted_at IS NULL WHERE v.user_id=? AND d.deleted_at IS NULL ORDER BY d.updated_at DESC,d.id DESC LIMIT ? OFFSET ?`).all(userId,pageSize,(documentPage-1)*pageSize).map(document=>({...document,status:expiryStatus(document.expiry_date,today)}));
  const editors=organizationUsers.filter(member=>member.organization_role==='ORGANIZATION_EDITOR').length,viewers=organizationUsers.length-editors;
  return{user,roleModel:{platformAdmin:'PLATFORM_SUPER_ADMIN',organizationAdmin:'ORGANIZATION_ADMIN'},vehicleSummary:{totalVehicles:Number(counts.total_vehicles||0),cars:Number(counts.cars||0),bikes:Number(counts.bikes||0),other:Number(counts.other||0)},storage:{totalDocuments:Number(storage.total_documents||0),activeDocuments:Number(storage.active_documents||0),archivedVersions:Number(storage.archived_versions||0),totalStorageBytes:Number(storage.total_storage_bytes||0),activeStorageBytes:Number(storage.active_storage_bytes||0),archivedStorageBytes:Number(storage.archived_storage_bytes||0)},userSummary:{organizationAdmins:1,driversEmployees:organizationUsers.length,viewers,editors},organizationUsers,locations,sharing,vehicles:{items:vehicles,page:vehiclePage,pageSize,total:vehicleTotal,totalPages:Math.ceil(vehicleTotal/pageSize)},documents:{items:documents,page:documentPage,pageSize,total:documentTotal,totalPages:Math.ceil(documentTotal/pageSize)}};
 };

 async function api(req,res,url){
  if(!url.pathname.startsWith("/api/admin/vehicle-portal"))return false;
  if(!admin(req))return json(res,403,{error:"Administrator access required"});
  if(url.pathname==="/api/admin/vehicle-portal"&&req.method==="GET")return json(res,200,customerList(url));
  const userRoute=url.pathname.match(/^\/api\/admin\/vehicle-portal\/users\/(\d+)$/);
  if(userRoute){const userId=Number(userRoute[1]),user=requireCustomer(res,userId);if(!user)return true;if(req.method==="GET")return json(res,200,customerDetail(userId,url));if(req.method==="PATCH"){
   const actor=currentUser(req),body=await read(req);
   if(typeof body.active==="boolean"){db.prepare("UPDATE users SET active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(body.active?1:0,userId);if(!body.active)db.prepare("DELETE FROM sessions WHERE user_id=?").run(userId)}
   const billing=body.billing;if(billing&&typeof billing==="object"){
    const status=clean(billing.billingStatus,20)||"Not Set",amount=Number(billing.amount||0),nextDate=clean(billing.nextBillingDate,10),dueDate=clean(billing.dueDate,10);
    if(!BILLING_STATUSES.has(status))return json(res,400,{error:"Invalid billing status"});if(!Number.isFinite(amount)||amount<0)return json(res,400,{error:"Billing amount must be zero or greater"});if(nextDate&&!/^\d{4}-\d{2}-\d{2}$/.test(nextDate))return json(res,400,{error:"Next billing date must be a valid date"});if(dueDate&&!/^\d{4}-\d{2}-\d{2}$/.test(dueDate))return json(res,400,{error:"Due date must be a valid date"});
    db.prepare(`INSERT INTO vehicle_customer_billing(user_id,plan,billing_cycle,amount,billing_status,next_billing_date,due_date,notes) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET plan=excluded.plan,billing_cycle=excluded.billing_cycle,amount=excluded.amount,billing_status=excluded.billing_status,next_billing_date=excluded.next_billing_date,due_date=excluded.due_date,notes=excluded.notes,updated_at=CURRENT_TIMESTAMP`).run(userId,clean(billing.plan,80),clean(billing.billingCycle,40),amount,status,nextDate||null,dueDate||null,clean(billing.notes,2000));
   }
   db.prepare("INSERT INTO managed_user_audit(actor_user_id,user_id,action,details) VALUES(?,?,?,?)").run(actor.id,userId,"admin_customer_updated","Vehicle Portal administration");return json(res,200,{ok:true});
  }}
  const vehicleRoute=url.pathname.match(/^\/api\/admin\/vehicle-portal\/users\/(\d+)\/vehicles\/(\d+)$/);
  if(vehicleRoute&&req.method==="GET"){
   const userId=Number(vehicleRoute[1]),vehicleId=Number(vehicleRoute[2]);if(!requireCustomer(res,userId))return true;
   const vehicle=db.prepare("SELECT v.*,l.name location_name FROM vehicles v LEFT JOIN vehicle_locations l ON l.id=v.location_id AND l.user_id=v.user_id WHERE v.id=? AND v.user_id=?").get(vehicleId,userId);if(!vehicle)return json(res,404,{error:"Vehicle not found for this customer"});
   const documents=db.prepare("SELECT d.*,x.id version_id,x.original_name,x.file_size,x.mime_type FROM vehicle_documents d LEFT JOIN document_versions x ON x.document_id=d.id AND x.is_active=1 AND x.deleted_at IS NULL WHERE d.vehicle_id=? AND d.deleted_at IS NULL ORDER BY d.created_at DESC").all(vehicleId);
   for(const document of documents)document.versions=db.prepare("SELECT id,original_name,mime_type,file_size,is_active,deleted_at,created_at FROM document_versions WHERE document_id=? ORDER BY created_at DESC,id DESC").all(document.id);
   return json(res,200,{vehicle,documents});
  }
  const documentRoute=url.pathname.match(/^\/api\/admin\/vehicle-portal\/users\/(\d+)\/documents\/(\d+)\/(view|download)$/);
  if(documentRoute&&req.method==="GET"){
   const userId=Number(documentRoute[1]),documentId=Number(documentRoute[2]),mode=documentRoute[3];if(!requireCustomer(res,userId))return true;
   const version=db.prepare("SELECT x.* FROM document_versions x JOIN vehicle_documents d ON d.id=x.document_id JOIN vehicles v ON v.id=d.vehicle_id WHERE x.document_id=? AND v.user_id=? AND d.deleted_at IS NULL AND x.is_active=1 AND x.deleted_at IS NULL").get(documentId,userId),file=version&&path.join(store,path.basename(version.stored_name));if(!version||!existsSync(file))return json(res,404,{error:"Document file not found"});
   res.writeHead(200,{"Content-Type":version.mime_type,"Content-Length":(await stat(file)).size,"Content-Disposition":`${mode==="view"?"inline":"attachment"}; filename*=UTF-8''${encodeURIComponent(version.original_name)}`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"});return createReadStream(file).pipe(res);
  }
  return json(res,404,{error:"Admin Vehicle Portal endpoint not found"});
 }
 return api;
}
