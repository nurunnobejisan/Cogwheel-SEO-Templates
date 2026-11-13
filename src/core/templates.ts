import "server-only";
import { extractGoogleDocId, getDocsClient, getDriveClient, getSheetsClient } from "@/core/google";

/**
 * Resolves a Google template ID from an environment variable key,
 * with an optional explicit URL/ID override.
 */
export function resolveTemplateId(envVarKey: string, overrideUrlOrId?: string): string | undefined {
  const fromOverride = extractGoogleDocId(overrideUrlOrId);
  if (fromOverride) return fromOverride;
  const rawEnv = process.env[envVarKey];
  return extractGoogleDocId(rawEnv);
}

/**
 * Clones any fixed Google Drive template (Doc, Sheet, or Slides) into the target folder
 * without altering the template structure.
 */
export async function cloneDriveTemplate(opts: {
  templateId: string;
  title: string;
  folderId?: string;
}): Promise<{ fileId: string; webViewLink: string }> {
  const drive = getDriveClient();
  const targetFolderId = opts.folderId || process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || undefined;
  const res = await drive.files.copy({
    fileId: opts.templateId,
    supportsAllDrives: true,
    requestBody: {
      name: opts.title,
      ...(targetFolderId ? { parents: [targetFolderId] } : {}),
    },
    fields: "id, webViewLink",
  });
  const fileId = res.data.id;
  if (!fileId) {
    throw new Error(`Drive copy returned no file ID for template ${opts.templateId}`);
  }
  return {
    fileId,
    webViewLink: res.data.webViewLink || `https://docs.google.com/document/d/${fileId}/edit`,
  };
}

/**
 * Replaces `{{PLACEHOLDER}}` tokens in a cloned Google Doc without changing template structure.
 */
export async function fillDocPlaceholders(
  docId: string,
  replacements: Record<string, string>,
): Promise<void> {
  const entries = Object.entries(replacements);
  if (entries.length === 0) return;

  const docs = getDocsClient();
  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: entries.map(([placeholder, value]) => ({
        replaceAllText: {
          containsText: { text: placeholder, matchCase: true },
          replaceText: value,
        },
      })),
    },
  });
}

/**
 * Fills named ranges or A1 ranges in a cloned Google Sheet without changing template structure.
 */
export async function fillSheetNamedRanges(
  spreadsheetId: string,
  updates: Array<{ range: string; values: Array<Array<string | number | null>> }>,
): Promise<void> {
  if (updates.length === 0) return;
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: updates.map((u) => ({
        range: u.range,
        values: u.values,
      })),
    },
  });
}

