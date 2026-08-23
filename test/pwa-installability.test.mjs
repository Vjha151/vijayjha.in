import assert from "node:assert/strict";
import {readFile,stat} from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root=process.cwd();
const fromRoot=(...parts)=>path.join(root,...parts);

test("GaadiFile manifest meets installability requirements",async()=>{
 const manifest=JSON.parse(await readFile(fromRoot("public","vehicle-manifest.webmanifest"),"utf8"));
 assert.equal(manifest.name,"GaadiFile");
 assert.equal(manifest.short_name,"GaadiFile");
 assert.equal(manifest.start_url,"/cars");
 assert.equal(manifest.scope,"/cars");
 assert.equal(manifest.display,"standalone");
 assert.match(manifest.theme_color,/^#[0-9a-f]{6}$/i);
 assert.match(manifest.background_color,/^#[0-9a-f]{6}$/i);
 const sizes=new Set(manifest.icons.filter(icon=>icon.purpose==="any").map(icon=>icon.sizes));
 assert.ok(sizes.has("192x192"));
 assert.ok(sizes.has("512x512"));
 assert.ok(manifest.icons.some(icon=>icon.purpose==="maskable"));
 assert.ok(manifest.icons.every(icon=>icon.src.includes("?v=2")));
});

test("PWA icons are valid PNG files with declared dimensions",async()=>{
 for(const [name,size] of[["icon-180.png",180],["icon-192.png",192],["icon-512.png",512],["maskable-512.png",512]]){
  const file=await readFile(fromRoot("public","pwa",name));
  assert.deepEqual([...file.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.equal(file.readUInt32BE(16),size);
  assert.equal(file.readUInt32BE(20),size);
 }
});

test("service worker is portal-scoped and never caches private APIs",async()=>{
 const worker=await readFile(fromRoot("public","vehicle-sw.js"),"utf8");
 assert.match(worker,/SHELL="\/cars"/);
 assert.match(worker,/pathname\.startsWith\("\/api\/"\)/);
 assert.match(worker,/request\.method!=="GET"/);
 assert.match(worker,/CACHE="gaadifile-shell-v4"/);
 const setup=await readFile(fromRoot("src","vehicle-pwa.ts"),"utf8");
 assert.match(setup,/scope:"\/cars"/);
 assert.match(setup,/vehicle-sw\.js\?v=4/);
 assert.match(setup,/controllerchange/);
 assert.match(setup,/vehicle-manifest\.webmanifest/);
 assert.match(setup,/document\.title="GaadiFile"/);
 assert.match(setup,/\/pwa\/icon-180\.png/);
 assert.match(setup,/gaadifileIcon/);
 assert.match(setup,/icon-192\.png\?v=2/);
 assert.match(setup,/icon-180\.png\?v=2/);
 const offline=await readFile(fromRoot("public","vehicle-offline.html"),"utf8");
 assert.match(offline,/GaadiFile is offline/);
 assert.match(offline,/\/pwa\/icon-192\.png/);
});

test("customer portal visibly uses the approved GaadiFile logo",async()=>{
 const manager=await readFile(fromRoot("src","components","VehicleManager.tsx"),"utf8");
 const sidebar=await readFile(fromRoot("src","components","VehicleSidebar.tsx"),"utf8");
 assert.match(manager,/src="\/gaadifile-logo\.png" alt="GaadiFile/);
 assert.match(sidebar,/src="\/gaadifile-logo\.png" alt="GaadiFile/);
});

test("legacy customer routes redirect to /cars without changing private APIs",async()=>{
 const server=await readFile(fromRoot("server.mjs"),"utf8");
 assert.match(server,/url\.pathname==="\/vehicles"\|\|url\.pathname\.startsWith\("\/vehicles\/"\)/);
 assert.match(server,/Location:`\/cars\$\{url\.pathname\.slice\("\/vehicles"\.length\)\}\$\{url\.search\}`/);
 assert.match(server,/url\.pathname==="\/private\/vehicles"\|\|url\.pathname\.startsWith\("\/private\/vehicles\/"\)/);
 assert.match(server,/url\.pathname\.startsWith\("\/api\/private\/vehicles"\)/);
 assert.doesNotMatch(server,/\/api\/private\/cars/);
});

test("production build contains all installable PWA assets",async()=>{
 for(const relative of["gaadifile-logo.png","vehicle-manifest.webmanifest","vehicle-sw.js","vehicle-offline.html","pwa/icon-180.png","pwa/icon-192.png","pwa/icon-512.png","pwa/maskable-512.png"]){
  assert.ok((await stat(fromRoot("dist",...relative.split("/")))).size>0,relative);
 }
});
