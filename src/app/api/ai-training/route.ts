import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOperator } from "@/lib/auth/requireOperator";
import { getActiveAiProviderLabel } from "@/core/claude";
import {
  addTrainingRule,
  deleteTrainingRule,
  listTrainingRules,
  toggleTrainingRule,
} from "@/core/training";
import {
  getDesignSettings,
  listChangeHistory,
  processTrainingFeedback,
  recordLegacyRuleHistory,
  revertTrainingChange,
} from "@/core/training-feedback";

export const dynamic = "force-dynamic";

const createRuleSchema = z.object({
  taskId: z.string().nullable().optional(),
  title: z.string().min(2, "Title is required"),
  ruleText: z.string().min(5, "Rule or feedback text is required"),
  exampleBad: z.string().optional(),
  exampleGood: z.string().optional(),
  authorName: z.string().optional(),
});

const feedbackSchema = z.object({
  authorName: z.string().min(1, "Your name is required"),
  category: z.enum(["seo", "design"]),
  feedbackText: z.string().min(3, "Please describe what you want to change"),
  taskId: z.string().nullable().optional(),
  designPatch: z
    .object({
      accentTheme: z.enum(["lime", "sky", "emerald", "indigo", "amber"]).optional(),
      density: z.enum(["comfortable", "compact"]).optional(),
      defaultTab: z.enum(["home", "tasks", "crawl", "studio"]).optional(),
      showSummaryCards: z.boolean().optional(),
      workspaceSubtitle: z.string().optional(),
    })
    .optional(),
});

const revertSchema = z.object({
  action: z.literal("revert"),
  historyId: z.string().min(1),
});

const toggleRuleSchema = z.object({
  id: z.string().min(1),
  active: z.boolean(),
});

const rawSampleSchema = z.object({
  schemaVersion: z.string().default("3.0.0"),
  idempotencyKey: z.string().min(1),
  provenance: z.object({
    canonicalUrlHash: z.string(),
    contentHash: z.string(),
    capturedAt: z.string(),
    extensionVersion: z.string().default("2.7.0"),
  }),
  record: z.object({
    id: z.string(),
    canonicalUrl: z.string(),
    domain: z.string(),
    brand: z.string().default("Independent"),
    qualityScore: z.number().min(0).max(100),
    status: z.enum(["pending", "approved", "rejected"]).default("pending"),
    rawInput: z.object({
      url: z.string(),
      canonicalUrl: z.string().optional(),
      domain: z.string(),
      rawTitle: z.string().default(""),
      rawMetaDesc: z.string().default(""),
      rawH1: z.array(z.string()).default([]),
      rawH2: z.array(z.string()).default([]),
      rawBodyText: z.string().default(""),
      detectedSchemas: z.array(z.string()).default([]),
      wordCount: z.number().default(0),
    }),
    targetOutput: z.object({
      optimizedTitle: z.string().default(""),
      optimizedMetaDesc: z.string().default(""),
      optimizedH1: z.string().default(""),
      jsonLdSchema: z.any().optional(),
      geoEntityBlock: z.string().default(""),
      brandGuardrail: z.string().default("Independent"),
    }),
  }),
});

const batchSyncSchema = z.object({
  schemaVersion: z.string().default("3.0.0"),
  event: z.literal("training_batch_sync"),
  timestamp: z.string(),
  count: z.number(),
  samples: z.array(rawSampleSchema),
});

export async function GET(req: Request) {
  const denied = await requireOperator({ headers: req.headers });
  if (denied) {
    return denied;
  }
  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get("taskId") || undefined;
  const rules = await listTrainingRules(taskId);
  // Auth is enforced above; without a token no rule titles/text are returned.
  return NextResponse.json({
    rules,
    provider: getActiveAiProviderLabel(),
    designSettings: getDesignSettings(),
    history: listChangeHistory(),
  });
}

export async function POST(req: Request) {
  const denied = await requireOperator({ headers: req.headers });
  if (denied) {
    return denied;
  }
  try {
    const body = (await req.json()) as Record<string, unknown>;

    // Handle Extension Batch Sync
    if (body && (body.event === "training_batch_sync" || Array.isArray(body.samples))) {
      const parsedBatch = batchSyncSchema.parse(body);
      return NextResponse.json(
        {
          success: true,
          status: 200,
          message: `Successfully received and validated ${parsedBatch.samples.length} training samples.`,
          receivedCount: parsedBatch.samples.length,
          timestamp: new Date().toISOString(),
        },
        { status: 200 }
      );
    }

    if (body && body.action === "revert") {
      const parsed = revertSchema.parse(body);
      const { reverted, designSettings } = await revertTrainingChange(parsed.historyId);
      if (!reverted) {
        return NextResponse.json({ error: "Change entry not found or already reverted" }, { status: 404 });
      }
      const rules = await listTrainingRules();
      return NextResponse.json({
        reverted,
        rules,
        designSettings,
        history: listChangeHistory(),
      });
    }

    if (body && ("feedbackText" in body || "category" in body)) {
      const parsed = feedbackSchema.parse(body);
      const outcome = await processTrainingFeedback(parsed);
      const rules = await listTrainingRules();
      return NextResponse.json(
        {
          ...outcome,
          rules,
          history: listChangeHistory(),
        },
        { status: outcome.status === "blocked" ? 200 : 201 },
      );
    }

    const parsed = createRuleSchema.parse(body);
    const rule = await addTrainingRule(parsed);
    const entry = recordLegacyRuleHistory(parsed.authorName?.trim() || "SEO Team", rule);
    return NextResponse.json(
      {
        rule,
        entry,
        history: listChangeHistory(),
      },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid training rule";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  const denied = await requireOperator({ headers: req.headers });
  if (denied) {
    return denied;
  }
  try {
    const body = await req.json();
    const parsed = toggleRuleSchema.parse(body);
    const rule = await toggleTrainingRule(parsed.id, parsed.active);
    if (!rule) {
      return NextResponse.json({ error: "Training rule not found" }, { status: 404 });
    }
    return NextResponse.json({ rule });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const denied = await requireOperator({ headers: req.headers });
  if (denied) {
    return denied;
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  const deleted = await deleteTrainingRule(id);
  return NextResponse.json({ deleted });
}
