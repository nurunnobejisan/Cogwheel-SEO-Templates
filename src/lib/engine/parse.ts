import Papa from "papaparse";
import * as XLSX from "xlsx";
import { groupFromFilename } from "./normalize";

/** Canonical columns we extract from Semrush (and similar) exports. */
export type CanonicalColumn = "keyword" | "volume" | "kd" | "cpc" | "intent" | "group";

const COLUMN_ALIASES: Record<CanonicalColumn, string[]> = {
  keyword: ["keyword", "keywords", "top queries", "query", "queries", "search term", "search terms", "phrase", "term"],
  volume: ["volume", "search volume", "monthly search volume", "avg. monthly searches", "avg monthly searches", "sv", "monthly volume", "searches", "impressions", "clicks"],
  kd: ["keyword difficulty", "kw difficulty", "kd", "kd %", "kd%", "difficulty", "keyword difficulty index", "competition (indexed value)", "competition"],
  cpc: ["cpc", "cpc (usd)", "cpc usd", "cost per click"],
  intent: ["intent", "intents", "search intent"],
  group: ["group", "topic", "keyword group", "keyword groups", "groups", "topics", "bucket", "category"],
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
    delimitersToGuess: [",", ";", "\t", "|"],
  });
  const matrix = result.data as unknown[][];
  try {
    return matrixToFile(fileName, matrix);
  } catch {
    // Fallback for headerless plain-text or single-column keyword lists.
    const fileGroup = groupFromFilename(fileName);
    const rows: ParsedRow[] = [];
    for (const row of matrix) {
      const kw = String(row[0] ?? "").trim();
      if (!kw) continue;
      rows.push({
        keyword: kw,
        volume: row[1] ?? 0,
        kd: row[2] ?? null,
        cpc: null,
        intent: null,
        group: null,
      });
    }
    if (rows.length === 0) throw new Error(`No keywords found in ${fileName}`);
    return { fileName, rows, sourceGroup: fileGroup, usedGroupColumn: false };
  }
}

export function parseXlsxBuffer(fileName: string, buffer: ArrayBuffer | Uint8Array): ParsedFile {
  const wb = XLSX.read(buffer, { type: "array" });
  if (!wb.SheetNames.length) throw new Error(`Workbook ${fileName} has no sheets`);

  const allRows: ParsedRow[] = [];
  let usedGroupColumn = false;
  const multiSheet = wb.SheetNames.length > 1;

  for (const sheetName of wb.SheetNames) {
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, defval: "", raw: true });
    try {
      const parsed = matrixToFile(fileName, matrix);
      if (parsed.usedGroupColumn) usedGroupColumn = true;
      for (const r of parsed.rows) {
        allRows.push({
          ...r,
          group: r.group ?? (multiSheet && !/^sheet\d+$/i.test(sheetName) ? sheetName : null),
        });
      }
    } catch {
      // Skip cover/summary sheets that don't have a Keyword table.
    }
  }

  if (allRows.length === 0) {
    throw new Error(`No "Keyword" column found in any sheet of ${fileName}`);
  }
  return {
    fileName,
    rows: allRows,
    sourceGroup: groupFromFilename(fileName),
    usedGroupColumn: usedGroupColumn || multiSheet,
  };
}

export function parseJsonText(fileName: string, text: string): ParsedFile {
  const raw = JSON.parse(text);
  const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.keywords) ? raw.keywords : null;
  if (!arr) throw new Error(`JSON file ${fileName} must be an array of keyword objects`);
  const rows: ParsedRow[] = arr
    .map((item: Record<string, unknown>) => ({
      keyword: String(item.keyword ?? item.query ?? item.term ?? "").trim(),
      volume: item.volume ?? item.sv ?? item.searchVolume ?? 0,
      kd: item.kd ?? item.difficulty ?? null,
      cpc: item.cpc ?? null,
      intent: item.intent ?? null,
      group: item.group ? String(item.group) : item.bucket ? String(item.bucket) : null,
    }))
    .filter((r: ParsedRow) => Boolean(r.keyword));
  if (rows.length === 0) throw new Error(`No keywords found in ${fileName}`);
  return {
    fileName,
    rows,
    sourceGroup: groupFromFilename(fileName),
    usedGroupColumn: rows.some((r) => Boolean(r.group)),
  };
}

export async function parseUpload(fileName: string, data: ArrayBuffer): Promise<ParsedFile> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    return parseXlsxBuffer(fileName, new Uint8Array(data));
  }
  if (lower.endsWith(".json")) {
    return parseJsonText(fileName, new TextDecoder("utf-8").decode(data));
  }
  if (lower.endsWith(".csv") || lower.endsWith(".tsv") || lower.endsWith(".txt")) {
    return parseCsvText(fileName, new TextDecoder("utf-8").decode(data));
  }
  throw new Error(`Unsupported file type: ${fileName}`);
}

