/**
 * Page-type classification bridge (docs/TASKS.md Tasks 3.1 → 3.2).
 *
 * Runs the shared rule-based classifier (`src/packs/classifier.ts`) over the
 * extension's DOM-extracted audit payload so the sidepanel can render a
 * page-type confidence pill. The classifier needs a `PageSnapshot`; the audit
 * payload carries the same facts under different names, so this module maps
 * them and lets `createSnapshot` fill the fields the audit pass does not
 * collect (links, images, Open Graph …) with safe defaults.
 *
 * Pure and deterministic — no network, no storage — so it is unit-testable
 * outside Chrome.
 */
import { classifyPageType } from "../../../src/packs/classifier";
import type { PageTypeClassification } from "../../../src/packs/classifier";
import { createSnapshot } from "../../../rules/html-snapshot";
import type { PageAuditData } from "../types/extension";

/** Facts the content script already extracts for every audited page. */
export type PageTypeAuditInput = Pick<
  PageAuditData,
  "url" | "hostname" | "title" | "metaDesc" | "metaRobots" | "language" | "canonical" | "words" | "schemas" | "hasViewport"
>;

/** DOM signals the audit payload does not store but the DOM has at hand. */
export interface PageTypeDomSignals {
  /** Visible page copy (title + headings + body) for keyword rules. */
  textContent: string;
  /** `script[src]` values for booking-engine signature detection. */
  scriptSrcs?: string[];
  /** DOM presence of reservation widgets / booking date pickers. */
  reservationWidgets?: boolean;
}

/**
 * Classify the audited page. `confidence` is a heuristic 0-100, not a
 * measurement: 0 means "no signal matched", not "certainly other".
 */
export function classifyPageTypeForAudit(
  audit: PageTypeAuditInput,
  dom: PageTypeDomSignals
): PageTypeClassification {
  return classifyPageType(
    createSnapshot({
      url: audit.url,
      hostname: audit.hostname,
      title: audit.title,
      metaDescription: audit.metaDesc,
      canonical: audit.canonical || null,
      metaRobots: audit.metaRobots ?? null,
      language: audit.language ?? null,
      hasViewport: audit.hasViewport,
      wordCount: audit.words,
      textContent: dom.textContent,
      jsonLd: audit.schemas,
      scriptSrcs: dom.scriptSrcs ?? [],
      reservationWidgets: dom.reservationWidgets ?? false,
    })
  );
}
