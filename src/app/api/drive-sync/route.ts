import { NextResponse } from "next/server";
import { z } from "zod";
import { DEFAULT_RULES } from "@/config/rules";
import { ingestParsedFiles } from "@/lib/engine/ingest";
import { parseUpload, type ParsedFile } from "@/lib/engine/parse";
import { isGoogleConfigured, listAndDownloadDriveExports } from "@/lib/google";
import { propertySchema, rulesOverrideSchema } from "@/lib/schemas";
import type { FileStat } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  folderUrlOrId: z.string().trim().min(1, "Google Drive folder URL or ID is required"),
  property: propertySchema,
  rules: rulesOverrideSchema,
});

/** Sync Semrush CSV/XLSX exports directly from a property's Google Drive folder (`01-semrush/`). */
export async function POST(req: Request) {
  if (!isGoogleConfigured()) {
    return NextResponse.json(
      { error: "Google Workspace credentials are not configured (GOOGLE_SERVICE_ACCOUNT_B64)." },
      { status: 503 },
    );
  }

  const parsedBody = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsedBody.error.issues }, { status: 400 });
  }

  const { folderUrlOrId, property, rules } = parsedBody.data;

  try {
    const { files, semrushFolderId, outputFolderId } = await listAndDownloadDriveExports(folderUrlOrId);
    if (files.length === 0) {
      return NextResponse.json(
        { error: "No CSV/XLSX files found in that Google Drive folder (or its 01-semrush subfolder)." },
        { status: 404 },
      );
    }

    const ordered = [...files].sort((a, b) => a.fileName.localeCompare(b.fileName)).slice(0, DEFAULT_RULES.maxFiles);
    const parsed: ParsedFile[] = [];
    const errors: FileStat[] = [];
    for (const f of ordered) {
      try {
        parsed.push(await parseUpload(f.fileName, f.buffer));
      } catch (e) {
        errors.push({ fileName: f.fileName, rows: 0, sourceGroup: "", usedGroupColumn: false, error: (e as Error).message });
      }
    }

    if (parsed.length === 0) {
      return NextResponse.json({ error: "No Drive files could be parsed", files: errors }, { status: 422 });
    }

    const result = ingestParsedFiles(parsed, property, rules, errors);
    return NextResponse.json({ ...result, semrushFolderId, outputFolderId });
  } catch (e) {
    return NextResponse.json({ error: `Drive sync failed: ${(e as Error).message}` }, { status: 502 });
  }
}

