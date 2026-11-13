import { NextResponse } from "next/server";
import { z } from "zod";
import { US_STATES } from "@/config/geo";
import sitemap from "@/config/sitemap.json";
import { crawlTargetWebsite, UrlValidationError } from "@/core/crawler";
import type { SitemapPage } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const bodySchema = z.object({
  url: z.string().trim().url("Please enter a valid property URL (https://...)"),
});

const PAGE_URL_HINTS: Array<{ id: string; pattern: RegExp }> = [
  { id: "rooms", pattern: /\/rooms?\b|accommodat/i },
  { id: "suites", pattern: /\/suites?\b/i },
  { id: "dining", pattern: /\/dining\b|restaurant|eat|food/i },
  { id: "bar", pattern: /\/bar\b|rooftop|lounge/i },
  { id: "events", pattern: /\/events?\b/i },
  { id: "meetings", pattern: /\/meetings?\b|conference/i },
  { id: "weddings", pattern: /\/weddings?\b/i },
  { id: "offers", pattern: /\/offers?\b|special|deals?|packages?/i },
  { id: "extended-stay", pattern: /extended[-_ ]?stay/i },
  { id: "location", pattern: /\/location\b|explore|local|area|things[-_ ]to[-_ ]do|neighborhood/i },
  { id: "amenities", pattern: /\/amenities\b|fitness|pool/i },
  { id: "pets", pattern: /\/pets?\b|pet[-_ ]?friendly|dog/i },
  { id: "hotel-info", pattern: /\/hotel[-_ ]?info\b|about|faq/i },
  { id: "gallery", pattern: /\/gallery\b|photos?/i },
];

/** Auto-discover property details (city/state, pet policy, active sitemap pages) from a URL. */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid URL", issues: parsed.error.issues }, { status: 400 });
  }

  let crawlResult;
  try {
    crawlResult = await crawlTargetWebsite(parsed.data.url);
  } catch (e) {
    if (e instanceof UrlValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({
      blocked: true,
      warnings: [`Could not reach ${parsed.data.url} (${(e as Error).message}) — using defaults.`],
      activePageIds: [],
      petFriendly: null,
      city: "",
      state: "",
      title: "",
    });
  }

  if (crawlResult.blocked) {
    return NextResponse.json({
      blocked: true,
      warnings:
        crawlResult.warnings.length > 0
          ? crawlResult.warnings
          : [`Could not reach ${parsed.data.url} — using defaults.`],
      activePageIds: [],
      petFriendly: null,
      city: "",
      state: "",
      title: "",
    });
  }

  const warnings = [...crawlResult.warnings];
  const plainText = crawlResult.plainText;

  let city = "";
  let state = "";
  const cityStateMatches = [...plainText.matchAll(/\b([A-Z][a-zA-Z.\s]{2,24}),\s*([A-Z]{2})\b/g)];
  for (const m of cityStateMatches) {
    const code = m[2].toUpperCase();
    if (US_STATES[code]) {
      city = m[1].trim();
      state = code;
      break;
    }
  }
  if (!city || !state) {
    warnings.push("Could not confidently detect City/State from page text.");
  }

  let petFriendly: boolean | null = null;
  if (/\b(no pets|pets are not allowed|not pet[- ]friendly)\b/i.test(plainText)) {
    petFriendly = false;
  } else if (
    crawlResult.services.includes("pet_friendly") ||
    /\b(pet[- ]friendly|pets welcome|pets allowed|dog[- ]friendly)\b/i.test(plainText)
  ) {
    petFriendly = true;
  } else {
    warnings.push("No pet policy found on homepage — verify Pet Friendly toggle.");
  }

  const activeSet = new Set<string>(["home"]);
  for (const crawledUrl of crawlResult.crawledUrls) {
    try {
      const path = new URL(crawledUrl).pathname;
      for (const hint of PAGE_URL_HINTS) {
        if (hint.pattern.test(path)) activeSet.add(hint.id);
      }
    } catch {
      // ignore
    }
  }

  const defaultPages = sitemap.pages as SitemapPage[];
  const detectedPages = defaultPages.map((p) => ({
    ...p,
    active: activeSet.size > 1 ? activeSet.has(p.id) : p.active,
  }));

  return NextResponse.json({
    blocked: false,
    title: crawlResult.pageTitle,
    city,
    state,
    petFriendly,
    activePageIds: [...activeSet],
    pages: detectedPages,
    services: crawlResult.serviceLabels,
    pageTopics: crawlResult.pageTopics,
    warnings,
  });
}
