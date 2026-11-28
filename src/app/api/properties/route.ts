import { NextResponse } from "next/server";
import properties from "@/data/trained-properties.json";
import { requireOperator } from "@/lib/auth/requireOperator";

export const dynamic = "force-dynamic";

type RosterRow = {
  name?: string;
  brand?: string;
  city?: string;
  state?: string;
  url?: string;
  category?: string;
  propertyType?: string;
  slidesUrl?: string;
  backlinkSlidesUrl?: string;
};

const SUMMARIES = (properties as RosterRow[]).map((property) => ({
  name: property.name ?? "",
  brand: property.brand ?? "",
  city: property.city ?? "",
  state: property.state ?? "",
  url: property.url ?? "",
  category: property.category ?? "",
  propertyType: property.propertyType ?? "",
  slidesUrl: property.slidesUrl ?? "",
  backlinkSlidesUrl: property.backlinkSlidesUrl ?? "",
}));

/** Authenticated, bounded search: the roster is never shipped in page HTML. */
export async function GET(req: Request) {
  const denied = await requireOperator({ headers: req.headers });
  if (denied) {
    return denied;
  }
  const query = new URL(req.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  const results = (query
    ? SUMMARIES.filter((property) =>
        [property.name, property.brand, property.city, property.state, property.category].some((field) =>
          field.toLowerCase().includes(query),
        ),
      )
    : SUMMARIES
  ).slice(0, 25);

  return NextResponse.json({ total: SUMMARIES.length, results });
}
