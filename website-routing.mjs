import {readFile} from "node:fs/promises";
import path from "node:path";

const gariHosts=new Set(["garifile.com","www.garifile.com","garifile.in","www.garifile.in"]);
export function websiteForHost(host="",mode=""){
 const hostname=String(host).toLowerCase().replace(/:\d+$/,"").replace(/\.$/,"");
 return {gari:mode==="garifile"||gariHosts.has(hostname),redirect:gariHosts.has(hostname)&&hostname!=="garifile.com"};
}

// Both brands use the existing database and authorization checks. Do not create
// a second database/container merely to attach the GariFile domains.
export async function handleWebsiteRequest(req,res,url,{root,vite,mode=process.env.SITE_MODE}={}){
 const site=websiteForHost(req.headers.host,mode);
 if(!site.gari)return false;
 if(site.redirect){
  res.writeHead(308,{Location:`https://garifile.com${url.pathname}${url.search}`,"Cache-Control":"no-store"});res.end();return true;
 }
 const vehicleApi=url.pathname==="/api/login"||url.pathname==="/api/logout"||url.pathname.startsWith("/api/auth/")||url.pathname==="/api/private/vehicles"||url.pathname.startsWith("/api/private/vehicles/");
 if(url.pathname.startsWith("/api/")){
  if(vehicleApi)return false;
  res.writeHead(404,{"Content-Type":"application/json"});res.end(JSON.stringify({error:"Not found"}));return true;
 }
 // Legacy redirects remain in the main server and preserve deep links.
 if(url.pathname==="/login"||url.pathname==="/vehicles"||url.pathname.startsWith("/vehicles/")||url.pathname==="/private/vehicles"||url.pathname.startsWith("/private/vehicles/"))return false;
 if(url.pathname==="/robots.txt"){
  res.writeHead(200,{"Content-Type":"text/plain"});res.end("User-agent: *\nDisallow: /cars\nDisallow: /api/\n");return true;
 }
 const appPage=url.pathname==="/"||url.pathname==="/cars"||url.pathname.startsWith("/cars/")||url.pathname==="/garifile.html";
 if(appPage){
  let html=await readFile(path.join(root,vite?"garifile.html":"dist/garifile.html"),"utf8");
  if(vite)html=await vite.transformIndexHtml(url.pathname,html);
  res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});res.end(html);return true;
 }
 const asset=url.pathname.startsWith("/assets/")||url.pathname.startsWith("/pwa/")||["/garifile-manifest.webmanifest","/garifile-sw.js","/garifile-offline.html"].includes(url.pathname);
 const devAsset=vite&&(url.pathname.startsWith("/src/")||url.pathname.startsWith("/node_modules/")||url.pathname.startsWith("/@"));
 if(!asset&&!devAsset){
  res.writeHead(404,{"Content-Type":"text/html; charset=utf-8"});res.end('<!doctype html><title>GariFile — Page not found</title><h1>Page not found</h1><a href="/">Back to GariFile</a>');return true;
 }
 return false;
}
