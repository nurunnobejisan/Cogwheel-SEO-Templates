/**
 * Hotel Mode — Domain-Isolated Hospitality Ruleset
 *
 * These rules only execute when the target is classified as Hotel Mode. They
 * extend (never replace) the Universal ruleset so existing hospitality
 * workflows remain 100% operational. Room-type / rate-plan / OTA-parity deep
 * checks continue to live in the existing hotel task modules and templates.
 */

import type { AuditIssue, AuditRule, JsonLdNode, RuleContext } from "../types.ts";
import { makeIssue } from "../issues.ts";
import { HOTEL_JSONLD_TYPES } from "../context/detect-mode.ts";

const REQUIRED_HOTEL_PROPERTIES = ["name", "address", "telephone"] as const;
const RECOMMENDED_HOTEL_PROPERTIES = ["priceRange", "amenityFeature", "starRating"] as const;

function findLodgingNode(jsonLd: JsonLdNode[]): JsonLdNode | null {
  for (const node of jsonLd) {
    const raw = node["@type"];
    const types = typeof raw === "string" ? [raw] : Array.isArray(raw) ? raw : [];
    if (types.some((type) => typeof type === "string" && HOTEL_JSONLD_TYPES.includes(type))) {
      return node;
    }
  }
  return null;
}

export const lodgingSchemaPresenceRule: AuditRule = {
  id: "hotel/schema/lodgingbusiness-presence",
  pillar: "hospitality",
  description: "Hospitality properties require a LodgingBusiness-family JSON-LD node.",
  evaluate({ snapshot }) {
    if (findLodgingNode(snapshot.jsonLd)) {
      return [];
    }
    return [
      makeIssue({
        issueId: "iss_hotel_schema_missing",
        category: "hospitality",
        severity: "high",
        cmsTargetField: "json_ld_schema",
        currentValue: null,
        selector: "script[type='application/ld+json']",
        recommendedAction:
          "Add a LodgingBusiness/Hotel JSON-LD node with name, address, telephone and geo.",
      }),
    ];
  },
};

export const lodgingSchemaPropertiesRule: AuditRule = {
  id: "hotel/schema/required-properties",
  pillar: "hospitality",
  description: "Validate required and recommended LodgingBusiness properties.",
  evaluate({ snapshot }) {
    const node = findLodgingNode(snapshot.jsonLd);
    if (!node) {
      return [];
    }
    const issues: AuditIssue[] = [];

    for (const property of REQUIRED_HOTEL_PROPERTIES) {
      const value = node[property];
      if (value === undefined || value === null || value === "") {
        issues.push(
          makeIssue({
            issueId: "iss_hotel_schema_property_missing",
            category: "hospitality",
            severity: "medium",
            cmsTargetField: "json_ld_schema",
            currentValue: property,
            selector: `script[type='application/ld+json'] ${property}`,
            recommendedAction: `Populate the "${property}" property on the LodgingBusiness schema.`,
          })
        );
      }
    }

    for (const property of RECOMMENDED_HOTEL_PROPERTIES) {
      const value = node[property];
      if (value === undefined || value === null || value === "") {
        issues.push(
          makeIssue({
            issueId: "iss_hotel_schema_property_recommended_missing",
            category: "hospitality",
            severity: "low",
            cmsTargetField: "json_ld_schema",
            currentValue: property,
            selector: `script[type='application/ld+json'] ${property}`,
            recommendedAction: `Add the recommended "${property}" property to enrich the property entity.`,
          })
        );
      }
    }

    return issues;
  },
};

export const bookingEngineRule: AuditRule = {
  id: "hotel/booking/engine-presence",
  pillar: "hospitality",
  description: "Hotel pages should expose a detectable direct-booking engine.",
  evaluate({ snapshot }) {
    const hasEngine = snapshot.scriptSrcs.some((src) => {
      const lower = src.toLowerCase();
      return (
        lower.includes("synxis") ||
        lower.includes("booking") ||
        lower.includes("mews") ||
        lower.includes("cloudbeds") ||
        lower.includes("travelclick")
      );
    });
    if (hasEngine || snapshot.reservationWidgets) {
      return [];
    }
    return [
      makeIssue({
        issueId: "iss_hotel_booking_engine_missing",
        category: "hospitality",
        severity: "low",
        fixable: false,
        cmsTargetField: null,
        currentValue: null,
        selector: "[data-booking-engine]",
        recommendedAction:
          "Expose a direct-booking engine or reservation widget so guests can convert on-site.",
      }),
    ];
  },
};

export const HOTEL_RULES: AuditRule[] = [
  lodgingSchemaPresenceRule,
  lodgingSchemaPropertiesRule,
  bookingEngineRule,
];

/** Execute every hotel-specific rule against the snapshot. */
export function runHotelRules(ctx: RuleContext): AuditIssue[] {
  const issues: AuditIssue[] = [];
  for (const rule of HOTEL_RULES) {
    for (const issue of rule.evaluate(ctx)) {
      issues.push(issue);
    }
  }
  return issues;
}
