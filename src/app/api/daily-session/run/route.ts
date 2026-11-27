/**
 * /api/daily-session/run — agent execution for the active phase
 *
 *   POST { phase: "learn" | "build" | "community" }
 *
 * Runs the matching agent, persists its artifact, then returns the updated
 * session. The `processing` latch in the orchestrator is set first, so a second
 * click while an agent is working returns 409 instead of launching a duplicate
 * background job.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAuthenticatedPrincipal, principalFromRequest } from "@/lib/platform/auth";
import { loadDailySessionConfig } from "@/lib/daily-session/config";
import { SessionError, currentSession, updateArtifact } from "@/lib/daily-session/orchestrator";
import { dailySessionSchema } from "@/lib/daily-session/types";
import { runCommunityAgent } from "@/lib/daily-session/agents/community";
import { runLearningAgent } from "@/lib/daily-session/agents/learning";
import { runCodingAgent } from "@/lib/daily-session/agents/coding";
import { saveLearningNote } from "@/lib/daily-session/agents/note-saver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Agents can take longer than one phase — never cut them off mid-write. */
export const maxDuration = 300;

const bodySchema = z.object({ phase: z.enum(["learn", "build", "community"]) });

export async function POST(req: NextRequest) {
  const principal = await principalFromRequest({ header: (n) => req.headers.get(n) });
  if (!isAuthenticatedPrincipal(principal)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "no active session" }, { status: 409 });
  if (session.processing) {
    return NextResponse.json({ error: "an agent is already running for this session" }, { status: 409 });
  }
  if (session.status === "ended") {
    return NextResponse.json({ error: "session already ended" }, { status: 409 });
  }

  const config = loadDailySessionConfig();
  const phase = parsed.data.phase;

  try {
    let updated;
    if (phase === "learn") {
      let artifact = await runLearningAgent({ session, config });

      // Persist the note when the notes repo + token are configured. The saver
      // never throws: a failure leaves noteSaved=false with an exact reason.
      if (artifact.topic && artifact.state !== "unavailable") {
        const result = await saveLearningNote(artifact, { session }, config);
        artifact = {
          ...artifact,
          noteSaved: result.saved,
          notePath: result.path ?? artifact.notePath,
          noteBlockedReason: result.saved ? null : result.reason,
        };
      }

      updated = await updateArtifact(session.id, { learn: artifact });
    } else if (phase === "build") {
      const artifact = await runCodingAgent({ session, config });
      updated = await updateArtifact(session.id, { build: artifact });
    } else {
      const artifact = await runCommunityAgent({ session, config });
      updated = await updateArtifact(session.id, { community: artifact });
    }
    return NextResponse.json({ success: true, session: dailySessionSchema.parse(updated) });
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "agent failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
