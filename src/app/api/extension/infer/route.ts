/**
 * Extension model-inference proxy (v2 WP8, decision D-037).
 *
 *   POST /api/extension/infer   { task, prompt, maxTokens?, temperature? }
 *
 * The Chrome extension never calls a model endpoint directly and never holds
 * model credentials: it POSTs here with its operator token and this route
 * routes the task through the SAME plumbing the app uses —
 * `generateClaudeText` with `AI_ADAPTER_MODE` rollout state, output gates,
 * canary bucketing and monitoring counters. The tuned model's endpoint and
 * key stay server-side.
 *
 * Operator-only (401 otherwise). Failures return `{ ok: false }` — never a
 * raw provider error, so the extension can degrade to its deterministic rules
 * engine. Responses never echo the prompt.
 */

import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedPrincipal, principalFromRequest } from "@/lib/platform/auth";
import { generateClaudeText } from "@/core/claude";
import { TIER1_TASKS, TIER2_TASKS } from "../../../../../ai/router";

export const dynamic = "force-dynamic";

const ALLOWED_TASKS: ReadonlySet<string> = new Set([...TIER1_TASKS, ...TIER2_TASKS]);

interface InferBody {
  task?: unknown;
  prompt?: unknown;
  maxTokens?: unknown;
  temperature?: unknown;
}

export async function POST(req: NextRequest) {
  const principal = await principalFromRequest({
    header: (name: string) => req.headers.get(name),
  });
  if (!isAuthenticatedPrincipal(principal) || !principal.id.trim()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: InferBody;
  try {
    body = (await req.json()) as InferBody;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid JSON body" }, { status: 400 });
  }

  const task = typeof body.task === "string" ? body.task.trim() : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!ALLOWED_TASKS.has(task)) {
    return NextResponse.json({ ok: false, reason: `task not allowed: ${task || "(none)"}` }, { status: 400 });
  }
  if (!prompt || prompt.length > 24_000) {
    return NextResponse.json({ ok: false, reason: "prompt missing or too long" }, { status: 400 });
  }
  const maxTokens =
    typeof body.maxTokens === "number" && Number.isFinite(body.maxTokens)
      ? Math.min(Math.max(Math.floor(body.maxTokens), 64), 4096)
      : 1024;

  try {
    const output = await generateClaudeText({
      system:
        "You are the SEO Studio inference backend serving the browser extension. " +
        "Answer with the requested artifact only. Use only facts present in the prompt; " +
        "never invent metrics, ratings, prices or amenities.",
      prompt,
      task: task as Parameters<typeof generateClaudeText>[0]["task"],
      maxTokens,
      requestId: `ext:${principal.id.slice(0, 12)}`,
    });
    const trimmed = output.trim();
    if (!trimmed) {
      return NextResponse.json({ ok: false, reason: "empty output" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, output: trimmed });
  } catch {
    // Degrade, don't leak provider errors to the extension.
    return NextResponse.json({ ok: false, reason: "inference unavailable" }, { status: 503 });
  }
}
