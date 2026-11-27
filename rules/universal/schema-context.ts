/**
 * Universal Rule Engine — Contextual Schema Validation (docs/TASKS.md Task 3.3)
 *
 * Two schema rules that depend on *context* rather than mere presence:
 *
 *  1. Category/listing pages must validate against `CollectionPage`/`ItemList`.
 *     A page that looks like a listing but ships no listing structured data
 *     loses carousel / sitelink searchbox rich results.
 *  2. A standalone `Offer` must be attached to a parent entity
 *     (`Product`, `Hotel`, or `Service`). An orphaned Offer describes a price
 *     with nothing to price, so engines drop it.
 *
 * Page-type detection here mirrors the path signals in
 * `src/packs/classifier.ts` (kept local so the low-level rule engine does not
 * depend on `src/`). The classifier is the richer, confidence-scored
 * implementation; these rules only need the narrow listing-page question.
 */

import type { AuditIssue, AuditRule, JsonLdNode, PageSnapshot } from "../types.ts";
import { makeIssue } from "../issues.ts";

/** Path fragments that identify a category/listing page. */
const LISTING_PATHS: readonly string[] = [
  "/category",
  "/categories",
  "/collection",
  "/collections",
  "/tag",
  "/tags",
  "/c/",
];

/** Entity types that may act as an Offer's parent. */
const OFFER_PARENT_TYPES: readonly string[] = ["Product", "Hotel", "Service"];

/** Lowercased URL pathname; tolerates URLs that do not parse. */
function pathOf(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return (url || "").toLowerCase().split(/[?#]/)[0] ?? "";
  }
}

/** All JSON-LD `@type` values on a node, flattening array-valued types. */
function typesOf(node: JsonLdNode): string[] {
  const t = node["@type"];
  if (Array.isArray(t)) {
    return t.map((v) => String(v));
  }
  if (t !== undefined && t !== null) {
    return [String(t)];
  }
  return [];
}

function isEntityNode(node: JsonLdNode): boolean {
  return typesOf(node).some((t) => OFFER_PARENT_TYPES.includes(t));
}

/** True when the page already declares listing structured data. */
function hasListingSchema(snapshot: PageSnapshot): boolean {
  return snapshot.jsonLd.some((node) => {
    const types = typesOf(node);
    return types.includes("CollectionPage") || types.includes("ItemList");
  });
}

function looksLikeListingPage(url: string): boolean {
  const path = pathOf(url);
  return LISTING_PATHS.some((fragment) => path.includes(fragment));
}

/**
 * True when some `Product`/`Hotel`/`Service` on the page points at this Offer
 * through an `offers` entry (matched by `@id`). Catches `@graph` layouts,
 * where the parser flattens both the entity and its Offer to top level.
 */
function referencedByEntity(offer: JsonLdNode, snapshot: PageSnapshot): boolean {
  const offerId = offer["@id"];
  if (typeof offerId !== "string" || !offerId) {
    return false;
  }
  return snapshot.jsonLd.some((node) => {
    if (node === offer || !isEntityNode(node)) {
      return false;
    }
    const offers = node["offers"];
    const entries = Array.isArray(offers) ? offers : [offers];
    return entries.some((entry) => {
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        const id = (entry as JsonLdNode)["@id"];
        return id === offerId;
      }
      return false;
    });
  });
}

/** True when the Offer's own `itemOffered` names a parent-eligible entity. */
function hasItemOfferedEntity(offer: JsonLdNode): boolean {
  const item = offer["itemOffered"];
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return false;
  }
  return typesOf(item as JsonLdNode).some((t) => OFFER_PARENT_TYPES.includes(t));
}

export const categoryListingSchemaRule: AuditRule = {
  id: "universal/schema/category-listing",
  pillar: "schema",
  description:
    "Category/listing pages must declare CollectionPage or ItemList structured data.",
  evaluate({ snapshot }) {
    if (!looksLikeListingPage(snapshot.url) || hasListingSchema(snapshot)) {
      return [];
    }
    return [
      makeIssue({
        issueId: "iss_category_listing_schema_missing",
        category: "schema",
        severity: "medium",
        cmsTargetField: "json_ld_schema",
        currentValue: null,
        selector: "script[type='application/ld+json']",
        recommendedAction:
          'Add CollectionPage or ItemList JSON-LD declaring the listed items on this listing page.',
      }),
    ];
  },
};

export const offerParentEntityRule: AuditRule = {
  id: "universal/schema/offer-parent-entity",
  pillar: "schema",
  description:
    "A standalone Offer must attach to a parent Product, Hotel, or Service.",
  evaluate({ snapshot }) {
    const issues: AuditIssue[] = [];
    for (const node of snapshot.jsonLd) {
      if (!typesOf(node).includes("Offer")) {
        continue;
      }
      if (hasItemOfferedEntity(node) || referencedByEntity(node, snapshot)) {
        continue;
      }
      issues.push(
        makeIssue({
          issueId: "iss_offer_parent_missing",
          category: "schema",
          severity: "high",
          cmsTargetField: "json_ld_schema",
          currentValue: JSON.stringify(node),
          selector: "script[type='application/ld+json']",
          recommendedAction:
            "Nest the Offer inside its parent Product/Hotel/Service `offers`, or set `itemOffered` to the Product, Hotel, or Service it prices.",
        }),
      );
    }
    return issues;
  },
};

export const CONTEXTUAL_SCHEMA_RULES: AuditRule[] = [
  categoryListingSchemaRule,
  offerParentEntityRule,
];
