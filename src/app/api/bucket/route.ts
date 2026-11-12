import { NextResponse } from "next/server";
import { bucketKeywords, summarizeBuckets } from "@/lib/engine/bucket";
import { allocatePool, matchPages } from "@/lib/engine/select";
import { selectionRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";

/** Deterministic bucketing + 78-keyword quota allocation. */
export async function POST(req: Request) {
  const parsed = selectionRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const { keywords, pages, template, rules } = parsed.data;
  const bucketed = bucketKeywords(keywords);
  const matrix = matchPages(bucketed, pages, template, rules);
  const allocation = allocatePool(bucketed, matrix, rules);
  return NextResponse.json({ keywords: bucketed, summary: summarizeBuckets(bucketed), allocation });
}
