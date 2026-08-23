import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/components/VehicleManager.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/style.css", import.meta.url), "utf8");

test("vehicle pagination keeps Previous and Next labels visible", () => {
  assert.match(source, />Previous<\/button>/);
  assert.match(source, />Next<\/button>/);
  assert.match(styles, /\.vm-with-sidebar \.vm-pages button\{[^}]*color:#29483a[^}]*background:#fff/s);
});

test("vehicle pagination provides clickable numbered pages", () => {
  assert.match(source, /paginationPages\(page,list\.totalPages\)\.map/);
  assert.match(source, /aria-current=\{pageNumber===page\?"page":undefined\}/);
  assert.match(styles, /\.vm-page-numbers\{display:flex/);
  assert.match(styles, /\.vm-page-numbers button\.active\{[^}]*background:#2f8742/);
});

test("disabled and hover pagination states remain readable", () => {
  assert.match(styles, /\.vm-with-sidebar \.vm-pages button:not\(:disabled\):hover\{[^}]*color:#fff[^}]*background:#477f55/s);
  assert.match(styles, /\.vm-with-sidebar \.vm-pages button:disabled\{[^}]*color:#718078[^}]*background:#f1f4f2[^}]*opacity:1/s);
});

test("mobile vehicle table keeps every row in document flow above quick actions", () => {
  assert.match(styles, /\.vm-with-sidebar \.vm-vehicle-table\{display:flex;min-width:1180px;flex-direction:column\}/);
  assert.match(styles, /\.vm-with-sidebar \.vm-vrow\{flex:none/);
  assert.match(styles, /\.vm-with-sidebar \.vm-table-wrap\{display:block;overflow-x:auto;overflow-y:visible/);
  assert.match(styles, /\.vm-with-sidebar \.vm-vehicle-table\{display:flex;min-width:760px;flex-direction:column\}/);
  assert.match(styles, /\.vm-with-sidebar \.vm-wrap>\.vm-quick\{display:none!important\}/);
  assert.match(styles, /\.vm-with-sidebar \.vm-pages\{position:static;display:flex!important/);
});

test("all page rows precede the single pager in DOM order", () => {
  const tableIndex=source.indexOf("<VehicleTable items={list.items}");
  const pagerIndex=source.indexOf('<nav className="vm-pages" aria-label="Vehicle pages">');
  assert.ok(tableIndex>=0&&pagerIndex>tableIndex);
  assert.equal(source.match(/aria-label="Vehicle pages"/g)?.length,1);
  assert.match(source, /\{\(page-1\)\*pageSize\+i\+1\}/);
  assert.match(source, /setPage\(p=>p\+1\)/);
  assert.match(source, /setPage\(p=>p-1\)/);
});

test("mobile pagination remains in flow and horizontally accessible", () => {
  assert.doesNotMatch(source, /vm-mobile-pages/);
  assert.doesNotMatch(styles, /\.vm-with-sidebar \.vm-wrap>\.vm-pages\{display:none\}/);
  assert.match(styles, /@media\(max-width:900px\)\{\.vm-with-sidebar \.vm-pages\{position:static;display:flex!important/);
  assert.match(styles, /\.vm-with-sidebar \.vm-pages>div\{display:flex;width:100%;max-width:100%;justify-content:flex-start;gap:6px;overflow-x:auto/);
  assert.match(styles, /\.vm-with-sidebar \.vm-pages>div>button\{min-width:76px;flex:none\}/);
});
