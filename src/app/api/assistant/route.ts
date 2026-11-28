import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAuthenticatedPrincipal, principalFromRequest } from "@/lib/platform/auth";
import { auditReportSchema } from "@/core/reporting/schema";
import type { FullWebsiteAuditReport } from "@/core/full-audit/types";
import type { GscPanelPayload } from "@/core/gsc/panel-types.ts";
import { buildAssistantContext } from "@/core/assistant/context";
import { answerFromAudit } from "@/core/assistant/rules";
import { assistantProviderChain, assistantProviderStatus } from "@/core/assistant/providers";
import { verifyClaimProvenance } from "@/core/brain";
import { canUseLlm, recordLlmUsage } from "@/core/brain/usage";
import { latestVisibilityRun } from "@/core/visibility/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const looseObject = z.record(z.unknown());

const requestSchema = z.object({
  question: z.string().trim().min(1).max(1200),
  targetUrl: z.string().trim().min(3).max(2048),
  report: auditReportSchema.nullable().optional(),
  gscPanel: z
    .object({
      siteUrl: z.string(),
      periodDays: z.number(),
      source: z.enum(["google-api", "csv-upload"]),
      window: looseObject,
      overview: looseObject,
      comparison: z.unknown().optional(),
      cannibalization: z.array(looseObject),
      notes: z.array(z.string()).optional(),
      limitations: z.array(z.string()).optional(),
    })
    .passthrough()
    .nullable()
    .optional(),
  forceRules: z.boolean().default(false),
});

const encoder = new TextEncoder();

function event(value: Record<string, unknown>): Uint8Array {
  return encoder.encode(`${JSON.stringify(value)}\n`);
}

export async function GET() {
  return NextResponse.json({ success: true, providers: assistantProviderStatus() });
}

export async function POST(req: NextRequest) {
  const principal = await principalFromRequest({ header: (name: string) => req.headers.get(name) });
  const authenticated = isAuthenticatedPrincipal(principal);

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid assistant request", details: parsed.error.issues.slice(0, 8) },
      { status: 400 }
    );
  }

  const body = parsed.data;
  const report = (body.report ?? null) as FullWebsiteAuditReport | null;
  const gscPanel = (body.gscPanel ?? null) as GscPanelPayload | null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const attempts: string[] = [];
      try {
        const context = await buildAssistantContext({
          targetUrl: body.targetUrl,
          question: body.question,
          report,
          gscPanel,
          visibilityRun: (await latestVisibilityRun(body.targetUrl).catch(() => null)) ?? null,
        });

        // Anonymous visitors always get the deterministic rules path: no
        // provider key is used on their behalf and no outside call is made.
        const budget = authenticated && !body.forceRules ? await canUseLlm() : { allowed: false, reason: "rules-only session" };
        const chain = budget.allowed ? assistantProviderChain() : [];
        if (!budget.allowed && authenticated) {
          attempts.push(`Model providers skipped: ${budget.reason ?? "budget cap"}`);
        }

        let answer: string | null = null;
        let providerLabel = "Rules engine (deterministic)";
        let toolUsed = "rules";

        for (const provider of chain) {
          controller.enqueue(event({ type: "status", provider: provider.label }));
          try {
            const candidate = await provider.call(context.system, context.prompt);
            const check = verifyClaimProvenance(candidate, report ?? ({} as FullWebsiteAuditReport), context.sources);
            if (check.ok) {
              answer = candidate;
              providerLabel = provider.label;
              toolUsed = `assistant:${provider.id}`;
              await recordLlmUsage();
              break;
            }
            attempts.push(`${provider.label}: unverified numbers ${check.untracedNumbers.join(", ") || "none"}`);
          } catch (error) {
            attempts.push(`${provider.label}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        if (answer === null) {
          const fallback = answerFromAudit(body.question, report, body.targetUrl);
          answer = fallback.content;
          toolUsed = fallback.toolUsed;
          if (attempts.length === 0) attempts.push("No model provider configured; used measured audit rules.");
        }

        const finalCheck = verifyClaimProvenance(answer, report ?? ({} as FullWebsiteAuditReport), context.sources);
        for (let index = 0; index < answer.length; index += 160) {
          controller.enqueue(event({ type: "delta", text: answer.slice(index, index + 160) }));
        }
        controller.enqueue(
          event({
            type: "done",
            provider: providerLabel,
            toolUsed,
            provenance: {
              ok: finalCheck.ok,
              untracedNumbers: finalCheck.untracedNumbers,
              unmappedClaims: finalCheck.unmappedClaims,
            },
            attempts,
            retrievedIds: context.retrieved.map((chunk) => chunk.id),
          })
        );
      } catch (error) {
        controller.enqueue(
          event({ type: "error", message: error instanceof Error ? error.message : String(error) })
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
