import assert from "node:assert/strict";
import {mkdtemp,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {Readable,Writable} from "node:stream";
import test from "node:test";
import {DatabaseSync} from "node:sqlite";
import {createAuth} from "../auth-api.mjs";
import {createVehicleApi} from "../vehicle-api.mjs";
import {createVehicleSharing} from "../vehicle-sharing.mjs";

const json=(res,status,data,headers={})=>{
 res.writeHead(status,{"Content-Type":"application/json",...headers});
 res.end(JSON.stringify(data));
};

function call(handler,method,pathname,body,cookie=""){
 return new Promise((resolve,reject)=>{
  const payload=body===undefined?[]:[Buffer.from(JSON.stringify(body))];
  const req=Readable.from(payload);
  req.method=method;
  req.url=pathname;
  req.headers={host:"localhost",...(cookie?{cookie}:{})};
  req.socket={remoteAddress:"127.0.0.1"};
  let status=200,headers={};const chunks=[];
  const res=new Writable({write(chunk,_encoding,done){chunks.push(Buffer.from(chunk));done()}});
  res.writeHead=(code,nextHeaders={})=>{status=code;headers=nextHeaders;return res};
  res.on("finish",()=>{const output=Buffer.concat(chunks),text=output.toString();let parsed=text;try{parsed=JSON.parse(text)}catch{}resolve({status,headers,body:parsed,buffer:output})});
  Promise.resolve(handler(req,res,new URL(pathname,"http://localhost"))).catch(reject);
 });
}

test("managed viewer is restricted to selected vehicles and lifecycle actions",async()=>{
 const root=await mkdtemp(path.join(tmpdir(),"vehicle-sharing-test-"));
 const db=new DatabaseSync(":memory:");
 try{
  db.exec("PRAGMA foreign_keys=ON; CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,expires_at INTEGER NOT NULL)");
  const auth=await createAuth({db,json});
  const sharing=createVehicleSharing({db,currentUser:auth.currentUser,json,managed:auth.managed});
  const vehicles=await createVehicleApi({db,root,authed:auth.authed,currentUser:auth.currentUser,ownerUserId:null,json,sharing});

  const ownerRegister=await call(auth.api,"POST","/api/auth/register",{name:"Owner",email:"owner@example.test",password:"OwnerPassword!123"});
  assert.equal(ownerRegister.status,200);
  const ownerCookie=String(ownerRegister.headers["Set-Cookie"]).split(";")[0];
  const location=await call(vehicles,"POST","/api/private/vehicles/locations",{name:"Punjab"},ownerCookie);
  assert.equal(location.status,201);

  const createVehicle=(number,extra={})=>call(vehicles,"POST","/api/private/vehicles",{vehicle_number:number,type:"Bike",location_id:location.body.id,...extra},ownerCookie);
  const first=await createVehicle("PB65BN2327",{chassis_number:"MA3TESTCHASSIS001",engine_number:"K15TESTENGINE001"}),second=await createVehicle("PB70M6681"),hidden=await createVehicle("PB00HIDDEN");
  assert.equal(first.status,201);assert.equal(second.status,201);assert.equal(hidden.status,201);
  const firstDetail=await call(vehicles,"GET",`/api/private/vehicles/${first.body.id}`,undefined,ownerCookie);
  assert.equal(firstDetail.body.vehicle.chassis_number,"MA3TESTCHASSIS001");assert.equal(firstDetail.body.vehicle.engine_number,"K15TESTENGINE001");
  const updatedIdentity=await call(vehicles,"PUT",`/api/private/vehicles/${first.body.id}`,{vehicle_number:"PB65BN2327",type:"Bike",location_id:location.body.id,chassis_number:"MA3TESTCHASSIS002",engine_number:"K15TESTENGINE002"},ownerCookie);
  assert.equal(updatedIdentity.status,200);
  const updatedDetail=await call(vehicles,"GET",`/api/private/vehicles/${first.body.id}`,undefined,ownerCookie);
  assert.equal(updatedDetail.body.vehicle.chassis_number,"MA3TESTCHASSIS002");assert.equal(updatedDetail.body.vehicle.engine_number,"K15TESTENGINE002");

  const created=await call(vehicles,"POST","/api/private/vehicles/sharing/users",{name:"Raj Driver",email:"raj.driver@example.test",mobile:"9999999999",password:"Temporary!123",permission:"view",scope:"selected",locationId:location.body.id,vehicleIds:[first.body.id,second.body.id]},ownerCookie);
  assert.equal(created.status,201);
  assert.equal(created.body.invitationSent,false);
  assert.match(created.body.message,/invitation email could not be sent/i);

  const login=await call(auth.api,"POST","/api/login",{email:"raj.driver@example.test",password:"Temporary!123"});
  assert.equal(login.status,200);
  assert.equal(login.body.user.forcePasswordReset,true);
  const driverCookie=String(login.headers["Set-Cookie"]).split(";")[0];
  assert.equal((await call(vehicles,"GET","/api/private/vehicles/dashboard",undefined,driverCookie)).status,403);

  const changed=await call(auth.api,"POST","/api/auth/change-password",{currentPassword:"Temporary!123",newPassword:"ChangedPassword!123"},driverCookie);
  assert.equal(changed.status,200);
  const dashboard=await call(vehicles,"GET","/api/private/vehicles/dashboard",undefined,driverCookie);
  assert.equal(dashboard.status,200);assert.equal(dashboard.body.totalVehicles,2);
  const list=await call(vehicles,"GET","/api/private/vehicles?page=1&pageSize=20&q=PB",undefined,driverCookie);
  assert.equal(list.body.total,2);
  assert.deepEqual(list.body.items.map(item=>item.vehicle_number).sort(),["PB65BN2327","PB70M6681"]);
  assert.equal((await call(vehicles,"GET",`/api/private/vehicles/${hidden.body.id}`,undefined,driverCookie)).status,404);
  assert.equal((await call(vehicles,"PUT",`/api/private/vehicles/${first.body.id}`,{vehicle_number:"PB65BN2327"},driverCookie)).status,403);

  const ownerId=Number(db.prepare("SELECT id FROM users WHERE email='owner@example.test'").get().id);
  const allowedDocument=Number(db.prepare("INSERT INTO vehicle_documents(user_id,vehicle_id,name,category,expiry_date) VALUES(?,?,?,?,?)").run(ownerId,first.body.id,"Assigned Insurance","Insurance","2000-01-01").lastInsertRowid);
  const hiddenDocument=Number(db.prepare("INSERT INTO vehicle_documents(user_id,vehicle_id,name,category,expiry_date) VALUES(?,?,?,?,?)").run(ownerId,hidden.body.id,"Hidden Insurance","Insurance","2000-01-01").lastInsertRowid);
  const pdf=Buffer.from("%PDF-1.4\n%%EOF");
  await writeFile(path.join(root,"data","private-vehicle-documents","assigned.pdf"),pdf);
  db.prepare("INSERT INTO document_versions(document_id,stored_name,original_name,mime_type,file_size) VALUES(?,?,?,?,?)").run(allowedDocument,"assigned.pdf","assigned.pdf","application/pdf",pdf.length);
  const documentList=await call(vehicles,"GET","/api/private/vehicles/documents?page=1&pageSize=20",undefined,driverCookie);
  assert.deepEqual(documentList.body.items.map(item=>item.id),[allowedDocument]);
  assert.equal((await call(vehicles,"GET",`/api/private/vehicles/${first.body.id}/documents/${allowedDocument}/view`,undefined,driverCookie)).status,200);
  assert.equal((await call(vehicles,"GET",`/api/private/vehicles/${first.body.id}/documents/${allowedDocument}/download`,undefined,driverCookie)).status,200);
  assert.equal((await call(vehicles,"GET",`/api/private/vehicles/${hidden.body.id}/documents/${hiddenDocument}/view`,undefined,driverCookie)).status,404);
  const reminders=await call(vehicles,"GET","/api/private/vehicles/reminders?page=1&pageSize=20",undefined,driverCookie);
  assert.ok(reminders.body.items.every(item=>item.vehicle_id!==hidden.body.id));

  const driverId=Number(db.prepare("SELECT id FROM users WHERE email='raj.driver@example.test'").get().id);
  assert.equal((await call(vehicles,"PATCH",`/api/private/vehicles/sharing/users/${driverId}`,{active:false},ownerCookie)).status,200);
  assert.equal((await call(auth.api,"POST","/api/login",{email:"raj.driver@example.test",password:"ChangedPassword!123"})).status,401);
  assert.equal((await call(vehicles,"PATCH",`/api/private/vehicles/sharing/users/${driverId}`,{active:true},ownerCookie)).status,200);
  assert.equal((await call(auth.api,"POST","/api/login",{email:"raj.driver@example.test",password:"ChangedPassword!123"})).status,200);

  const resend=await call(vehicles,"POST",`/api/private/vehicles/sharing/users/${driverId}/resend-invitation`,{},ownerCookie);
  assert.equal(resend.status,200);assert.equal(resend.body.invitationSent,false);
  assert.equal((await call(vehicles,"DELETE",`/api/private/vehicles/sharing/${created.body.shareId}`,undefined,ownerCookie)).status,200);
  assert.deepEqual(sharing.ids(driverId),[]);
  const actions=db.prepare("SELECT action FROM managed_user_audit WHERE user_id=?").all(driverId).map(row=>row.action);
  for(const action of["user_created","permission_changed","invitation_failed","user_disabled","user_enabled","access_revoked"])assert.ok(actions.includes(action),action);
 }finally{
  db.close();
  await rm(root,{recursive:true,force:true});
 }
});
