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
  assert.match(styles, /\.vm-sidebar\{[^}]*overflow-y:auto[^}]*overscroll-behavior:contain/);
  assert.match(styles, /\.vm-sidebar nav\{display:grid;flex:none/);
  assert.match(styles, /\.vm-sidebar-brand\{display:grid;flex:none/);
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
  assert.match(editor, /DocumentPhotoEditor/);
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
