export const INDIA_TIME_ZONE="Asia/Kolkata";
export const REMINDER_DAYS=Object.freeze([10,5,1,0]);

const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
const safeError=error=>String(error?.message||error||"Unknown SMTP error").replace(/[\r\n]+/g," ").slice(0,500);
const tableExists=(db,name)=>Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));

export function indiaDate(now=new Date()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:INDIA_TIME_ZONE,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now).filter(part=>part.type!=="literal").map(part=>[part.type,part.value]));
 return`${parts.year}-${parts.month}-${parts.day}`;
}

export function daysUntil(expiryDate,today){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(expiryDate||""))||!/^\d{4}-\d{2}-\d{2}$/.test(String(today||"")))return null;
 const expiry=Date.parse(`${expiryDate}T00:00:00Z`),start=Date.parse(`${today}T00:00:00Z`);
 if(!Number.isFinite(expiry)||!Number.isFinite(start))return null;
 return Math.round((expiry-start)/864e5);
}

export function ensureReminderSchema(db){
 db.exec(`CREATE TABLE IF NOT EXISTS email_reminder_deliveries(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  document_id INTEGER REFERENCES vehicle_documents(id) ON DELETE CASCADE,
  source_key TEXT NOT NULL,
  reminder_type TEXT NOT NULL,
  expiry_date TEXT NOT NULL,
  reminder_days INTEGER NOT NULL,
  scheduled_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT,
  sent_at TEXT,
  provider_message_id TEXT,
  failure_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(recipient_user_id,vehicle_id,source_key,expiry_date,reminder_days)
 );
 CREATE INDEX IF NOT EXISTS idx_email_reminders_status ON email_reminder_deliveries(status,scheduled_date);
 CREATE INDEX IF NOT EXISTS idx_email_reminders_vehicle ON email_reminder_deliveries(owner_user_id,vehicle_id,created_at DESC);`);
}

function vehicleExpiryItems(db,documentSources=new Set()){
 const vehicles=db.prepare(`SELECT v.id vehicle_id,v.user_id owner_user_id,v.vehicle_number,v.vehicle_name,v.brand,v.make,v.model,v.location_id,
  v.registration_status,v.temporary_registration_expiry,v.first_party_expiry_date,v.third_party_expiry_date,v.puc_expiry_date,
  u.email owner_email,u.name owner_name FROM vehicles v JOIN users u ON u.id=v.user_id AND u.active=1`).all(),items=[];
 for(const vehicle of vehicles){
  const sources=[["temporary-registration","Temporary Registration",vehicle.registration_status==="Temporary"?vehicle.temporary_registration_expiry:""],["first-party-insurance","First Party / Own Damage Insurance",vehicle.first_party_expiry_date],["third-party-insurance","Third Party Insurance",vehicle.third_party_expiry_date],["puc","PUC",vehicle.puc_expiry_date]];
  for(const[sourceKey,documentName,expiryDate]of sources)if(expiryDate&&!documentSources.has(`${vehicle.vehicle_id}:${sourceKey}`))items.push({...vehicle,document_id:null,source_key:sourceKey,reminder_type:sourceKey,document_name:documentName,expiry_date:expiryDate});
 }
 return items;
}

function documentExpiryItems(db){
 return db.prepare(`SELECT d.id document_id,d.user_id owner_user_id,d.name document_name,d.category reminder_type,d.expiry_date,
  'document:'||d.id source_key,v.id vehicle_id,v.vehicle_number,v.vehicle_name,v.brand,v.make,v.model,v.location_id,
  u.email owner_email,u.name owner_name FROM vehicle_documents d JOIN vehicles v ON v.id=d.vehicle_id AND v.user_id=d.user_id
  JOIN users u ON u.id=d.user_id AND u.active=1 WHERE d.deleted_at IS NULL AND NULLIF(d.expiry_date,'') IS NOT NULL
  AND EXISTS(SELECT 1 FROM document_versions version WHERE version.document_id=d.id AND version.is_active=1 AND version.deleted_at IS NULL)`).all();
}

function recipientsFor(db,item){
 const recipients=new Map([[Number(item.owner_user_id),{recipient_user_id:Number(item.owner_user_id),email:item.owner_email,name:item.owner_name}]]);
 if(!tableExists(db,"location_shares")||!tableExists(db,"shared_vehicle_assignments"))return[...recipients.values()];
 const shared=db.prepare(`SELECT DISTINCT u.id recipient_user_id,u.email,u.name FROM location_shares share JOIN users u ON u.id=share.grantee_user_id AND u.active=1
  WHERE share.owner_user_id=? AND ((share.scope='location' AND share.location_id=?) OR (share.scope='selected' AND EXISTS(SELECT 1 FROM shared_vehicle_assignments assignment WHERE assignment.share_id=share.id AND assignment.vehicle_id=?)))`).all(item.owner_user_id,item.location_id,item.vehicle_id);
 for(const recipient of shared)recipients.set(Number(recipient.recipient_user_id),recipient);
 return[...recipients.values()];
}

export function dueReminders(db,today=indiaDate()){
 const due=[],documents=documentExpiryItems(db),documentSources=new Set(documents.map(item=>{const category=String(item.reminder_type).toLowerCase();if(category==="first party / own damage insurance")return`${item.vehicle_id}:first-party-insurance`;if(category==="third party insurance")return`${item.vehicle_id}:third-party-insurance`;if(category==="puc")return`${item.vehicle_id}:puc`;return""}).filter(Boolean));
 for(const item of[...vehicleExpiryItems(db,documentSources),...documents]){
  const reminderDays=daysUntil(item.expiry_date,today);
  if(!REMINDER_DAYS.includes(reminderDays))continue;
  for(const recipient of recipientsFor(db,item))due.push({...item,...recipient,reminder_days:reminderDays,scheduled_date:today});
 }
 return due;
}

export function reminderMessage(item,{baseUrl="https://vijayjha.in",fromName="GaadiFile"}={}){
 const vehicleUrl=`${String(baseUrl).replace(/\/$/,"")}/cars/${item.vehicle_id}`,remaining=item.reminder_days===0?"expires today":`expires in ${item.reminder_days} day${item.reminder_days===1?"":"s"}`,vehicleDetails=[item.vehicle_name,item.brand||item.make,item.model].filter(Boolean).join(" · "),subject=`${item.vehicle_number}: ${item.document_name} ${remaining}`;
 const text=`Hello ${item.name},\n\n${item.document_name} for ${item.vehicle_number}${vehicleDetails?` (${vehicleDetails})`:""} ${remaining}.\nExpiry date: ${item.expiry_date}\n\nOpen Vehicle: ${vehicleUrl}\n\nRegards,\n${fromName}`;
 const html=`<!doctype html><html><body style="margin:0;background:#f4f7f5;font-family:Arial,sans-serif;color:#10233a"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #dce5df;border-radius:14px"><tr><td style="padding:28px"><div style="font-size:14px;font-weight:700;color:#4f8a59;text-transform:uppercase">${escapeHtml(fromName)}</div><h1 style="font-size:24px;margin:10px 0 18px">Vehicle document reminder</h1><p>Hello ${escapeHtml(item.name)},</p><p><strong>${escapeHtml(item.document_name)}</strong> for <strong>${escapeHtml(item.vehicle_number)}</strong> ${escapeHtml(remaining)}.</p>${vehicleDetails?`<p style="color:#627083">${escapeHtml(vehicleDetails)}</p>`:""}<p>Expiry date: <strong>${escapeHtml(item.expiry_date)}</strong></p><p style="margin:26px 0"><a href="${escapeHtml(vehicleUrl)}" style="display:inline-block;background:#4f8a59;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700">Open Vehicle</a></p><p style="font-size:12px;color:#758294">Sign in to the secure portal to view private vehicle information. This email contains no document link or authentication token.</p></td></tr></table></td></tr></table></body></html>`;
 return{subject,text,html,vehicleUrl};
}

function reserveDelivery(db,item,maxAttempts){
 db.prepare(`INSERT OR IGNORE INTO email_reminder_deliveries(owner_user_id,recipient_user_id,vehicle_id,document_id,source_key,reminder_type,expiry_date,reminder_days,scheduled_date,status) VALUES(?,?,?,?,?,?,?,?,?,'pending')`).run(item.owner_user_id,item.recipient_user_id,item.vehicle_id,item.document_id,item.source_key,item.reminder_type,item.expiry_date,item.reminder_days,item.scheduled_date);
 const row=db.prepare("SELECT * FROM email_reminder_deliveries WHERE recipient_user_id=? AND vehicle_id=? AND source_key=? AND expiry_date=? AND reminder_days=?").get(item.recipient_user_id,item.vehicle_id,item.source_key,item.expiry_date,item.reminder_days);
 if(!row||row.status==="sent"||Number(row.attempt_count)>=maxAttempts)return null;
 const claim=db.prepare(`UPDATE email_reminder_deliveries SET status='sending',attempt_count=attempt_count+1,last_attempt_at=CURRENT_TIMESTAMP,failure_reason=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status<>'sent' AND attempt_count<? AND (status<>'sending' OR last_attempt_at IS NULL OR last_attempt_at<=datetime('now','-15 minutes'))`).run(row.id,maxAttempts);
 return Number(claim.changes)===1?row.id:null;
}

const wait=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
async function sendWithRetry(transport,message,retries){let lastError;for(let attempt=0;attempt<=retries;attempt++){try{return await transport.sendMail(message)}catch(error){lastError=error;if(attempt<retries)await wait(250*(2**attempt))}}throw lastError}

export async function runVehicleReminders({db,transport,from,baseUrl="https://vijayjha.in",fromName="GaadiFile",today=indiaDate(),maxAttempts=3,sendRetries=2}={}){
 if(!db||!transport||!from)throw new Error("Database, SMTP transport and sender are required");
 ensureReminderSchema(db);
 const due=dueReminders(db,today),result={date:today,timeZone:INDIA_TIME_ZONE,due:due.length,sent:0,failed:0,skipped:0};
 for(const item of due){
  const deliveryId=reserveDelivery(db,item,maxAttempts);if(!deliveryId){result.skipped++;continue}
  const content=reminderMessage(item,{baseUrl,fromName});
  try{const info=await sendWithRetry(transport,{from,to:item.email,subject:content.subject,text:content.text,html:content.html},sendRetries);db.prepare("UPDATE email_reminder_deliveries SET status='sent',sent_at=CURRENT_TIMESTAMP,provider_message_id=?,failure_reason=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(String(info?.messageId||"").slice(0,255),deliveryId);if(tableExists(db,"vehicle_audit_log"))db.prepare("INSERT INTO vehicle_audit_log(user_id,action,vehicle_id,document_id) VALUES(?,?,?,?)").run(item.owner_user_id,"reminder_email_sent",item.vehicle_id,item.document_id);result.sent++}
  catch(error){db.prepare("UPDATE email_reminder_deliveries SET status='failed',failure_reason=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(safeError(error),deliveryId);result.failed++}
 }
 return result;
}
