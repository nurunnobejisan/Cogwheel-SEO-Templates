import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runFullWebsiteAudit } from "@/core/full-audit";
import { UrlValidationError } from "@/core/crawler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const gscIssueSchema = z
  .object({
    query: z.string(),
    competingPages: z.array(
      z.object({
        pageUrl: z.string(),
        clicks: z.number(),
        impressions: z.number(),
        ctr: z.number(),
        position: z.number(),
      })
    ),
    severity: z.enum(["high", "medium", "low"]),
    recommendation: z.string(),
    severityScore: z.number().optional(),
    preferredUrl: z.string().optional(),
    normalizedUrls: z.array(z.string()).optional(),
    topUrlClickShare: z.number().optional(),
    positionSpreadFactor: z.number().optional(),
  })
  .passthrough();

const gscPanelSchema = z
  .object({
    siteUrl: z.string().min(1),
    periodDays: z.number().int().positive(),
    source: z.enum(["google-api", "csv-upload"]),
    window: z.object({
      startDate: z.string(),
      endDate: z.string(),
      previousStartDate: z.string(),
      previousEndDate: z.string(),
    }),
    overview: z
      .object({
        siteUrl: z.string(),
        periodDays: z.number(),
        totalClicks: z.number(),
        totalImpressions: z.number(),
        averageCtr: z.number(),
        averagePosition: z.number(),
        topQueries: z.array(
          z.object({ query: z.string(), clicks: z.number(), impressions: z.number(), ctr: z.number(), position: z.number() })
        ),
        topPages: z.array(
          z.object({ page: z.string(), clicks: z.number(), impressions: z.number(), ctr: z.number(), position: z.number() })
        ),
        deviceBreakdown: z.record(z.object({ clicks: z.number(), impressions: z.number() })),
        countryBreakdown: z.record(z.object({ clicks: z.number(), impressions: z.number() })),
      })
      .passthrough(),
    cannibalization: z.array(gscIssueSchema),
    notes: z.array(z.string()),
  })
  .passthrough();

const auditRequestSchema = z.object({
  targetUrl: z.string().trim().min(3, "Target URL is required (e.g. https://example.com)"),
  maxPages: z.number().int().min(1).max(200).default(25),
  enableSubdomains: z.boolean().default(false),
  includeGsc: z.boolean().default(true),
  includeGeo: z.boolean().default(true),
  gscPanel: gscPanelSchema.optional(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = auditRequestSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid audit request", details: parsed.error.issues.slice(0, 8) },
        { status: 400 }
      );
    }

    const report = await runFullWebsiteAudit(parsed.data);

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const status = err instanceof UrlValidationError ? 400 : 500;
    return NextResponse.json(
      { error: "Failed to execute full website audit", details: errorMsg },
      { status }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = z
      .object({
        targetUrl: z.string().trim().min(3).default("https://example.com"),
        maxPages: z.coerce.number().int().min(1).max(200).default(10),
      })
      .safeParse({
        targetUrl: searchParams.get("targetUrl") || undefined,
        maxPages: searchParams.get("maxPages") || undefined,
      });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid audit query", details: parsed.error.issues.slice(0, 6) }, { status: 400 });
    }

    const report = await runFullWebsiteAudit(parsed.data);

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch audit sample", details: String(err) },
      { status: 500 }
    );
  }
}
