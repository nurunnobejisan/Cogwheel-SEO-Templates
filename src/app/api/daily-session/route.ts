/**
 * /api/daily-session — session lifecycle
 *
 *   GET    → current session + history + config visibility
 *   POST   → { action } one of start | pause | resume | skip | end | advance |
 *            complete-learn | complete-build | complete-community
 *   PATCH  → { learn | build | community } persist an agent artifact
 *
 * Authentication follows the platform convention: an authenticated principal
 * is required. The route never reads GITHUB_TOKEN and never echoes it.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAuthenticatedPrincipal, principalFromRequest } from "@/lib/platform/auth";
import { loadDailySessionConfig, configuredRepos } from "@/lib/daily-session/config";
import {
  SessionError,
  applyAction,
  currentSession,
  history,
  startSession,
} from "@/lib/daily-session/orchestrator";
import { actionRequestSchema, dailySessionSchema } from "@/lib/daily-session/types";
import { updateArtifact } from "@/lib/daily-session/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    sessionId: z.string().min(1),
    learn: z.record(z.unknown()).optional(),
    build: z.record(z.unknown()).optional(),
    community: z.record(z.unknown()).optional(),
  })
  .refine((v) => v.learn || v.build || v.community, { message: "no artifact provided" });

async function requireAuth(req: NextRequest) {
  const principal = await principalFromRequest({ header: (n) => req.headers.get(n) });
  if (!isAuthenticatedPrincipal(principal)) return null;
  return principal;
}

function errorResponse(error: unknown) {
  if (error instanceof SessionError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "unexpected error";
  return NextResponse.json({ error: message }, { status: 500 });
}

/** Config surface the UI needs. Names are non-secret; the token never appears. */
function configView() {
  const config = loadDailySessionConfig();
  return {
    configured: config.configured,
    buildRepo: config.build.repo,
    learnRepo: config.learn.repo,
    researchRepo: config.research.repo,
    setup: {
      build: config.build.repo ? null : config.build.setup,
      learn: config.learn.repo ? null : config.learn.setup,
      research: config.research.repo ? null : config.research.setup,
    },
    github: config.githubToken ? "token" : "anonymous",
    authorizedRepos: configuredRepos(config),
  };
}

export async function GET(req: NextRequest) {
  const principal = await requireAuth(req);
  if (!principal) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const session = await currentSession();
    const past = await history(14);
    const valid = session ? dailySessionSchema.safeParse(session) : null;
    return NextResponse.json({
      success: true,
      session: valid?.success ? valid.data : session,
      history: past.map((s) => dailySessionSchema.parse(s)),
      config: configView(),
      phases: { learn: 15, build: 40, community: 5 },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  const principal = await requireAuth(req);
  if (!principal) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = actionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const { action, expectedUpdatedAt } = parsed.data;

  try {
    // "start" is idempotent — it returns the running session rather than
    // creating a duplicate when the button is clicked twice.
    if (action === "start") {
      const { session, created } = await startSession();
      return NextResponse.json({ success: true, session: dailySessionSchema.parse(session), created });
    }

    const active = await currentSession();
    if (!active) return NextResponse.json({ error: "no active session" }, { status: 409 });

    const session = await applyAction(active.id, action, { expectedUpdatedAt });
    return NextResponse.json({ success: true, session: dailySessionSchema.parse(session) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(req: NextRequest) {
  const principal = await requireAuth(req);
  if (!principal) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const session = await updateArtifact(parsed.data.sessionId, {
      ...(parsed.data.learn ? { learn: parsed.data.learn as never } : {}),
      ...(parsed.data.build ? { build: parsed.data.build as never } : {}),
      ...(parsed.data.community ? { community: parsed.data.community as never } : {}),
    });
    return NextResponse.json({ success: true, session: dailySessionSchema.parse(session) });
  } catch (error) {
    return errorResponse(error);
  }
}
