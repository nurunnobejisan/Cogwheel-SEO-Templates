/**
 * Domain & Context Detection Layer
 *
 * Classifies a target URL as Hotel Mode (existing hospitality ruleset) or
 * Universal Mode (general web standards). Detection is additive and
 * non-destructive: when no hotel signal is present the platform defaults to
 * Universal Mode without altering any hotel workflow.
 */

import type { AuditMode, ModeDetection, PageSnapshot } from "../types.ts";
import { createMemoryOverrideStore, type ModeOverrideStore } from "./mode-override.ts";

/**
 * Schema.org types that identify a hospitality property. Covers LodgingBusiness
 * plus its principal sub-types.
 */
export const HOTEL_JSONLD_TYPES: readonly string[] = [
  "LodgingBusiness",
  "Hotel",
  "Resort",
  "Motel",
  "Hostel",
  "BedAndBreakfast",
  "ExtendedStayHotel",
  "SkiResort",
  "Campground",
  "Inn",
];

/**
 * Known booking-engine script signatures (case-insensitive substring match
 * against script `src` values).
 */
export const BOOKING_ENGINE_SIGNATURES: readonly string[] = [
  "synxis",
  "travelclick",
  "mews",
  "cloudbeds",
  "bookingengine",
  "booking-engine",
  "bookings.engine",
  "book.ing",
  "guestreservations",
  "guest-reservations",
  "sabre",
  "innroad",
  "resnexus",
  "hotelspider",
  "sitecore-book",
];

/** Query parameters that indicate an on-page reservation flow. */
export const RESERVATION_PARAM_SIGNATURES: readonly string[] = [
  "checkin",
  "check-in",
  "checkout",
  "check-out",
  "arrival",
  "departure",
  "adults",
  "children",
  "rooms",
  "guests",
];

/** Weight per signal family; clamped to 1 at the end. */
const SIGNAL_WEIGHTS = {
  jsonLd: 0.5,
  bookingEngine: 0.3,
  reservationWidget: 0.3,
  reservationParam: 0.15,
} as const;

function collectJsonLdTypes(snapshot: PageSnapshot): string[] {
  const types: string[] = [];
  for (const node of snapshot.jsonLd) {
    const raw = node["@type"];
    if (typeof raw === "string") {
      types.push(raw);
    } else if (Array.isArray(raw)) {
      for (const entry of raw) {
        if (typeof entry === "string") {
          types.push(entry);
        }
      }
    }
  }
  return types;
}

/**
 * Detect the best-fit audit mode from DOM/schema/booking signals alone.
 * Never returns "hotel" unless at least one hospitality trigger matched.
 */
export function detectMode(snapshot: PageSnapshot): ModeDetection {
  const signals: string[] = [];
  let score = 0;

  const jsonLdTypes = collectJsonLdTypes(snapshot);
  for (const type of jsonLdTypes) {
    if (HOTEL_JSONLD_TYPES.includes(type)) {
      signals.push(`jsonld:${type}`);
      score += SIGNAL_WEIGHTS.jsonLd;
      break;
    }
  }

  for (const src of snapshot.scriptSrcs) {
    const lower = src.toLowerCase();
    const match = BOOKING_ENGINE_SIGNATURES.find((sig) => lower.includes(sig));
    if (match) {
      signals.push(`booking-engine:${match}`);
      score += SIGNAL_WEIGHTS.bookingEngine;
      break;
    }
  }

  if (snapshot.reservationWidgets) {
    signals.push("reservation-widget");
    score += SIGNAL_WEIGHTS.reservationWidget;
  }

  const paramMatch = findReservationParam(snapshot);
  if (paramMatch) {
    signals.push(`reservation-param:${paramMatch}`);
    score += SIGNAL_WEIGHTS.reservationParam;
  }

  const mode: AuditMode = signals.length > 0 ? "hotel" : "universal";

  return {
    mode,
    confidence: Math.min(1, Number(score.toFixed(2))),
    signals,
    overridden: false,
  };
}

function findReservationParam(snapshot: PageSnapshot): string | null {
  const haystacks: string[] = [snapshot.url];
  for (const link of snapshot.links) {
    haystacks.push(link.href);
  }
  for (const haystack of haystacks) {
    const lower = haystack.toLowerCase();
    const match = RESERVATION_PARAM_SIGNATURES.find((param) => {
      const pattern = new RegExp(`[?&]${param.replace(/-/g, "[-_]?")}=`);
      return pattern.test(lower);
    });
    if (match) {
      return match;
    }
  }
  return null;
}

/**
 * Resolve the execution mode, honouring the operator's manual per-domain
 * override before falling back to automatic detection.
 */
export function resolveAuditMode(
  snapshot: PageSnapshot,
  overrideStore: ModeOverrideStore = createMemoryOverrideStore()
): ModeDetection {
  const detected = detectMode(snapshot);
  const override = overrideStore.get(snapshot.hostname);
  if (override) {
    return {
      mode: override,
      confidence: 1,
      signals: [`manual-override:${override}`, ...detected.signals],
      overridden: true,
    };
  }
  return detected;
}
