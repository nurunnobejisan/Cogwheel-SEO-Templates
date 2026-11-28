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

test("flags the private client identifiers found during the privacy scrub", () => {
  const violations = scanBrandText(
    "src/example.ts",
    "const domain = 'thenines.com';\nconst legacyStyle = 'catbird';\n",
  );
  assert.equal(violations.length, 2);
  assert.match(violations[0]?.label ?? "", /The Nines/);
  assert.match(violations[1]?.label ?? "", /Catbird/);
});

test("allows documented legacy exceptions", () => {
  assert.deepEqual(
    scanBrandText("src/lib/schemas.ts", '  catbird: "supporting",\n'),
    [],
  );
  assert.deepEqual(
    scanBrandText(
      "tests/heading-auditor.test.ts",
      'expect(path).toContain("output/thenines.com/site-heading-optimized.json");\n',
    ),
    [],
  );
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
  assert.equal(isScannable("output/thenines.com/site-meta-optimized.json"), false);
  assert.equal(isScannable("chrome-extension/src/data/seoStudioTemplates.ts"), false);
  assert.equal(isScannable("scripts/check-brand-hygiene.ts"), false);
  assert.equal(isScannable("docs/ENGINEERING_STANDARDS.md"), true);
});
