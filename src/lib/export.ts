import type { Allocation, MatrixRow, TemplateId } from "@/lib/types";

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
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

