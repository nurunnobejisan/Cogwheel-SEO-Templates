import * as XLSX from "xlsx";
import { getDriveClient, getSheetsClient, isGoogleConfigured } from "@/core/google";
import { cloneDriveTemplate, fillSheetNamedRanges, resolveTemplateId } from "@/core/templates";
import type { Property } from "@/lib/types";
import type { HeadingStructureRowDraft } from "./schema";

export interface HeadingStructureOutput {
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  usedTemplateCopy: boolean;
  xlsxBase64: string;
  rows: HeadingStructureRowDraft[];
}

const HEADERS = [
  "Page",
  "URL",
  "Current H1",
  "Proposed H1",
  "Current H2 List",
  "Proposed H2 List",
  "Issue",
  "Primary Keyword",
  "Notes",
];

function rowsToSheetMatrix(rows: HeadingStructureRowDraft[]): string[][] {
  return [
    HEADERS,
    ...rows.map((r) => [
      r.page,
      r.url,
      r.currentH1 || "-",
      r.proposedH1,
      r.currentH2List.join(" | ") || "-",
      r.proposedH2List.join(" | "),
      r.issue,
      r.primaryKeyword || "-",
      r.notes || "-",
    ]),
  ];
}

function buildXlsxBase64(rows: HeadingStructureRowDraft[], templatePath?: string): string {
  const wb = templatePath ? XLSX.readFile(templatePath) : XLSX.utils.book_new();
  const sheetName = wb.SheetNames[0] || "Heading Structure";
  const matrix = rowsToSheetMatrix(rows);
  const ws = XLSX.utils.aoa_to_sheet(matrix);
  if (wb.SheetNames.length === 0) {
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  } else {
    wb.Sheets[sheetName] = ws;
  }
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return buf.toString("base64");
}

export async function renderHeadingStructureOutput(opts: {
  property: Pick<Property, "name" | "brand" | "city" | "state" | "url">;
  rows: HeadingStructureRowDraft[];
  templatePath?: string;
}): Promise<HeadingStructureOutput> {
  const xlsxBase64 = buildXlsxBase64(opts.rows, opts.templatePath);

  if (!isGoogleConfigured()) {
    return {
      spreadsheetId: null,
      spreadsheetUrl: null,
      usedTemplateCopy: false,
      xlsxBase64,
      rows: opts.rows,
    };
  }

  const title = `${opts.property.name} — Heading Structure Optimization`;
  const templateId = resolveTemplateId("GOOGLE_TEMPLATE_SHEET_ID_HEADINGS");
  const drive = getDriveClient();
  const sheets = getSheetsClient();

  let spreadsheetId: string;
  let spreadsheetUrl: string;
  let usedTemplateCopy = false;

  if (templateId) {
    const cloned = await cloneDriveTemplate({ templateId, title });
    spreadsheetId = cloned.fileId;
    spreadsheetUrl = cloned.webViewLink;
    usedTemplateCopy = true;
  } else {
    const folderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || undefined;
    const created = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: title,
        mimeType: "application/vnd.google-apps.spreadsheet",
        ...(folderId ? { parents: [folderId] } : {}),
      },
      fields: "id, webViewLink",
    });
    spreadsheetId = created.data.id!;
    spreadsheetUrl = created.data.webViewLink || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  }

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const firstSheetTitle = meta.data.sheets?.[0]?.properties?.title || "Sheet1";

  await fillSheetNamedRanges(spreadsheetId, [
    {
      range: `'${firstSheetTitle}'!A1`,
      values: rowsToSheetMatrix(opts.rows),
    },
  ]);

  return {
    spreadsheetId,
    spreadsheetUrl,
    usedTemplateCopy,
    xlsxBase64,
    rows: opts.rows,
  };
}

