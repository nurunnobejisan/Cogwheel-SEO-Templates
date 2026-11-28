import { NextResponse, type NextRequest } from "next/server";
import trainedPropertiesData from "@/data/trained-properties.json";

export interface PropertySummary {
  name: string;
  brand: string;
  city: string;
  state: string;
  url: string;
  category?: string;
}

const PROPERTIES = trainedPropertiesData as PropertySummary[];

/**
 * Searches trained client properties server-side so client bundles never
 * serialize the full 300+ property dataset into HTML.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = (searchParams.get("q") ?? "").trim().toLowerCase();
  const limitParam = Number(searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitParam) ? Math.min(50, Math.max(1, limitParam)) : 20;

  const matches = query
    ? PROPERTIES.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.brand.toLowerCase().includes(query) ||
          p.city.toLowerCase().includes(query) ||
          p.state.toLowerCase().includes(query) ||
          (p.category ?? "").toLowerCase().includes(query)
      )
    : PROPERTIES;

  return NextResponse.json({
    total: PROPERTIES.length,
    matches: matches.slice(0, limit).map((p) => ({
      name: p.name,
      brand: p.brand,
      city: p.city,
      state: p.state,
      url: p.url,
      category: p.category ?? "",
    })),
  });
}
