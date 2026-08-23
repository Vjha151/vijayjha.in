import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const vite = await createServer({appType:"custom",logLevel:"silent",server:{middlewareMode:true}});
const {VehicleSidebar} = await vite.ssrLoadModule("/src/components/VehicleSidebar.tsx");
const markup = renderToStaticMarkup(React.createElement(VehicleSidebar,{name:"Vijay",active:"vehicles"}));
await vite.close();

const styles = await readFile(new URL("../src/style.css",import.meta.url),"utf8");
const sidebarMarkup = markup.match(/<aside[^>]*id="customer-sidebar"[\s\S]*?<\/aside>/)?.[0]||"";
const customerLinks = [...sidebarMarkup.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];

test("rendered customer sidebar DOM contains all nine actions",()=>{
 assert.ok(sidebarMarkup,"customer sidebar was not rendered");
 assert.equal(customerLinks.length,9);
 for(const label of ["Dashboard","Vehicles","Reminders","Documents","Locations","Sharing &amp; Users","Reports","Settings","Sign out"])
  assert.ok(sidebarMarkup.includes(label),`rendered sidebar is missing ${label}`);
 assert.doesNotMatch(sidebarMarkup,/\/admin|Admin Dashboard|Platform Admin/);
});

test("rendered sidebar uses the expected customer routes",()=>{
 assert.deepEqual(customerLinks.map(link=>link[1]),[
  "/cars#dashboard","/cars","/cars#reminders","/cars#documents","/cars/account#locations",
  "/cars/account#sharing","/api/private/vehicles/export?format=xlsx","/cars/account","/api/logout"
 ]);
});

test("public mobile nav transform is neutralized for actual customer nav and pager",()=>{
 const publicRule=styles.indexOf("nav{position:fixed;inset:82px 0 auto");
 const portalReset=styles.indexOf(".vm .vm-sidebar-links,.vm .vm-pages{position:static;inset:auto;transform:none");
 assert.ok(publicRule>=0,"expected public mobile navigation rule");
 assert.ok(portalReset>publicRule,"customer navigation reset must follow the generic public rule in the cascade");
 for(const width of [360,390,412])assert.ok(width<=900);
});
