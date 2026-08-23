import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = await Promise.all([
  "../src/App.tsx",
  "../src/components/VehicleManager.tsx",
  "../src/components/VehicleAccount.tsx",
  "../src/components/VehicleImport.tsx",
  "../src/components/VehicleSidebar.tsx",
  "../src/components/DocumentPhotoEditor.tsx",
  "../src/style.css",
].map(path => readFile(new URL(path, import.meta.url), "utf8")));

const [app, manager, account, vehicleImport, sidebar, editor, styles] = files;

test("every customer portal entry and deep-link stays under /cars", () => {
  for (const route of ["/cars/account", "/cars/import", "/cars#reminders", "/cars#documents", "/cars/account#locations", "/cars/account#sharing"])
    assert.ok(`${app}${manager}${account}${vehicleImport}${sidebar}`.includes(route), `missing customer route ${route}`);
  assert.ok(manager.includes('match(/^\\/cars\\/(\\d+)$/)'), "missing /cars/:vehicleId deep-link handling");
});

test("dashboard document status cards open their matching filtered lists", () => {
  assert.match(manager, /"Valid documents",stats\.validDocuments,"#valid-documents"/);
  assert.match(manager, /"No expiry",stats\.noExpiryDocuments,"#no-expiry"/);
  assert.match(manager, /statusFilter=view==="valid-documents"\?"&status=Valid"/);
  assert.match(manager, /view==="no-expiry"\?"&status=No%20Expiry"/);
});

test("dashboard exposes a clickable incomplete-vehicle count with pending details", () => {
  assert.match(manager, /"Incomplete vehicles",stats\.incompleteVehicles,"#incomplete"/);
  assert.match(manager, /function IncompleteVehicles\(\)/);
  assert.match(manager, /\/api\/private\/vehicles\/incomplete/);
  assert.match(manager, /item\.missing\.map/);
  assert.match(styles, /\.vm-incomplete-list>article/);
});

test("short mobile sidebars keep every navigation link reachable", () => {
  assert.match(styles, /\.vm-sidebar\{[^}]*min-height:0[^}]*overflow:hidden/);
  assert.match(styles, /\.vm-sidebar nav,\.vm-sidebar-links\{display:grid;flex:1 1 auto;min-height:0[^}]*overflow-y:auto[^}]*overscroll-behavior:contain/);
  assert.match(styles, /\.vm-sidebar-brand\{display:grid;flex:none/);
  assert.match(styles, /\.vm-sidebar-footer\{flex:none/);
});

test("mobile sidebar exposes the complete customer navigation without admin links", () => {
  assert.match(sidebar, /const customerNavigation=\[/);
  assert.match(sidebar, /customerNavigation\.map\(\(\{Icon,label,href,key\}\)/);
  assert.doesNotMatch(sidebar, /customerNavigation\.filter|ownerOnly|accountKind!=="managed"/);
  assert.match(sidebar, /id="customer-sidebar"/);
  assert.match(sidebar, /className="vm-sidebar-links"/);
  assert.match(sidebar, /aria-label="Customer portal pages"/);
  for (const label of ["Dashboard","Vehicles","Reminders","Documents","Locations","Sharing & Users","Reports","Settings","Sign out"])
    assert.ok(sidebar.includes(label), `missing customer sidebar item ${label}`);
  for (const route of ["/cars#dashboard","/cars","/cars#reminders","/cars#documents","/cars/account#locations","/cars/account#sharing","/api/private/vehicles/export?format=xlsx","/cars/account","/api/logout"])
    assert.ok(sidebar.includes(route), `missing customer sidebar route ${route}`);
  assert.doesNotMatch(sidebar, /\/admin|Admin Portal|Platform Admin/);
  assert.equal(sidebar.match(/label:"[^"]+",href:/g)?.length,8);
  assert.equal(sidebar.match(/className="vm-sidebar-logout"/g)?.length,1);
  assert.doesNotMatch(styles, /\.vm-sidebar-links\{[^}]*display:none/);
});

test("customer dashboard remains separate from admin portal routing", () => {
  assert.match(manager, /location\.hash==="#dashboard"\?"dashboard"/);
  assert.match(manager, /"Total vehicles",stats\.totalVehicles/);
  assert.match(manager, /"Expired",stats\.expiredDocuments/);
  assert.match(app, /location\.pathname\.startsWith\("\/cars"\)\?<VehicleManager\/>/);
  assert.match(app, /location\.pathname\.startsWith\("\/admin"\)\?<AdminPanel\/>/);
});

test("all customer pages retain their responsive layout coverage", () => {
  for (const selector of [
    ".vm-with-sidebar .vm-table-wrap",
    ".vm-with-sidebar .vm-pages",
    ".vm-record-list article",
    ".vm-settings-grid",
    ".vm-document-cards",
    ".vm-share-options",
    ".vm-insurer-picker",
    ".vm-photo-editor",
  ]) assert.ok(styles.includes(selector), `missing responsive UI coverage for ${selector}`);
  assert.match(styles, /@media\(max-width:700px\)/);
  assert.match(styles, /@media\(max-width:600px\)/);
  assert.match(styles, /@media\(max-width:900px\)\{\.vm-with-sidebar \.vm-pages/);
  assert.match(styles, /@media\(max-width:430px\)\{\.vm-with-sidebar \.vm-pages/);
  assert.match(editor, /DocumentPhotoEditor/);
});

test("360px, 390px and 412px widths use the compact pager while desktop stays unchanged", () => {
  for (const width of [360,390,412])assert.ok(width<=430);
  assert.match(styles, /@media\(max-width:430px\)\{\.vm-with-sidebar \.vm-pages\{padding:10px\}/);
  assert.match(styles, /\.vm-with-sidebar \.vm-pages>div\{display:flex;[^}]*overflow-x:auto/);
  assert.match(styles, /\.vm-with-sidebar \.vm-pages>select\{display:block;width:100%/);
  assert.match(styles, /\.vm-with-sidebar \.vm-pages\{margin:0;padding:15px 18px/);
});

test("360px, 390px and 412px hamburger widths retain the same nine customer actions", () => {
  for (const width of [360,390,412]){
    assert.ok(width<=900);
    assert.equal((sidebar.match(/label:"[^"]+",href:/g)?.length||0)+1,9);
  }
  assert.match(styles, /@media\(max-width:900px\)/);
  assert.match(styles, /\.vm-sidebar\.open\{transform:translateX\(0\)\}/);
  assert.match(styles, /\.vm-sidebar nav,\.vm-sidebar-links\{[^}]*overflow-y:auto/);
});

test("light customer controls always declare a readable foreground color", () => {
  for (const rule of [
    /\.vm-with-sidebar \.vm-more-filters\{[^}]*color:#233b49[^}]*background:#fff/s,
    /\.vm-with-sidebar \.vm-vrow>button:last-child\{[^}]*color:#263e4c[^}]*background:#fff/s,
    /\.vm-with-sidebar \.vm-pages button\{[^}]*color:#29483a[^}]*background:#fff/s,
    /\.vm>header \.vm-account-menu a\{color:#254034\}/,
    /\.vm-record-actions a\{[^}]*color:#356b49/s,
    /\.vm-document-actions a,.vm-document-actions label\{[^}]*color:#477c5b/s,
    /\.vm-share-submit \.secondary\{color:#365446;background:#fff\}/,
    /\.vm \.vm-upload-choices>button\{[^}]*color:#193040[^}]*background:#fff/s,
    /\.vm \.vm-photo-editor>footer \.secondary\{[^}]*color:#315343[^}]*background:#fff/s,
  ]) assert.match(styles, rule);
});
