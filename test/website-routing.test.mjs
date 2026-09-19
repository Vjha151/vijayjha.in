import assert from "node:assert/strict";
import http from "node:http";
import {once} from "node:events";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {handleWebsiteRequest,websiteForHost} from "../website-routing.mjs";

test("domain selection uses exact hosts and supports a standalone preview",()=>{
 for(const host of ["garifile.com","GARIFILE.COM:3000","garifile.com."])assert.deepEqual(websiteForHost(host),{gari:true,redirect:false});
 for(const host of ["www.garifile.com","garifile.in","www.garifile.in"])assert.deepEqual(websiteForHost(host),{gari:true,redirect:true});
 for(const host of ["vijayjha.in","localhost:3000","garifile.com.evil.test"])assert.deepEqual(websiteForHost(host),{gari:false,redirect:false});
 assert.equal(websiteForHost("localhost:3000","garifile").gari,true);
});

test("GariFile serves its own built entry, preserves API authentication and leaves the portfolio alone",async()=>{
 const server=http.createServer(async(req,res)=>{
  try{if(await handleWebsiteRequest(req,res,new URL(req.url,"http://localhost"),{root:process.cwd(),mode:""}))return;
   res.writeHead(req.url.startsWith("/api/")?401:200);res.end("existing application");
  }catch(error){res.writeHead(500);res.end(error.message)}
 });
 server.listen(0,"127.0.0.1");await once(server,"listening");
 const request=(host,url="/")=>new Promise((resolve,reject)=>{
  http.get({hostname:"127.0.0.1",port:server.address().port,path:url,headers:{host}},res=>{
   let body="";res.on("data",data=>body+=data);res.on("end",()=>resolve({status:res.statusCode,headers:res.headers,body}));
  }).on("error",reject);
 });
 try{
  for(const url of ["/","/cars","/cars/25","/cars/account","/cars/import","/cars?reset=test-token"]){
   const response=await request("garifile.com",url);assert.equal(response.status,200);assert.match(response.body,/data-site="garifile"/);assert.match(response.body,/<title>GariFile/);assert.doesNotMatch(response.body,/Tax Consultant/);assert.equal(response.headers["cache-control"],"no-store");
  }
  assert.equal((await request("vijayjha.in")).body,"existing application");
  for(const host of ["garifile.in","www.garifile.in","www.garifile.com"]){
   const response=await request(host,"/cars/25?view=docs");assert.equal(response.status,308);assert.equal(response.headers.location,"https://garifile.com/cars/25?view=docs");
  }
  for(const url of ["/api/auth/me","/api/login","/api/private/vehicles","/api/private/vehicles/25/documents/1/view"])assert.equal((await request("garifile.com",url)).status,401);
  for(const url of ["/about","/admin","/api/content","/api/admin/settings","/uploads/photo.jpg","/index.html","/missing.html"])assert.equal((await request("garifile.com",url)).status,404);
 }finally{await new Promise(resolve=>server.close(resolve))}
});

test("GariFile PWA installs on the new domain root with existing valid icons",async()=>{
 const manifest=JSON.parse(await readFile("public/garifile-manifest.webmanifest","utf8"));
 assert.equal(manifest.name,"GariFile");assert.equal(manifest.scope,"/");assert.equal(manifest.start_url,"/");
 for(const icon of manifest.icons)assert.ok((await readFile(`public${icon.src.split("?")[0]}`)).length);
 const worker=await readFile("public/garifile-sw.js","utf8");
 assert.match(worker,/pathname\.startsWith\("\/api\/"\)/);assert.match(worker,/request\.method!=="GET"/);
});
