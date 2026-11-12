import { NextResponse } from "next/server";
import { bucketKeywords } from "@/lib/engine/bucket";
import { runSelection } from "@/lib/engine/select";
import { selectionRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";

/** Page-to-keyword matcher (KD < 45 rule + high-volume exception flag). */
export async function POST(req: Request) {
  const parsed = selectionRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const { keywords, pages, template, rules } = parsed.data;
  // Accept pre-bucketed keywords; bucket any that are missing for robustness.
  const bucketed = keywords.some((k) => !k.bucketId) ? bucketKeywords(keywords) : keywords;
  return NextResponse.json(runSelection(bucketed, pages, template, rules));
}
