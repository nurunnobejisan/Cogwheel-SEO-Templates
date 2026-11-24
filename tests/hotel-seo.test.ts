import { describe, it } from "node:test";
import assert from "node:assert";
import {
  PropertyAuditSchema,
  GeoSignalsSchema,
  TemplatePayloadSchema,
  HotelSeoAuditSchema,
  validatePropertyAudit,
  validateGeoSignals,
  validateTemplatePayload,
  validateHotelSeoAudit,
  type PropertyAudit,
  type GeoSignals,
  type TemplatePayload,
  type HotelSeoAudit,
} from "../src/types/seo.ts";

describe("Hotel SEO & GEO Zod Schemas", () => {
  const validProperty: PropertyAudit = {
    url: "https://www.marriott.com/hotels/travel/ecpsb-springhill-suites-panama-city-beachfront/",
    hotelName: "SpringHill Suites Panama City Beachfront",
    brand: "Marriott Bonvoy",
    city: "Panama City Beach",
    neighborhood: "Front Beach Road",
    title: "Beachfront Hotels Panama City Beach | SpringHill Suites",
    metaDescription: "Stay beachfront in Panama City Beach, FL. Enjoy oceanfront suites, lazy river pool, and free hot breakfast.",
    h1: "SpringHill Suites Panama City Beachfront",
    canonical: "https://www.marriott.com/hotels/travel/ecpsb-springhill-suites-panama-city-beachfront/",
    wordCount: 485,
  };

  const validGeoSignals: GeoSignals = {
    hasHotelSchema: true,
    hasFaqSchema: true,
    entityDensityScore: 88.5,
    citationReadinessScore: 92.0,
    missingEntities: ["St. Andrews State Park distance", "Pier Park transit shuttle"],
  };

  const validTemplatePayload: TemplatePayload = {
    templateId: "title-meta-suite",
    variables: {
      targetKeyword: "Beachfront Hotels Panama City Beach",
      hotelName: "SpringHill Suites",
      cityName: "Panama City Beach",
    },
    renderedOutput: "<title>Beachfront Hotels Panama City Beach | SpringHill Suites</title>",
    validationWarnings: [],
  };

  it("validates a complete and compliant PropertyAudit payload", () => {
    const validated = validatePropertyAudit(validProperty);
    assert.strictEqual(validated.hotelName, "SpringHill Suites Panama City Beachfront");
    assert.strictEqual(validated.brand, "Marriott Bonvoy");
    assert.strictEqual(validated.wordCount, 485);
  });

  it("rejects PropertyAudit with invalid URL or negative word count", () => {
    assert.throws(() => {
      validatePropertyAudit({
        ...validProperty,
        url: "not-a-valid-url",
      });
    });

    assert.throws(() => {
      validatePropertyAudit({
        ...validProperty,
        wordCount: -10,
      });
    });
  });

  it("rejects extra unknown properties on PropertyAudit (strict validation)", () => {
    assert.throws(() => {
      PropertyAuditSchema.parse({
        ...validProperty,
        extraInjectionField: "malicious_or_unknown",
      });
    });
  });

  it("validates GeoSignals within 0-100 score bounds", () => {
    const validated = validateGeoSignals(validGeoSignals);
    assert.strictEqual(validated.hasHotelSchema, true);
    assert.strictEqual(validated.entityDensityScore, 88.5);
    assert.strictEqual(validated.missingEntities.length, 2);
  });

  it("rejects GeoSignals out-of-bounds scores", () => {
    assert.throws(() => {
      validateGeoSignals({
        ...validGeoSignals,
        entityDensityScore: 105.0,
      });
    });

    assert.throws(() => {
      validateGeoSignals({
        ...validGeoSignals,
        citationReadinessScore: -5.0,
      });
    });
  });

  it("validates TemplatePayload and handles validation warnings array", () => {
    const validated = validateTemplatePayload(validTemplatePayload);
    assert.strictEqual(validated.templateId, "title-meta-suite");
    assert.strictEqual(validated.variables.cityName, "Panama City Beach");
    assert.strictEqual(validated.validationWarnings.length, 0);
  });

  it("validates unified HotelSeoAudit aggregate document", () => {
    const auditDoc: HotelSeoAudit = {
      property: validProperty,
      geoSignals: validGeoSignals,
      templatePayload: validTemplatePayload,
      auditTimestamp: new Date().toISOString(),
    };

    const validated = validateHotelSeoAudit(auditDoc);
    assert.strictEqual(validated.property.hotelName, "SpringHill Suites Panama City Beachfront");
    assert.strictEqual(validated.geoSignals.citationReadinessScore, 92.0);
    assert.strictEqual(validated.templatePayload?.templateId, "title-meta-suite");
  });
});
