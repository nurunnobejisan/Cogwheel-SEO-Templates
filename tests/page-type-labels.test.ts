/**
 * Phase 4 — additive `PageTypeLabel` extension (D-008).
 *
 * The vault's label set converges with `MlPageTypeLabels`
 * (schemas/ml-example.ts): the eight original labels stay, the seven
 * additive ones (dining, spa, offers, meetings_events, faq, gallery,
 * contact) become producible by `classifyPageType`, and the app copy and
 * the extension copy of `training-vault.ts` classify identically.
 */

import { describe, expect, it } from "vitest";
import {
  classifyPageType as classifyApp,
  type PageTypeLabel,
  type RawWebInput,
} from "../src/storage/training-vault";
import { classifyPageType as classifyExt } from "../chrome-extension/src/storage/training-vault";
import { MlPageTypeLabels } from "../schemas/ml-example";

const raw: RawWebInput = {
  url: "",
  canonicalUrl: "",
  domain: "example.com",
  rawTitle: "",
  rawMetaDesc: "",
  rawH1: [],
  rawH2: [],
  rawBodyText: "",
} as unknown as RawWebInput;

const NEW_LABELS: Array<[string, PageTypeLabel]> = [
  ["https://example.com/dining", "dining"],
  ["https://example.com/restaurant", "dining"],
  ["https://example.com/spa", "spa"],
  ["https://example.com/wellness", "spa"],
  ["https://example.com/offers", "offers"],
  ["https://example.com/deals/summer", "offers"],
  ["https://example.com/meetings", "meetings_events"],
  ["https://example.com/events/weddings", "meetings_events"],
  ["https://example.com/faq", "faq"],
  ["https://example.com/gallery", "gallery"],
  ["https://example.com/contact", "contact"],
];

const ORIGINAL_LABELS: Array<[string, PageTypeLabel]> = [
  ["https://example.com/", "hotel_homepage"],
  ["https://example.com/rooms", "room_details"],
  ["https://example.com/amenities", "amenities"],
  ["https://example.com/pool", "amenities"],
  ["https://example.com/reservations", "booking"],
  ["https://example.com/location", "location"],
  ["https://example.com/blog/post", "article"],
];

describe("Phase 4 — PageTypeLabel extension (D-008)", () => {
  it("classifies the seven additive labels in the app copy", () => {
    for (const [url, expected] of NEW_LABELS) {
      expect(classifyApp(url, raw), url).toBe(expected);
    }
  });

  it("classifies identically in the extension copy", () => {
    for (const [url, expected] of [...NEW_LABELS, ...ORIGINAL_LABELS]) {
      expect(classifyExt(url, raw), url).toBe(expected);
      expect(classifyExt(url, raw), url).toBe(classifyApp(url, raw));
    }
  });

  it("keeps every original classification behaviour", () => {
    for (const [url, expected] of ORIGINAL_LABELS) {
      expect(classifyApp(url, raw), url).toBe(expected);
    }
    // the migration fixture from Task 1.3 still lands where it always did
    expect(
      classifyApp("https://www.marriott.com/hotels/travel/ecpsb/", {
        ...raw,
        rawBodyText: "book a room with a rate",
      }),
    ).toBe("landing_page");
  });

  it("vault labels are exactly the ML superset (converged vocabulary)", () => {
    // Runtime convergence: the ML vocabulary has 8 original + 7 additive.
    expect(MlPageTypeLabels).toHaveLength(15);
    const vaultLabels: PageTypeLabel[] = [
      "hotel_homepage",
      "room_details",
      "amenities",
      "booking",
      "location",
      "article",
      "landing_page",
      "other",
      "dining",
      "spa",
      "offers",
      "meetings_events",
      "faq",
      "gallery",
      "contact",
    ];
    expect(new Set(MlPageTypeLabels)).toEqual(new Set(vaultLabels));

    // Type-level: every PageTypeLabel member is accepted by the ML schema —
    // a label dropped from either list fails this compile.
    const exhaustive: Record<PageTypeLabel, true> = {
      hotel_homepage: true,
      room_details: true,
      amenities: true,
      booking: true,
      location: true,
      article: true,
      landing_page: true,
      other: true,
      dining: true,
      spa: true,
      offers: true,
      meetings_events: true,
      faq: true,
      gallery: true,
      contact: true,
    };
    expect(Object.keys(exhaustive)).toHaveLength(15);
  });
});
