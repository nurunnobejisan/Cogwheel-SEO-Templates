import { describe, it } from "node:test";
import assert from "node:assert";
import {
  resolveTemplate,
  preRenderValidate,
  postRenderScan,
  TemplateResolutionError,
  type TemplateSchema
} from "../validators/variableResolver.ts";

describe("Day 2: Strict Variable Resolver & Fallback Engine", () => {
  const sampleSchema: TemplateSchema = {
    id: "hotel-landing",
    name: "Hotel Landing Page",
    variables: {
      hotelName: { name: "hotelName", required: true },
      city: { name: "city", required: true },
      amenitiesSummary: { name: "amenitiesSummary", required: false, fallback: "modern luxury amenities" },
      discountRate: { name: "discountRate", required: false, fallback: "best available rate" }
    }
  };

  it("successfully resolves all required and optional variables with fallbacks", () => {
    const template = "Welcome to {{hotelName}} located in {city}. Enjoy our {{amenitiesSummary}} at the {discountRate}.";
    const context = {
      hotelName: "Grand Summit Hotel",
      city: "Denver"
    };

    const result = resolveTemplate(template, sampleSchema, context);
    assert.strictEqual(result.success, true);
    assert.strictEqual(
      result.output,
      "Welcome to Grand Summit Hotel located in Denver. Enjoy our modern luxury amenities at the best available rate."
    );
    assert.strictEqual(result.unresolvedPlaceholders.length, 0);
  });

  it("throws TemplateResolutionError when a required variable is missing in strict mode", () => {
    const template = "Welcome to {{hotelName}} located in {city}.";
    const context = {
      hotelName: "Grand Summit Hotel"
      // city is missing!
    };

    assert.throws(
      () => resolveTemplate(template, sampleSchema, context, { strict: true }),
      (err: any) => {
        assert(err instanceof TemplateResolutionError);
        assert(err.missingVariables.includes("city"));
        return true;
      }
    );
  });

  it("detects and rejects unresolved {{raw}}, undefined, null, or NaN in output", () => {
    const badTemplate = "Hotel: {{hotelName}}, City: {city}, Rating: undefined, Note: {{raw}}";
    const context = {
      hotelName: "Alpine Lodge",
      city: "Vail"
    };

    assert.throws(
      () => resolveTemplate(badTemplate, sampleSchema, context, { strict: true }),
      (err: any) => {
        assert(err instanceof TemplateResolutionError);
        assert(err.unresolvedPlaceholders.length > 0);
        return true;
      }
    );
  });

  it("postRenderScan accurately flags various placeholder syntaxes", () => {
    const testString = "Test {{unresolvedVar}} and {singleKey} with literal null and NaN.";
    const leaks = postRenderScan(testString);
    assert(leaks.includes("{{unresolvedVar}}"));
    assert(leaks.includes("{singleKey}"));
    assert(leaks.includes("null"));
    assert(leaks.includes("NaN"));
  });
});
