/**
 * Human review queue API (v2 WP1).
 *
 *   GET  /api/review-queue                → pending + decided rows and counts
 *   GET  /api/review-queue?format=sft     → approved rows as SFT chat JSONL
 *   GET  /api/review-queue?format=dpo     → approved rows as preference JSONL
 *   GET  /api/review-queue?format=golden  → approved rows as golden-case JSONL
 *   POST /api/review-queue                → record approve / edit-and-approve / reject
 *
 * Operator-only: every handler requires an authenticated platform principal
 * and returns 401 otherwise. Only these handlers set `reviewed: true` — no
 * scheduled job or builder can approve a row (v2 hard limit).
 */

import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedPrincipal, principalFromRequest } from "@/lib/platform/auth";
import {
  EXPORT_FORMATS,
  ReviewRowError,
  ReviewStoreError,
  exportApproved,
  listQueue,
  recordDecision,
  saveExport,
} from "@/lib/review/store";
import { REVIEW_ACTIONS, type ReviewAction } from "@/core/review/queue";

export const dynamic = "force-dynamic";

async function requireOperator(req: NextRequest): Promise<{ id: string } | null> {
  const principal = await principalFromRequest({
    header: (name: string) => req.headers.get(name),
  });
  if (!isAuthenticatedPrincipal(principal) || !principal.id.trim()) return null;
  return { id: principal.id };
}

export async function GET(req: NextRequest) {
  if (!(await requireOperator(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const format = new URL(req.url).searchParams.get("format");
  if (format) {
    if (!EXPORT_FORMATS.includes(format as (typeof EXPORT_FORMATS)[number])) {
      return NextResponse.json(
        { error: `format must be one of ${EXPORT_FORMATS.join("|")}` },
        { status: 400 },
      );
    }
    const body = await exportApproved(format as (typeof EXPORT_FORMATS)[number]);
    return new NextResponse(body, {
      status: 200,
      headers: { "content-type": "application/x-ndjson; charset=utf-8" },
    });
  }
  try {
    const snapshot = await listQueue();
    return NextResponse.json({ success: true, ...snapshot });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

interface DecisionBody {
  id?: unknown;
  action?: unknown;
  reason?: unknown;
  editedOutput?: unknown;
  persist?: unknown;
}

export async function POST(req: NextRequest) {
  const operator = await requireOperator(req);
  if (!operator) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as DecisionBody;
  const id = typeof body.id === "string" ? body.id : "";
  const action = body.action as ReviewAction;
  if (!id || !REVIEW_ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: `id and action (one of ${REVIEW_ACTIONS.join("|")}) are required` },
      { status: 400 },
    );
  }
  try {
    const row = await recordDecision({
      id,
      action,
      reviewer: operator.id,
      reason: typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : undefined,
      editedOutput: body.editedOutput,
    });
    if (body.persist === true && row.reviewed && row.decision === "approved") {
      const format = row.source === "golden_candidate" ? "golden" : row.source === "teacher_triple" ? "sft" : "dpo";
      const file = await saveExport(format);
      return NextResponse.json({ success: true, row, exportFile: file });
    }
    return NextResponse.json({ success: true, row });
  } catch (err) {
    if (err instanceof ReviewStoreError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof ReviewRowError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
