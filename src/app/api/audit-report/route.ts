/**
 * Export a rendered audit report as HTML, PDF, CSV or PPTX.
 *
 * The browser posts back the report it already rendered, so the download is
 * byte-for-byte the same audit the operator is looking at (no re-crawl, no
 * second opinion). The payload is validated before it reaches a writer.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  AUDIT_REPORT_FORMATS,
  auditReportFileName,
  auditReportSchema,
  buildAuditCsvReport,
  buildAuditHtmlReport,
  buildAuditPdfReport,
  buildAuditPptxReport,
  type AuditReportFormat,
} from "@/core/reporting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  format: z.enum(["html", "pdf", "csv", "pptx"]),
  report: auditReportSchema,
});

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid audit report payload",
        issues: parsed.error.issues.slice(0, 8).map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const { format, report } = parsed.data;

  try {
    let body: string | Uint8Array;
    switch (format as AuditReportFormat) {
      case "html":
        body = buildAuditHtmlReport(report);
        break;
      case "pdf":
        body = new Uint8Array(buildAuditPdfReport(report));
        break;
      case "csv":
        body = buildAuditCsvReport(report);
        break;
      case "pptx":
        body = new Uint8Array(await buildAuditPptxReport(report));
        break;
    }

    const { contentType } = AUDIT_REPORT_FORMATS[format];
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${auditReportFileName(report.domain, format, report.createdAt)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to generate the report file", details: message },
      { status: 500 },
    );
  }
}
