import { NextResponse } from "next/server";
import { DEFAULT_RULES } from "@/config/rules";
import { ingestParsedFiles } from "@/lib/engine/ingest";
import { parseUpload, type ParsedFile } from "@/lib/engine/parse";
import { propertySchema, rulesOverrideSchema } from "@/lib/schemas";
import type { FileStat } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/** POST multipart/form-data: files[] (≤50 CSV/XLSX), property (JSON), rules? (JSON) */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const propertyParse = propertySchema.safeParse(safeJson(form.get("property")));
  if (!propertyParse.success) {
    return NextResponse.json({ error: "Invalid property", issues: propertyParse.error.issues }, { status: 400 });
  }
  const rulesParse = rulesOverrideSchema.safeParse(safeJson(form.get("rules")) ?? undefined);
  if (!rulesParse.success) {
    return NextResponse.json({ error: "Invalid rules", issues: rulesParse.error.issues }, { status: 400 });
  }

  const files = form.getAll("files").filter((f): f is File => typeof f !== "string");
  if (files.length === 0) return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
  if (files.length > DEFAULT_RULES.maxFiles) {
    return NextResponse.json({ error: `Max ${DEFAULT_RULES.maxFiles} files per run (got ${files.length})` }, { status: 400 });
  }

  // Parse in a stable order (by filename) so results are deterministic regardless of upload order.
  const ordered = [...files].sort((a, b) => a.name.localeCompare(b.name));
  const parsed: ParsedFile[] = [];
  const errors: FileStat[] = [];
  for (const f of ordered) {
    try {
      parsed.push(await parseUpload(f.name, await f.arrayBuffer()));
    } catch (e) {
      errors.push({ fileName: f.name, rows: 0, sourceGroup: "", usedGroupColumn: false, error: (e as Error).message });
    }
  }
  if (parsed.length === 0) {
    return NextResponse.json({ error: "No files could be parsed", files: errors }, { status: 422 });
  }

  const result = ingestParsedFiles(parsed, propertyParse.data, rulesParse.data, errors);
  return NextResponse.json(result);
}

function safeJson(v: FormDataEntryValue | null): unknown {
  if (typeof v !== "string" || !v) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}
