import { NextResponse } from "next/server";
import { z } from "zod";
import { US_STATES } from "@/config/geo";
import sitemap from "@/config/sitemap.json";
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

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Auto-discover property details (city/state, pet policy, active sitemap pages) from a URL. */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid URL", issues: parsed.error.issues }, { status: 400 });
  }

  const targetUrl = parsed.data.url;
  const warnings: string[] = [];

  let html = "";
  try {
    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; KeywordResearchStudio/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return NextResponse.json({
        blocked: true,
        warnings: [`Site returned HTTP ${res.status} — using default sitemap and manual property fields.`],
        activePageIds: [],
        petFriendly: null,
        city: "",
        state: "",
        title: "",
      });
    }
    html = await res.text();
  } catch (e) {
    return NextResponse.json({
      blocked: true,
      warnings: [`Could not reach ${targetUrl} (${(e as Error).message}) — using defaults.`],
      activePageIds: [],
      petFriendly: null,
      city: "",
      state: "",
      title: "",
    });
  }

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripTags(titleMatch[1]) : "";
  const plainText = stripTags(html).slice(0, 40_000);

  // Detect City, ST pattern (e.g., "Denver, CO" or "Gainesville, FL")
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

  // Detect pet policy
  let petFriendly: boolean | null = null;
  if (/\b(no pets|pets are not allowed|not pet[- ]friendly)\b/i.test(plainText)) {
    petFriendly = false;
  } else if (/\b(pet[- ]friendly|pets welcome|pets allowed|dog[- ]friendly)\b/i.test(plainText)) {
    petFriendly = true;
  } else {
    warnings.push("No pet policy found on homepage — verify Pet Friendly toggle.");
  }

  // Extract internal links to activate matching sitemap pages
  const baseOrigin = new URL(targetUrl).origin;
  const hrefs = [...html.matchAll(/href=["']([^"'#]+)["']/gi)].map((m) => m[1]);
  const internalPaths = hrefs
    .map((h) => {
      try {
        const u = new URL(h, baseOrigin);
        return u.origin === baseOrigin ? u.pathname : "";
      } catch {
        return "";
      }
    })
    .filter(Boolean);

  const activeSet = new Set<string>(["home"]);
  for (const p of internalPaths) {
    for (const hint of PAGE_URL_HINTS) {
      if (hint.pattern.test(p)) activeSet.add(hint.id);
    }
  }

  const defaultPages = sitemap.pages as SitemapPage[];
  const detectedPages = defaultPages.map((p) => ({
    ...p,
    active: activeSet.size > 1 ? activeSet.has(p.id) : p.active,
  }));

  return NextResponse.json({
    blocked: false,
    title,
    city,
    state,
    petFriendly,
    activePageIds: [...activeSet],
    pages: detectedPages,
    warnings,
  });
}

