import assert from "node:assert/strict";
import test from "node:test";

import { isScannable, scanBrandText } from "../../scripts/check-brand-hygiene";

test("flags private client brands in file contents", () => {
  const violations = scanBrandText("src/example.ts", "const owner = 'Razib Marketing';\n");
  assert.equal(violations.length, 1);
  assert.equal(violations[0]?.line, 1);
  assert.match(violations[0]?.label ?? "", /Razib/);
});

test("flags private client brands in file paths", () => {
  const violations = scanBrandText("src/legacy/cogwheel-rules.ts", "");
  assert.equal(violations.length, 1);
  assert.equal(violations[0]?.line, 0);
});

test("allows public hotel-chain vocabulary used by the audit engine", () => {
  const violations = scanBrandText(
    "src/config/properties.json",
    '{ "brand": "Hilton Garden Inn", "chain": "Marriott", "property": "SpringHill Suites" }',
  );
  assert.deepEqual(violations, []);
});

test("skips binary and generated artifacts", () => {
  assert.equal(isScannable("public/seo-studio.zip"), false);
  assert.equal(isScannable("tsconfig.tsbuildinfo"), false);
  assert.equal(isScannable("scripts/check-brand-hygiene.ts"), false);
  assert.equal(isScannable("docs/ENGINEERING_STANDARDS.md"), true);
});
