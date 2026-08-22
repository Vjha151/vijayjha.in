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
 assert.equal(manifest.start_url,"/vehicles");
 assert.equal(manifest.scope,"/vehicles");
 assert.equal(manifest.display,"standalone");
 assert.match(manifest.theme_color,/^#[0-9a-f]{6}$/i);
 assert.match(manifest.background_color,/^#[0-9a-f]{6}$/i);
 const sizes=new Set(manifest.icons.filter(icon=>icon.purpose==="any").map(icon=>icon.sizes));
 assert.ok(sizes.has("192x192"));
 assert.ok(sizes.has("512x512"));
 assert.ok(manifest.icons.some(icon=>icon.purpose==="maskable"));
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
 assert.match(worker,/SHELL="\/vehicles"/);
 assert.match(worker,/pathname\.startsWith\("\/api\/"\)/);
 assert.match(worker,/request\.method!=="GET"/);
 const setup=await readFile(fromRoot("src","vehicle-pwa.ts"),"utf8");
 assert.match(setup,/scope:"\/vehicles"/);
 assert.match(setup,/vehicle-manifest\.webmanifest/);
 assert.match(setup,/document\.title="GaadiFile"/);
 assert.match(setup,/\/pwa\/icon-180\.png/);
 assert.match(setup,/gaadifileIcon/);
 const offline=await readFile(fromRoot("public","vehicle-offline.html"),"utf8");
 assert.match(offline,/GaadiFile is offline/);
 assert.match(offline,/\/pwa\/icon-192\.png/);
});

test("production build contains all installable PWA assets",async()=>{
 for(const relative of["gaadifile-logo.png","vehicle-manifest.webmanifest","vehicle-sw.js","vehicle-offline.html","pwa/icon-180.png","pwa/icon-192.png","pwa/icon-512.png","pwa/maskable-512.png"]){
  assert.ok((await stat(fromRoot("dist",...relative.split("/")))).size>0,relative);
 }
});
