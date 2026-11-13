import { NextResponse } from "next/server";
import { parseHtmlPage, validateTargetUrl } from "@/core/crawler";

export const runtime = "nodejs";

const KNOWN_BRANDS = [
  "Waldorf Astoria",
  "Conrad",
  "Canopy",
  "Curio Collection",
  "Tapestry Collection",
  "Tempo by Hilton",
  "Motto by Hilton",
  "Signia by Hilton",
  "DoubleTree",
  "Embassy Suites",
  "Homewood Suites",
  "Home2 Suites",
  "Hilton Garden Inn",
  "Hampton Inn",
  "Tru by Hilton",
  "Spark by Hilton",
  "Hilton",
  "Autograph Collection",
  "Tribute Portfolio",
  "Marriott",
  "Hyatt",
];

function inferBrand(text: string): string {
  const lower = text.toLowerCase();
  for (const brand of KNOWN_BRANDS) {
    if (lower.includes(brand.toLowerCase())) {
      return brand;
    }
  }
  return "Independent";
}

function extractCityStateFromTitle(text: string): { city: string; state: string } {
  const match = text.match(/\b([A-Z][a-zA-Z\s.-]{1,24}),\s*([A-Z]{2})\b/);
  if (match) {
    return { city: match[1].trim(), state: match[2].trim().toUpperCase() };
  }
  return { city: "", state: "" };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { url?: string };
    const rawUrl = (body.url ?? "").trim();
    if (!rawUrl) {
      return NextResponse.json({ error: "Property URL is required." }, { status: 400 });
    }

    const safeUrl = validateTargetUrl(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);

    const res = await fetch(safeUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "RazibMarketingSEOBot/1.0 (+https://razibmarketing.com)",
        Accept: "text/html,application/xhtml+xml",
      },
    }).finally(() => clearTimeout(timer));

    if (!res.ok) {
      return NextResponse.json(
        { error: `Could not fetch URL (HTTP ${res.status}).` },
        { status: 400 },
      );
    }

    const html = await res.text();
    const parsed = parseHtmlPage(safeUrl, html);

    let name = "";
    let city = "";
    let state = "";
    let brand = "";

    for (const block of parsed.jsonLd) {
      try {
        const obj = JSON.parse(block) as Record<string, unknown>;
        if (typeof obj.name === "string" && !name) {
          name = obj.name.trim();
        }
        const addr = obj.address as Record<string, unknown> | undefined;
        if (addr && typeof addr === "object") {
          if (typeof addr.addressLocality === "string" && !city) city = addr.addressLocality.trim();
          if (typeof addr.addressRegion === "string" && !state) {
            state = addr.addressRegion.trim().slice(0, 2).toUpperCase();
          }
        }
        const b = obj.brand as Record<string, unknown> | string | undefined;
        if (typeof b === "string" && !brand) brand = b.trim();
        else if (b && typeof b === "object" && typeof b.name === "string" && !brand) {
          brand = b.name.trim();
        }
      } catch {
        // ignore invalid JSON-LD block
      }
    }

    const titleText = parsed.title ?? parsed.openGraph["og:title"] ?? "";
    const h1Text = parsed.h1H6.find((h) => h.level === 1)?.text ?? "";

    if (!name) {
      name = (titleText.split("|")[0] || titleText.split("–")[0] || h1Text || new URL(safeUrl).hostname).trim();
    }

    if (!city || !state) {
      const fromText = extractCityStateFromTitle(`${titleText} ${parsed.metaDescription ?? ""} ${h1Text}`);
      if (!city) city = fromText.city;
      if (!state) state = fromText.state;
    }

    if (!brand) {
      brand = inferBrand(`${name} ${titleText} ${safeUrl}`);
    }

    return NextResponse.json({
      property: {
        name,
        brand,
        city,
        state,
        url: safeUrl,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Auto-detect failed." },
      { status: 400 },
    );
  }
}

