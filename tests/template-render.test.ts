/**
 * Phase E — one template renderer.
 *
 * Locks the consolidation:
 *   1. `shared/ts/template-render.ts` is the single substitution engine
 *      (mustache + fallback, exact keys, bracket tokens);
 *   2. the extension's `core/templates/template-engine.ts` is a re-export —
 *      function identity with shared, not behavioural equality;
 *   3. the deleted app copy stays deleted and no second placeholder engine
 *      exists anywhere in the product trees (source guard);
 *   4. `TemplateCustomizerView` renders through the shared engine +
 *      `validators/variableResolver` instead of its inline replace chain.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as shared from "../shared/ts/template-render";
import * as extensionEngine from "../chrome-extension/src/core/templates/template-engine";

const ROOT = process.cwd();

describe("shared/ts/template-render — the single renderer", () => {
  it("renders {{var}} tokens with dotted-path and array support", () => {
    // The extension's flat `TemplateVariables` type doesn't express the
    // nested/array runtime shapes the app copy supported — cast for the test.
    const vars = { brand: { name: "Oceanfront Palms" }, tags: ["beach", "resort"] } as unknown as
      shared.TemplateVariables;
    expect(shared.renderTemplateString("Hello {{brand.name}} — {{tags}}", vars)).toBe(
      "Hello Oceanfront Palms — beach, resort"
    );
  });

  it("applies explicit single- and double-quoted fallbacks", () => {
    const vars = { present: "yes" };
    expect(shared.renderTemplateString("{{present | fallback: \"no\"}}", vars)).toBe("yes");
    expect(shared.renderTemplateString("{{missing | fallback: 'default value'}}", vars)).toBe(
      "default value"
    );
    expect(shared.renderTemplateString(`{{missing | fallback: "default value"}}`, vars)).toBe(
      "default value"
    );
  });

  it("reports used fallbacks and missing-without-fallback tokens", () => {
    const result = shared.parseTemplateWithFallbacks(
      "{{a | fallback: 'x'}} and {{b}} and {{c}}",
      { a: "" }
    );
    expect(result.rendered).toBe("x and  and ");
    expect(result.usedFallbacks).toEqual(["a"]);
    expect(result.missingWithoutFallback).toEqual(["b", "c"]);
  });

  it("never leaks 'undefined' or 'null' into output", () => {
    const out = shared.renderTemplateString("{{a}}|{{b}}|{{c}}", { a: undefined, b: null, c: 0 });
    expect(out).toBe("||0");
    expect(out).not.toContain("undefined");
    expect(out).not.toContain("null");
  });

  it("renderTemplate keeps the deleted app copy's signature (missing → empty)", () => {
    expect(shared.renderTemplate("Hi {{name}} {{missing | fallback: 'f'}}", { name: "Ada" })).toBe(
      "Hi Ada f"
    );
    expect(shared.renderTemplate("Hi {{missing}}", {})).toBe("Hi ");
  });

  it("substituteExactPlaceholders covers {{key}}, {key} and ${key}", () => {
    const out = shared.substituteExactPlaceholders(
      "{{city}} / {city} / ${city} / {{other}}",
      { city: "Denver" }
    );
    expect(out).toBe("Denver / Denver / Denver / {{other}}");
    // Missing values render as empty — never the literal "undefined".
    expect(shared.substituteExactPlaceholders("{{gone}}", { gone: undefined })).toBe("");
  });

  it("renderBracketTokens replaces known tokens and leaves unknown ones visible", () => {
    const tokens = {
      "[Brand Name]": "Oceanfront Palms",
      "[Empty]": "[Empty]",
    };
    const out = shared.renderBracketTokens(
      "[Brand Name] owns [Empty] and keeps [Author Name].",
      tokens
    );
    expect(out).toBe("Oceanfront Palms owns [Empty] and keeps [Author Name].");
  });
});

describe("extension template-engine wrapper — function identity", () => {
  it("re-exports the exact shared functions (identity, not equality)", () => {
    expect(extensionEngine.parseTemplateWithFallbacks).toBe(shared.parseTemplateWithFallbacks);
    expect(extensionEngine.renderTemplateString).toBe(shared.renderTemplateString);
    expect(extensionEngine.resolveVariableValue).toBe(shared.resolveVariableValue);
  });

  it("behaves identically for the extension's flat-variable contract", () => {
    const out = extensionEngine.parseTemplateWithFallbacks(
      "{{brandName | fallback: \"Brand\"}} — {{origin | fallback: '/'}}",
      { brandName: "The Curtis Denver" }
    );
    expect(out.rendered).toBe("The Curtis Denver — /");
    expect(out.usedFallbacks).toEqual(["origin"]);
  });
});

describe("source guards — no second renderer survives", () => {
  it("deleted the zero-consumer app copy", () => {
    expect(existsSync(join(ROOT, "src/core/templates/template-engine.ts"))).toBe(false);
    // The sibling module that `@/core/templates` actually resolves to stays.
    expect(existsSync(join(ROOT, "src/core/templates.ts"))).toBe(true);
  });

  it("no placeholder engine regex is defined outside shared/ts", () => {
    const roots = ["src", "chrome-extension/src", "validators", "exporters", "schemas"];
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
        } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
          const source = readFileSync(full, "utf8");
          if (/(?:const|let|var)\s+(?:TOKEN_REGEX|PLACEHOLDER_REGEX)\s*=/.test(source)) {
            offenders.push(full);
          }
        }
      }
    };
    for (const root of roots) walk(join(ROOT, root));
    expect(offenders).toEqual([]);
  });

  it("TemplateCustomizerView renders through the shared engine, not an inline chain", () => {
    const source = readFileSync(join(ROOT, "src/components/TemplateCustomizerView.tsx"), "utf8");
    expect(source).not.toContain("/\\[Brand Name\\]/g");
    expect(source).toContain("renderBracketTokens");
    expect(source).toContain("resolveTemplate");
    expect(source).toContain("escapeHtml");
  });
});
