import * as XLSX from "xlsx";
import { downloadManager, downloadTextWithCountdown } from "@/lib/download-manager";
import type { GeoSeoInsights } from "@/lib/engine/geo-seo";
import type { Allocation, MatrixRow, Property, TemplateId } from "@/lib/types";

function cell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(cell).join(",")).join("\n");
}

export function matrixToCsv(matrix: MatrixRow[], template: TemplateId): string {
  const header = ["Page", "Path", "Keyword", "Volume", "KD"];
  if (template === "B") header.push("Secondary", "Secondary Volume", "Secondary KD");
  header.push("Flags", "Status");
  return toCsv([
    header,
    ...matrix.map((r) => {
      const row: unknown[] = [r.title, r.path, r.primary?.keyword, r.primary?.volume, r.primary?.kd ?? "N/A"];
      if (template === "B") row.push(r.secondary?.keyword, r.secondary?.volume, r.secondary ? r.secondary.kd ?? "N/A" : "");
      row.push(r.flags.join(" | "), r.status);
      return row;
    }),
  ]);
}

export function poolToCsv(allocation: Allocation): string {
  return toCsv([
    ["#", "Keyword", "Volume", "KD", "Bucket", "Role", "Page", "Source Group", "Flags"],
    ...allocation.pool.map((k, i) => [
      i + 1,
      k.keyword,
      k.volume,
      k.kd ?? "N/A",
      k.bucketName,
      k.role,
      k.pageId ?? "",
      k.sourceGroup,
      k.flags.join(" | "),
    ]),
  ]);
}

export function downloadText(filename: string, text: string, mime = "text/csv;charset=utf-8") {
  downloadTextWithCountdown(filename, text, mime);
}

export function buildReportFilename(propertyName: string, ext: string): string {
  const safeName = (propertyName || "Hotel")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const date = new Date().toISOString().slice(0, 10);
  return `${safeName}_SEO_GEO_Report_${date}.${ext}`;
}

export function downloadExcelReport(opts: {
  property: Property;
  matrix: MatrixRow[];
  allocation: Allocation;
  insights: GeoSeoInsights;
}): void {
  const filename = buildReportFilename(opts.property.name, "xlsx");

  downloadManager.startDownload({
    filename,
    format: "xlsx",
    countdownSeconds: 3,
    onExecute: () => {
      const wb = XLSX.utils.book_new();

      const summaryRows = [
        ["Property", opts.property.name],
        ["Market", `${opts.property.city}, ${opts.property.state}`],
        ["Brand", opts.property.brand ?? ""],
        ["URL", opts.property.url ?? ""],
        ["Branded Keywords", opts.insights.brandedCount],
        ["Non-Branded Keywords", opts.insights.nonBrandedCount],
        ["Transactional Intent", opts.insights.intentBreakdown.transactional],
        ["Commercial Intent", opts.insights.intentBreakdown.commercial],
        ["Local Intent", opts.insights.intentBreakdown.local],
        ["Informational Intent", opts.insights.intentBreakdown.informational],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "Summary");

      const mappingRows = [
        ["Page", "Path", "Primary Keyword", "SV", "KD", "Secondary Keyword", "Confidence", "Flags", "Status"],
        ...opts.matrix.map((r) => [
          r.title,
          r.path,
          r.primary?.keyword ?? "",
          r.primary?.volume ?? 0,
          r.primary?.kd ?? "N/A",
          r.secondary?.keyword ?? "",
          opts.insights.pageConfidence[r.pageId]?.score ?? "",
          r.flags.join(" | "),
          r.status,
        ]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(mappingRows), "Keyword Mapping");

      const poolRows = [
        ["#", "Keyword", "Volume", "KD", "Bucket", "Role", "Page", "Source Group", "Flags"],
        ...opts.allocation.pool.map((k, i) => [
          i + 1,
          k.keyword,
          k.volume,
          k.kd ?? "N/A",
          k.bucketName ?? "",
          k.role,
          k.pageId ?? "",
          k.sourceGroup,
          k.flags.join(" | "),
        ]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(poolRows), "78-KW Pool");

      const geoRows = [
        ["Type", "Recommendation / Query", "Volume"],
        ...opts.insights.conversationalQueries.map((q) => ["Conversational Query", q.keyword, q.volume]),
        ...opts.insights.localOpportunities.map((q) => ["Local Opportunity", q.keyword, q.volume]),
        ...opts.insights.faqOpportunities.map((f) => ["FAQ Opportunity", f, ""]),
        ...opts.insights.structuredDataRecommendations.map((s) => ["Schema Recommendation", s, ""]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(geoRows), "GEO & Local SEO");

      XLSX.writeFile(wb, filename);
    },
  });
}

