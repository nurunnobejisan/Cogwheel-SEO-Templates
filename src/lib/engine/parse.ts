import Papa from "papaparse";
import * as XLSX from "xlsx";
import { groupFromFilename } from "./normalize";

/** Canonical columns we extract from Semrush (and similar) exports. */
export type CanonicalColumn = "keyword" | "volume" | "kd" | "cpc" | "intent" | "group";

const COLUMN_ALIASES: Record<CanonicalColumn, string[]> = {
  keyword: ["keyword", "keywords", "query", "search term", "search terms"],
  volume: ["volume", "search volume", "avg. monthly searches", "avg monthly searches", "sv", "monthly volume"],
  kd: ["keyword difficulty", "kd", "kd %", "kd%", "difficulty", "keyword difficulty index"],
  cpc: ["cpc", "cpc (usd)", "cpc usd", "cost per click"],
  intent: ["intent", "intents", "search intent"],
  group: ["group", "topic", "keyword group", "keyword groups", "groups", "topics"],
};

export interface ParsedRow {
  keyword: string;
  volume: unknown;
  kd: unknown;
  cpc: unknown;
  intent: unknown;
  group: string | null;
}

export interface ParsedFile {
  fileName: string;
  rows: ParsedRow[];
  sourceGroup: string;
  usedGroupColumn: boolean;
}

function normHeader(h: unknown): string {
  return String(h ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Map header cells → canonical column index. Returns null if no keyword column. */
export function detectColumns(header: unknown[]): Partial<Record<CanonicalColumn, number>> | null {
  const cells = header.map(normHeader);
  const map: Partial<Record<CanonicalColumn, number>> = {};
  (Object.keys(COLUMN_ALIASES) as CanonicalColumn[]).forEach((col) => {
    // Alias order = preference order (e.g. "group" before "topic").
    for (const alias of COLUMN_ALIASES[col]) {
      const idx = cells.indexOf(alias);
      if (idx !== -1) {
        map[col] = idx;
        return;
      }
    }
  });
  return map.keyword === undefined ? null : map;
}

/** Convert a 2-D cell matrix into rows, auto-detecting the header within the first 10 lines. */
export function matrixToFile(fileName: string, matrix: unknown[][]): ParsedFile {
  let headerIdx = -1;
  let columns: Partial<Record<CanonicalColumn, number>> | null = null;
  for (let i = 0; i < Math.min(10, matrix.length); i++) {
    columns = detectColumns(matrix[i] ?? []);
    if (columns) {
      headerIdx = i;
      break;
    }
  }
  if (!columns || headerIdx === -1) {
    throw new Error(`No "Keyword" column found in ${fileName}`);
  }
  const usedGroupColumn = columns.group !== undefined;
  const fileGroup = groupFromFilename(fileName);
  const get = (row: unknown[], col: CanonicalColumn) =>
    columns![col] === undefined ? undefined : row[columns![col] as number];

  const rows: ParsedRow[] = [];
  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    const keyword = String(get(row, "keyword") ?? "").trim();
    if (!keyword && row.every((c) => String(c ?? "").trim() === "")) continue;
    const groupCell = usedGroupColumn ? String(get(row, "group") ?? "").trim() : "";
    rows.push({
      keyword,
      volume: get(row, "volume"),
      kd: get(row, "kd"),
      cpc: get(row, "cpc"),
      intent: get(row, "intent"),
      group: groupCell || null,
    });
  }
  return { fileName, rows, sourceGroup: fileGroup, usedGroupColumn };
}

export function parseCsvText(fileName: string, text: string): ParsedFile {
  const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), {
    skipEmptyLines: "greedy",
    // Semrush sometimes exports ; or tab separated files.
    delimitersToGuess: [",", ";", "\t", "|"],
  });
  return matrixToFile(fileName, result.data as unknown[][]);
}

export function parseXlsxBuffer(fileName: string, buffer: ArrayBuffer | Uint8Array): ParsedFile {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error(`Workbook ${fileName} has no sheets`);
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, defval: "", raw: true });
  return matrixToFile(fileName, matrix);
}

export async function parseUpload(fileName: string, data: ArrayBuffer): Promise<ParsedFile> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    return parseXlsxBuffer(fileName, new Uint8Array(data));
  }
  if (lower.endsWith(".csv") || lower.endsWith(".tsv") || lower.endsWith(".txt")) {
    return parseCsvText(fileName, new TextDecoder("utf-8").decode(data));
  }
  throw new Error(`Unsupported file type: ${fileName}`);
}

