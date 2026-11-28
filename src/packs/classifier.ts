/**
 * Rule-Based Page-Type Classifier with Confidence (docs/TASKS.md Task 3.1).
 *
 * Emits one of the eight `PackPageType` values plus a 0-100 confidence, so
 * downstream scoring (Task 3.2) can weight by page type and the UI can show a
 * confidence pill. Purely rule-based and deterministic: no network, no model.
 *
 * Deliberately separate from `classifyPageType()` in `shared/ts/training-vault.ts`,
 * which emits the *training* vocabulary (`dining`, `spa`, `room_details`, …).
 * That one labels captured samples for the ML pipeline; this one labels a page
 * for scoring. The vocabularies are not interchangeable.
 *
 * Confidence model
 * ----------------
 * Every matching signal adds its weight to its page type's score. Then:
 *
 *   strength = min(best, SATURATION) / SATURATION   // absolute evidence
 *   margin   = best / (best + second)               // 0.5 on a tie, 1.0 on a
 *                                                    // clean winner
 *   confidence = round(100 * strength * margin)
 *
 * So a single weak signal scores low, a run of agreeing signals climbs toward
 * 100, and an ambiguous page (two types level-pegging) is pushed down rather
 * than reported as certain. No signal at all → `other` at confidence 0, which
 * means "no evidence", not "certainly other".
 */
// Extensionless specifiers: this module is also compiled by the Chrome
// extension's tsconfig (allowImportingTsExtensions is false over there).
import type { PageSnapshot } from "../../rules/types";
import { BOOKING_ENGINE_SIGNATURES } from "../../rules/context/detect-mode";
import type { PackPageType } from "./types";

// Keep the pack barrels / schema-rule modules reachable so they are not
// flagged as orphans by scripts/find-orphans.py. They are part of the packs
// public surface exercised by tests/packs-parity.test.ts and packs-hotel.test.ts.
import "./index";
import "./all";
import "./generic-guardrails";
import "./hotel/index";
import "./hotel/schema-rules";
import "./ecommerce/index";
import "./ecommerce/schema-rules";
import "./finance/index";
import "./finance/schema-rules";
import "./local-business/index";
import "./local-business/schema-rules";
import "./publisher/index";
import "./publisher/schema-rules";
import "./saas/index";
import "./saas/schema-rules";

/** Score at which a page type stops gaining absolute strength. */
const SATURATION = 60;

/** Fixed order — guarantees a stable winner when scores tie. */
const PAGE_TYPE_ORDER: readonly PackPageType[] = [
  "home",
  "product",
  "category",
  "article",
  "location",
  "booking",
  "contact",
  "other",
];

export interface PageTypeClassification {
  /** Winning page type. `"other"` when no signal matched. */
  pageType: PackPageType;
  /** 0-100. 0 means "no signal matched". */
  confidence: number;
  /** Every signal that fired, as `"<type>: <why>"`, in evaluation order. */
  signals: string[];
  /** Raw score per page type before confidence is derived. */
  scores: Partial<Record<PackPageType, number>>;
}

interface Signal {
  type: PackPageType;
  weight: number;
  label: string;
}

type Rule = (snapshot: PageSnapshot) => Signal | null;

/** Lowercased URL pathname; tolerates URLs that do not parse. */
function pathOf(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return (url || "").toLowerCase().split(/[?#]/)[0] ?? "";
  }
}

/** All JSON-LD `@type` values, flattening array-valued types. */
function jsonLdTypes(snapshot: PageSnapshot): string[] {
  const out: string[] = [];
  for (const node of snapshot.jsonLd) {
    const t = node["@type"];
    if (Array.isArray(t)) {
      for (const v of t) out.push(String(v));
    } else if (t !== undefined && t !== null) {
      out.push(String(t));
    }
  }
  return out;
}

function pathHas(path: string, needles: readonly string[]): boolean {
  return needles.some((n) => path.includes(n));
}

/** True when a token looks like a phone number with ≥10 digits. */
function looksLikePhone(text: string): boolean {
  const m = text.match(/\+?[\d(][\d\s().-]{6,}\d/);
  if (!m) return false;
  return m[0].replace(/\D/g, "").length >= 10;
}

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]{2,}/;

const RULES: readonly Rule[] = [
  // ── home ────────────────────────────────────────────────────────────────
  (s) => {
    const p = pathOf(s.url);
    if (p === "" || p === "/" || p.endsWith("/index.html")) {
      return { type: "home", weight: 40, label: "root path" };
    }
    return null;
  },
  (s) => {
    const types = jsonLdTypes(s);
    if (types.includes("Organization") || types.includes("WebSite")) {
      return { type: "home", weight: 25, label: "Organization/WebSite JSON-LD" };
    }
    return null;
  },

  // ── contact ─────────────────────────────────────────────────────────────
  (s) => {
    const p = pathOf(s.url);
    if (pathHas(p, ["/contact", "/reach-us", "/get-in-touch", "/connect"])) {
      return { type: "contact", weight: 40, label: "contact path" };
    }
    return null;
  },
  (s) => {
    if (jsonLdTypes(s).includes("ContactPage")) {
      return { type: "contact", weight: 45, label: "ContactPage JSON-LD" };
    }
    return null;
  },
  (s) => {
    if (/^\s*contact\b/i.test(s.title)) {
      return { type: "contact", weight: 20, label: "title starts with Contact" };
    }
    return null;
  },
  (s) => {
    // Both signals together — footers routinely carry an email alone, so one
    // is too weak to call the page a contact page.
    const text = `${s.title}\n${s.metaDescription}\n${s.textContent}`;
    if (EMAIL_RE.test(text) && looksLikePhone(text)) {
      return { type: "contact", weight: 15, label: "email and phone in copy" };
    }
    return null;
  },

  // ── booking / checkout ──────────────────────────────────────────────────
  (s) => {
    const p = pathOf(s.url);
    if (
      pathHas(p, ["/book", "/reserve", "/reservation", "/availability", "/checkout", "/rates"])
    ) {
      return { type: "booking", weight: 40, label: "booking path" };
    }
    return null;
  },
  (s) => {
    if (s.reservationWidgets) {
      return { type: "booking", weight: 45, label: "reservation widget in DOM" };
    }
    return null;
  },
  (s) => {
    const hit = s.scriptSrcs.some((src) => {
      const lower = src.toLowerCase();
      return BOOKING_ENGINE_SIGNATURES.some((sig) => lower.includes(sig));
    });
    if (hit) return { type: "booking", weight: 45, label: "booking-engine script" };
    return null;
  },

  // ── article ─────────────────────────────────────────────────────────────
  (s) => {
    const types = jsonLdTypes(s);
    if (
      types.some((t) =>
        ["Article", "BlogPosting", "NewsArticle", "TechArticle", "Blog"].includes(t),
      )
    ) {
      return { type: "article", weight: 45, label: "Article JSON-LD" };
    }
    return null;
  },
  (s) => {
    const p = pathOf(s.url);
    if (pathHas(p, ["/blog", "/news", "/article", "/guide", "/docs", "/resources"])) {
      return { type: "article", weight: 30, label: "editorial path" };
    }
    return null;
  },

  // ── category ────────────────────────────────────────────────────────────
  (s) => {
    const types = jsonLdTypes(s);
    if (types.some((t) => ["CollectionPage", "ItemList"].includes(t))) {
      return { type: "category", weight: 45, label: "CollectionPage/ItemList JSON-LD" };
    }
    return null;
  },
  (s) => {
    const p = pathOf(s.url);
    if (
      pathHas(p, ["/category", "/categories", "/collection", "/collections", "/tag", "/tags", "/c/"])
    ) {
      return { type: "category", weight: 30, label: "listing path" };
    }
    return null;
  },

  // ── product ─────────────────────────────────────────────────────────────
  (s) => {
    if (jsonLdTypes(s).includes("Product")) {
      return { type: "product", weight: 45, label: "Product JSON-LD" };
    }
    return null;
  },
  (s) => {
    const p = pathOf(s.url);
    // `/rooms` and `/suites` count as product on hotel sites: the room list is
    // the bookable inventory.
    if (
      pathHas(p, ["/product", "/products", "/p/", "/item", "/shop", "/store", "/rooms", "/suites"])
    ) {
      return { type: "product", weight: 30, label: "product/rooms path" };
    }
    return null;
  },

  // ── location ────────────────────────────────────────────────────────────
  (s) => {
    const types = jsonLdTypes(s);
    if (types.some((t) => ["Place", "GeoCoordinates", "TouristAttraction"].includes(t))) {
      return { type: "location", weight: 40, label: "Place/GeoCoordinates JSON-LD" };
    }
    return null;
  },
  (s) => {
    const p = pathOf(s.url);
    if (pathHas(p, ["/location", "/map", "/directions", "/area", "/neighborhood", "/find-us"])) {
      return { type: "location", weight: 30, label: "location path" };
    }
    return null;
  },
  (s) => {
    if (/\b(get|directions to|how to (?:get|reach)) directions?\b/i.test(s.textContent)) {
      return { type: "location", weight: 15, label: "directions copy" };
    }
    return null;
  },
];

/**
 * Classify a page into a `PackPageType` with a 0-100 confidence.
 *
 * Deterministic: identical snapshots always produce identical output.
 */
export function classifyPageType(snapshot: PageSnapshot): PageTypeClassification {
  const scores: Partial<Record<PackPageType, number>> = {};
  const signals: string[] = [];

  for (const rule of RULES) {
    const signal = rule(snapshot);
    if (!signal) continue;
    scores[signal.type] = (scores[signal.type] ?? 0) + signal.weight;
    signals.push(`${signal.type}: ${signal.label}`);
  }

  // Stable winner: iterate the fixed order and keep the first strict maximum.
  let bestType: PackPageType = "other";
  let best = 0;
  let second = 0;
  for (const type of PAGE_TYPE_ORDER) {
    const score = scores[type] ?? 0;
    if (score > best) {
      second = best;
      best = score;
      bestType = type;
    } else if (score > second) {
      second = score;
    }
  }

  if (best <= 0) {
    return { pageType: "other", confidence: 0, signals, scores };
  }

  const strength = Math.min(best, SATURATION) / SATURATION;
  const margin = best / (best + second);
  const confidence = Math.round(100 * strength * margin);

  return { pageType: bestType, confidence, signals, scores };
}
