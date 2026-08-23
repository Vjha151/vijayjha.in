import assert from "node:assert/strict";
import {mkdtemp,readdir,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {Readable,Writable} from "node:stream";
import test from "node:test";
import {DatabaseSync} from "node:sqlite";
import {createAuth} from "../auth-api.mjs";
import {createVehicleApi} from "../vehicle-api.mjs";
import {createVehicleSharing} from "../vehicle-sharing.mjs";

const MAX_FILE=5*1024*1024;
const json=(res,status,data,headers={})=>{res.writeHead(status,{"Content-Type":"application/json",...headers});res.end(JSON.stringify(data))};

function invoke(handler,method,pathname,payload=Buffer.alloc(0),headers={}){
 return new Promise((resolve,reject)=>{
  const req=Readable.from(payload.length?[payload]:[]);req.method=method;req.url=pathname;req.headers={host:"localhost",...headers};req.socket={remoteAddress:"127.0.0.1"};
  let status=200,responseHeaders={};const chunks=[];
  const res=new Writable({write(chunk,_encoding,done){chunks.push(Buffer.from(chunk));done()}});
  res.writeHead=(code,nextHeaders={})=>{status=code;responseHeaders=nextHeaders;return res};
  res.on("finish",()=>{const buffer=Buffer.concat(chunks),text=buffer.toString();let body=text;try{body=JSON.parse(text)}catch{}resolve({status,headers:responseHeaders,body,buffer})});
  Promise.resolve(handler(req,res,new URL(pathname,"http://localhost"))).catch(reject);
 });
}

const jsonCall=(handler,method,pathname,body,cookie="")=>invoke(handler,method,pathname,body===undefined?Buffer.alloc(0):Buffer.from(JSON.stringify(body)),{...(body===undefined?{}:{"content-type":"application/json"}),...(cookie?{cookie}:{})});

async function multipartCall(handler,pathname,{bytes,name,type,fields={}},cookie=""){
 const form=new FormData();for(const[key,value]of Object.entries(fields))form.set(key,String(value));form.set("file",new Blob([bytes],{type}),name);
 const encoded=new Request("http://localhost/upload",{method:"POST",body:form}),payload=Buffer.from(await encoded.arrayBuffer());
 return invoke(handler,"POST",pathname,payload,{"content-type":encoded.headers.get("content-type"),"content-length":String(payload.length),...(cookie?{cookie}:{})});
}

const pdfOfSize=size=>{const head=Buffer.from("PDF wrapper\n%PDF-1.7\n"),tail=Buffer.from("\n%%EOF");return Buffer.concat([head,Buffer.alloc(size-head.length-tail.length,32),tail])};

test("private document upload accepts real PDFs from generic-MIME providers and preserves all security checks",async()=>{
 const root=await mkdtemp(path.join(tmpdir(),"vehicle-documents-test-")),db=new DatabaseSync(":memory:");
 try{
  db.exec("PRAGMA foreign_keys=ON; CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,expires_at INTEGER NOT NULL)");
  const auth=await createAuth({db,json}),sharing=createVehicleSharing({db,currentUser:auth.currentUser,json,managed:auth.managed}),vehicles=await createVehicleApi({db,root,authed:auth.authed,currentUser:auth.currentUser,ownerUserId:null,json,sharing});
  const register=await jsonCall(auth.api,"POST","/api/auth/register",{name:"PDF Owner",email:"pdf.owner@example.test",password:"OwnerPassword!123"}),ownerCookie=String(register.headers["Set-Cookie"]).split(";")[0];
  const location=await jsonCall(vehicles,"POST","/api/private/vehicles/locations",{name:"PDF Garage"},ownerCookie);
  const created=await jsonCall(vehicles,"POST","/api/private/vehicles",{vehicle_number:"PDFTEST1",location_id:location.body.id},ownerCookie),vehicleId=created.body.id;
  assert.equal(created.status,201);

  const smallPdf=pdfOfSize(2048),smallUpload=await multipartCall(vehicles,`/api/private/vehicles/${vehicleId}/documents`,{bytes:smallPdf,name:"RC Document.PDF",type:"application/octet-stream",fields:{name:"RC",category:"RC"}},ownerCookie);
  assert.equal(smallUpload.status,201);
  const documentId=smallUpload.body.id,version=db.prepare("SELECT * FROM document_versions WHERE document_id=? AND is_active=1").get(documentId),store=path.join(root,"data","private-vehicle-documents");
  assert.equal(version.mime_type,"application/pdf");assert.equal(version.original_name,"RC Document.PDF");assert.match(version.stored_name,/^[0-9a-f-]{36}\.pdf$/);assert.deepEqual(await readFile(path.join(store,version.stored_name)),smallPdf);

  const view=await jsonCall(vehicles,"GET",`/api/private/vehicles/${vehicleId}/documents/${documentId}/view`,undefined,ownerCookie),download=await jsonCall(vehicles,"GET",`/api/private/vehicles/${vehicleId}/documents/${documentId}/download`,undefined,ownerCookie);
  assert.equal(view.status,200);assert.equal(view.headers["Content-Type"],"application/pdf");assert.match(view.headers["Content-Disposition"],/^inline/);assert.deepEqual(view.buffer,smallPdf);
  assert.equal(download.status,200);assert.match(download.headers["Content-Disposition"],/^attachment/);assert.deepEqual(download.buffer,smallPdf);

  const nearLimit=pdfOfSize(MAX_FILE),nearUpload=await multipartCall(vehicles,`/api/private/vehicles/${vehicleId}/documents`,{bytes:nearLimit,name:"insurance.pdf",type:"application/pdf",fields:{name:"Insurance",category:"First Party / Own Damage Insurance"}},ownerCookie);
  assert.equal(nearUpload.status,201);assert.equal(db.prepare("SELECT file_size FROM document_versions WHERE document_id=?").get(nearUpload.body.id).file_size,MAX_FILE);
  const filesBeforeRejected=(await readdir(store)).length;

  const oversized=await multipartCall(vehicles,`/api/private/vehicles/${vehicleId}/documents`,{bytes:pdfOfSize(MAX_FILE+1),name:"too-large.pdf",type:"application/pdf",fields:{name:"Too large",category:"Other"}},ownerCookie);
  assert.equal(oversized.status,400);assert.equal(oversized.body.error,"File is too large. Maximum allowed size is 5 MB.");assert.equal((await readdir(store)).length,filesBeforeRejected);
  const fake=await multipartCall(vehicles,`/api/private/vehicles/${vehicleId}/documents`,{bytes:Buffer.from("not a pdf"),name:"fake.pdf",type:"application/pdf",fields:{name:"Fake",category:"Other"}},ownerCookie);
  assert.equal(fake.status,400);assert.match(fake.body.error,/File must be PDF/);assert.equal((await readdir(store)).length,filesBeforeRejected);
  const incompletePdf=await multipartCall(vehicles,`/api/private/vehicles/${vehicleId}/documents`,{bytes:Buffer.from("wrapper\n%PDF-1.7\nmissing end marker"),name:"incomplete.pdf",type:"application/pdf",fields:{name:"Incomplete",category:"Other"}},ownerCookie);
  assert.equal(incompletePdf.status,400);assert.equal((await readdir(store)).length,filesBeforeRejected);
  const conflictingMime=await multipartCall(vehicles,`/api/private/vehicles/${vehicleId}/documents`,{bytes:smallPdf,name:"wrong-type.pdf",type:"image/png",fields:{name:"Wrong type",category:"Other"}},ownerCookie);
  assert.equal(conflictingMime.status,400);assert.equal((await readdir(store)).length,filesBeforeRejected);

  const jpeg=await multipartCall(vehicles,`/api/private/vehicles/${vehicleId}/documents`,{bytes:Buffer.from([255,216,255,217]),name:"photo.jpg",type:"application/octet-stream",fields:{name:"Photo",category:"Other"}},ownerCookie);
  const png=await multipartCall(vehicles,`/api/private/vehicles/${vehicleId}/documents`,{bytes:Buffer.from([137,80,78,71,13,10,26,10,0]),name:"scan.png",type:"image/png",fields:{name:"Scan",category:"PUC"}},ownerCookie);
  assert.equal(jpeg.status,201);assert.equal(png.status,201);assert.equal(db.prepare("SELECT mime_type FROM document_versions WHERE document_id=?").get(jpeg.body.id).mime_type,"image/jpeg");assert.equal(db.prepare("SELECT mime_type FROM document_versions WHERE document_id=?").get(png.body.id).mime_type,"image/png");
  const jpegView=await jsonCall(vehicles,"GET",`/api/private/vehicles/${vehicleId}/documents/${jpeg.body.id}/view`,undefined,ownerCookie);
  const pngView=await jsonCall(vehicles,"GET",`/api/private/vehicles/${vehicleId}/documents/${png.body.id}/view`,undefined,ownerCookie);
  const pdfHead=await invoke(vehicles,"HEAD",`/api/private/vehicles/${vehicleId}/documents/${documentId}/view`,Buffer.alloc(0),{cookie:ownerCookie});
  assert.equal(jpegView.status,200);assert.equal(jpegView.headers["Content-Type"],"image/jpeg");assert.deepEqual(jpegView.buffer,Buffer.from([255,216,255,217]));
  assert.equal(pngView.status,200);assert.equal(pngView.headers["Content-Type"],"image/png");assert.deepEqual(pngView.buffer,Buffer.from([137,80,78,71,13,10,26,10,0]));
  assert.equal(pdfHead.status,200);assert.equal(pdfHead.headers["Content-Type"],"application/pdf");assert.equal(pdfHead.buffer.length,0);

  const replacement=pdfOfSize(3072),replaced=await multipartCall(vehicles,`/api/private/vehicles/${vehicleId}/documents/${documentId}/replace`,{bytes:replacement,name:"RC replacement.pdf",type:"application/x-pdf"},ownerCookie);
  assert.equal(replaced.status,200);assert.equal(db.prepare("SELECT COUNT(*) total FROM document_versions WHERE document_id=?").get(documentId).total,2);assert.equal(db.prepare("SELECT COUNT(*) total FROM document_versions WHERE document_id=? AND is_active=1").get(documentId).total,1);

  assert.equal((await jsonCall(vehicles,"GET",`/api/private/vehicles/${vehicleId}/documents/${documentId}/view`)).status,401);
  const viewerCreated=await jsonCall(vehicles,"POST","/api/private/vehicles/sharing/users",{name:"PDF Viewer",email:"pdf.viewer@example.test",password:"ViewerPassword!123",permission:"view",scope:"location",locationId:location.body.id,vehicleIds:[]},ownerCookie);
  assert.equal(viewerCreated.status,201);
  const viewerLogin=await jsonCall(auth.api,"POST","/api/login",{email:"pdf.viewer@example.test",password:"ViewerPassword!123"}),viewerCookie=String(viewerLogin.headers["Set-Cookie"]).split(";")[0];
  assert.equal((await jsonCall(auth.api,"POST","/api/auth/change-password",{currentPassword:"ViewerPassword!123",newPassword:"ViewerChanged!123"},viewerCookie)).status,200);
  const viewerUpload=await multipartCall(vehicles,`/api/private/vehicles/${vehicleId}/documents`,{bytes:smallPdf,name:"viewer.pdf",type:"application/pdf",fields:{name:"Viewer upload",category:"Other"}},viewerCookie);
  assert.equal(viewerUpload.status,403);assert.equal(viewerUpload.body.error,"Editor permission required");
  const outsider=await jsonCall(auth.api,"POST","/api/auth/register",{name:"Outsider",email:"outsider@example.test",password:"OutsiderPassword!123"}),outsiderCookie=String(outsider.headers["Set-Cookie"]).split(";")[0];
  assert.equal((await jsonCall(vehicles,"GET",`/api/private/vehicles/${vehicleId}/documents/${documentId}/view`,undefined,outsiderCookie)).status,404);
 }finally{db.close();await rm(root,{recursive:true,force:true})}
});
