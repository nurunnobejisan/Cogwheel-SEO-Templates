import * as XLSX from "xlsx";
import { getDriveClient, getSheetsClient, isGoogleConfigured } from "@/core/google";
import { cloneDriveTemplate, fillSheetNamedRanges, resolveTemplateId } from "@/core/templates";

export interface TabularSheetExportResult {
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  usedTemplateCopy: boolean;
  xlsxBase64: string;
}

export async function renderTabularSheetOutput(opts: {
  title: string;
  sheetName: string;
  headers: string[];
  rows: string[][];
  templateEnvKey?: string;
}): Promise<TabularSheetExportResult> {
  const matrix = [opts.headers, ...opts.rows];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(matrix);
  XLSX.utils.book_append_sheet(wb, ws, opts.sheetName.slice(0, 31));
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const xlsxBase64 = buf.toString("base64");

  if (!isGoogleConfigured()) {
    return {
      spreadsheetId: null,
      spreadsheetUrl: null,
      usedTemplateCopy: false,
      xlsxBase64,
    };
  }

  const templateId = opts.templateEnvKey ? resolveTemplateId(opts.templateEnvKey) : undefined;
  const drive = getDriveClient();
  const sheets = getSheetsClient();

  let spreadsheetId: string;
  let spreadsheetUrl: string;
  let usedTemplateCopy = false;

  if (templateId) {
    const cloned = await cloneDriveTemplate({ templateId, title: opts.title });
    spreadsheetId = cloned.fileId;
    spreadsheetUrl = cloned.webViewLink;
    usedTemplateCopy = true;
  } else {
    const folderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || undefined;
    const created = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: opts.title,
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
      values: matrix,
    },
  ]);

  return {
    spreadsheetId,
    spreadsheetUrl,
    usedTemplateCopy,
    xlsxBase64,
  };
}

