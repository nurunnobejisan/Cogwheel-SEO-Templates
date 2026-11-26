export { buildAuditHtmlReport } from "./html-report.ts";
export { buildAuditPdfReport } from "./pdf-report.ts";
export { buildAuditCsvReport } from "./csv-report.ts";
export { buildAuditPptxReport } from "./pptx-report.ts";
export { auditReportSchema } from "./schema.ts";
export type { ValidatedAuditReport } from "./schema.ts";

export type AuditReportFormat = "html" | "pdf" | "csv" | "pptx";

export const AUDIT_REPORT_FORMATS: Record<
  AuditReportFormat,
  { extension: string; contentType: string }
> = {
  html: { extension: "html", contentType: "text/html; charset=utf-8" },
  pdf: { extension: "pdf", contentType: "application/pdf" },
  csv: { extension: "csv", contentType: "text/csv; charset=utf-8" },
  pptx: {
    extension: "pptx",
    contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  },
};

/** Filesystem-safe base name, e.g. `seo-studio-audit-example.com-2026-11-25`. */
export function auditReportFileName(
  domain: string,
  format: AuditReportFormat,
  createdAt = new Date().toISOString(),
): string {
  const safeDomain = (domain || "site").replace(/[^a-zA-Z0-9.-]+/g, "-").replace(/^-+|-+$/g, "");
  const date = createdAt.slice(0, 10);
  return `seo-studio-audit-${safeDomain || "site"}-${date}.${AUDIT_REPORT_FORMATS[format].extension}`;
}
