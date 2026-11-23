import { NextResponse } from "next/server";
import { z } from "zod";
import {
  crawlWebsiteImages,
  generateImageAuditWorkbook,
  exportAuditToGoogleSheets,
  isGoogleConfigured,
} from "@/core/image-audit";

export const runtime = "nodejs";
export const maxDuration = 60;

const auditRequestSchema = z.object({
  url: z.string().trim().min(3, "Please provide a valid website URL"),
  maxPages: z.coerce.number().min(1).max(200).default(50),
  delayMs: z.coerce.number().min(0).max(2000).default(100),
  timeoutMs: z.coerce.number().min(1000).max(30000).default(10000),
  includeSubdomains: z.boolean().default(false),
  sizeThresholdKb: z.coerce.number().min(10).max(10000).default(100),
  saveToGoogleSheets: z.boolean().default(false),
  enableSitemaps: z.boolean().default(true),
  enableWordPressApi: z.boolean().default(true),
});

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = auditRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message || "Invalid input parameters",
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const {
      url,
      maxPages,
      delayMs,
      timeoutMs,
      includeSubdomains,
      sizeThresholdKb,
      saveToGoogleSheets,
      enableSitemaps,
      enableWordPressApi,
    } = parsed.data;

    // Validate URL syntax
    let validUrl = url;
    if (!validUrl.startsWith("http://") && !validUrl.startsWith("https://")) {
      validUrl = `https://${validUrl}`;
    }

    try {
      new URL(validUrl);
    } catch {
      return NextResponse.json(
        { error: `Invalid URL format: "${url}". Please enter a valid HTTP/HTTPS URL.` },
        { status: 400 }
      );
    }

    // Run the crawl and image analysis
    const auditResult = await crawlWebsiteImages(validUrl, {
      maxPages,
      delayMs,
      timeoutMs,
      includeSubdomains,
      sizeThresholdKb,
      enableSitemaps,
      enableWordPressApi,
    });

    // Generate Excel workbook
    const { buffer, base64 } = generateImageAuditWorkbook(
      auditResult.summary,
      auditResult.items,
      auditResult.crawlLog
    );

    const hostname = new URL(validUrl).hostname.replace(/[^a-z0-9.-]/gi, "_");
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `image-audit-${hostname}-${dateStr}.xlsx`;

    let googleSheetUrl: string | null = null;
    let googleSheetError: string | null = null;

    if (saveToGoogleSheets) {
      if (isGoogleConfigured()) {
        try {
          const exportResult = await exportAuditToGoogleSheets(
            auditResult.summary,
            auditResult.items,
            auditResult.crawlLog
          );
          googleSheetUrl = exportResult.spreadsheetUrl;
        } catch (err: unknown) {
          googleSheetError = err instanceof Error ? err.message : String(err);
        }
      } else {
        googleSheetError =
          "Google Workspace service account is not configured in environment variables. Downloaded XLSX is still available.";
      }
    }

    return NextResponse.json({
      success: true,
      summary: auditResult.summary,
      items: auditResult.items,
      crawlLog: auditResult.crawlLog,
      filename,
      xlsxBase64: base64,
      googleSheetUrl,
      googleSheetError,
      googleConfigured: isGoogleConfigured(),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawUrl = searchParams.get("url");

    if (!rawUrl) {
      return NextResponse.json(
        { error: "Query parameter 'url' is required (e.g. ?url=https://example.com)" },
        { status: 400 }
      );
    }

    let validUrl = rawUrl.trim();
    if (!validUrl.startsWith("http://") && !validUrl.startsWith("https://")) {
      validUrl = `https://${validUrl}`;
    }

    const maxPages = Math.min(Math.max(parseInt(searchParams.get("maxPages") || "25", 10), 1), 100);
    const sizeThresholdKb = parseInt(searchParams.get("sizeThresholdKb") || "100", 10);
    const includeSubdomains = searchParams.get("includeSubdomains") === "true";

    const auditResult = await crawlWebsiteImages(validUrl, {
      maxPages,
      delayMs: 50,
      includeSubdomains,
      sizeThresholdKb,
    });

    const { buffer } = generateImageAuditWorkbook(
      auditResult.summary,
      auditResult.items,
      auditResult.crawlLog
    );

    const hostname = new URL(validUrl).hostname.replace(/[^a-z0-9.-]/gi, "_");
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `image-audit-${hostname}-${dateStr}.xlsx`;

    return new Response(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error generating audit export";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
