import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const component = await readFile(new URL("../src/components/VehicleAccountMenu.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/style.css", import.meta.url), "utf8");

test("customer account menu labels use readable colors inside the dark header", () => {
  assert.match(component, /> Settings<\/a>/);
  assert.match(component, /> Sign out<\/a>/);
  assert.match(styles, /\.vm>header \.vm-account-menu a\{color:#254034\}/);
  assert.match(styles, /\.vm>header \.vm-account-menu a:hover\{color:#173f2c;background:#edf5f0\}/);
  assert.match(styles, /\.vm-account-menu svg\{color:#568c6b\}/);
});
