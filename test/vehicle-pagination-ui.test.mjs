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
  assert.match(styles, /\.vm-with-sidebar \.vm-vehicle-table\{display:block;min-width:760px\}/);
  assert.match(styles, /\.vm-with-sidebar \.vm-wrap>\.vm-quick\{display:none!important\}/);
  assert.match(styles, /\.vm-with-sidebar \.vm-pages>div\{width:100%;justify-content:center;flex-wrap:wrap\}/);
});
