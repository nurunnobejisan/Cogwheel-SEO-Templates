import "server-only";
import { google, type docs_v1, type drive_v3, type sheets_v4, type slides_v1 } from "googleapis";
import { isGoogleConfigured } from "@/lib/google";

export {
  createHiltonContentDoc,
  createKeywordReportDoc,
  exportGoogleDoc,
  extractGoogleDocId,
  extractGoogleFolderId,
  extractPlaceholdersFromDoc,
  inspectGoogleDocTemplate,
  isGoogleConfigured,
  listAndDownloadDriveExports,
  type DriveSyncedFile,
  type HiltonDocInput,
  type HiltonDocResult,
  type HiltonDocSection,
  type KeywordDocInput,
  type KeywordDocResult,
  type RationaleEntry,
  type TemplateInspection,
} from "@/lib/google";

const WORKSPACE_SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/presentations",
];

function getServiceAccountCredentials(): { client_email: string; private_key: string } {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_B64;
  if (!b64) throw new Error("GOOGLE_SERVICE_ACCOUNT_B64 is not set");
  const json = Buffer.from(b64, "base64").toString("utf-8");
  return JSON.parse(json) as { client_email: string; private_key: string };
}

export function getWorkspaceAuth() {
  if (!isGoogleConfigured()) {
    throw new Error("Google Workspace credentials are not configured (GOOGLE_SERVICE_ACCOUNT_B64).");
  }
  const creds = getServiceAccountCredentials();
  return new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: WORKSPACE_SCOPES,
  });
}

export function getDriveClient(): drive_v3.Drive {
  return google.drive({ version: "v3", auth: getWorkspaceAuth() });
}

export function getDocsClient(): docs_v1.Docs {
  return google.docs({ version: "v1", auth: getWorkspaceAuth() });
}

export function getSheetsClient(): sheets_v4.Sheets {
  return google.sheets({ version: "v4", auth: getWorkspaceAuth() });
}

export function getSlidesClient(): slides_v1.Slides {
  return google.slides({ version: "v1", auth: getWorkspaceAuth() });
}
