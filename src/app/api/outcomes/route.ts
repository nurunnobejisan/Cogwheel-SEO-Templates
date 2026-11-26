import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedPrincipal, principalFromRequest } from "@/lib/platform/auth";
import { getGscSearchAnalytics, isGoogleConfigured } from "@/core/gsc/client";
import {
  changeEventFromDeployment,
  measureChange,
  type MeasureDeps,
  type OutcomeRecord,
} from "@/core/outcomes";
import { appendChange, readChanges, readOutcomes, upsertOutcome } from "@/core/outcomes/store";

export const dynamic = "force-dynamic";

function measureDeps(): MeasureDeps {
  return {
    isConfigured: isGoogleConfigured,
    fetchPages: (query) =>
      getGscSearchAnalytics({
        siteUrl: query.siteUrl,
        startDate: query.startDate,
        endDate: query.endDate,
        dimensions: ["page"],
        rowLimit: query.rowLimit,
      }),
  };
}

export async function GET(req: NextRequest) {
  const principal = await principalFromRequest({ header: (name: string) => req.headers.get(name) });
  if (!isAuthenticatedPrincipal(principal)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const [changes, outcomes] = await Promise.all([readChanges(), readOutcomes()]);
    return NextResponse.json({
      success: true,
      changes,
      outcomes,
      counts: {
        changes: changes.length,
        measured: outcomes.filter((entry) => entry.provenance === "measured").length,
        unavailable: outcomes.filter((entry) => entry.provenance === "unavailable").length,
        tracked: new Set(outcomes.map((entry) => entry.changeId)).size,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const principal = await principalFromRequest({ header: (name: string) => req.headers.get(name) });
  if (!isAuthenticatedPrincipal(principal)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "record";

    if (action === "record") {
      const pageUrl = typeof body.pageUrl === "string" ? body.pageUrl.trim() : "";
      if (!pageUrl) return NextResponse.json({ error: "pageUrl is required" }, { status: 400 });
      const change = changeEventFromDeployment({
        pageUrl,
        appliedAt: typeof body.appliedAt === "string" ? body.appliedAt : new Date().toISOString(),
        siteUrl: typeof body.siteUrl === "string" ? body.siteUrl : undefined,
        summary: typeof body.summary === "string" ? body.summary : undefined,
        kind: typeof body.kind === "string" ? body.kind : undefined,
        fixRef: typeof body.fixRef === "string" ? body.fixRef : undefined,
        tenantId: principal.organizationId,
      });
      const changes = await readChanges();
      if (changes.some((entry) => entry.id === change.id)) {
        return NextResponse.json({ success: true, change, duplicate: true });
      }
      await appendChange(change);
      return NextResponse.json({ success: true, change });
    }

    if (action === "measure") {
      const deps = measureDeps();
      const changes = await readChanges();
      const targets = typeof body.changeId === "string" ? changes.filter((entry) => entry.id === body.changeId) : changes;
      if (typeof body.changeId === "string" && targets.length === 0) {
        return NextResponse.json({ error: "change not found" }, { status: 404 });
      }
      const outcomes: OutcomeRecord[] = [];
      for (const change of targets) {
        const record = await measureChange(change, deps);
        await upsertOutcome(record);
        outcomes.push(record);
      }
      return NextResponse.json({
        success: true,
        measured: outcomes.length,
        measuredCount: outcomes.filter((entry) => entry.provenance === "measured").length,
        outcomes,
        note: isGoogleConfigured()
          ? undefined
          : "Search Console not connected — outcomes recorded as unavailable.",
      });
    }

    return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
