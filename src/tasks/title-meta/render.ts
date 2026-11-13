import { getDocsClient, getDriveClient, isGoogleConfigured } from "@/core/google";
import { cloneDriveTemplate, resolveTemplateId } from "@/core/templates";
import { stripDiffMarkers } from "@/lib/hilton-validator";
import type { Property } from "@/lib/types";
import type { TitleMetaRowDraft } from "./schema";

export interface RenderedTitleMetaRow extends TitleMetaRowDraft {
  titleCharCount: number;
  metaCharCount: number;
}

export interface TitleMetaOutput {
  docId: string | null;
  docUrl: string | null;
  usedTemplateCopy: boolean;
  rows: RenderedTitleMetaRow[];
}

export async function renderTitleMetaDoc(opts: {
  property: Pick<Property, "name" | "brand" | "city" | "state" | "url">;
  rows: TitleMetaRowDraft[];
}): Promise<TitleMetaOutput> {
  const renderedRows: RenderedTitleMetaRow[] = opts.rows.map((r) => ({
    ...r,
    titleCharCount: stripDiffMarkers(r.proposedTitle).length,
    metaCharCount: stripDiffMarkers(r.proposedMeta).length,
  }));

  if (!isGoogleConfigured()) {
    return {
      docId: null,
      docUrl: null,
      usedTemplateCopy: false,
      rows: renderedRows,
    };
  }

  const title = `${opts.property.name} — Title & Meta Descriptions`;
  const templateId = resolveTemplateId("GOOGLE_TEMPLATE_DOC_ID_TITLE_META");
  const docs = getDocsClient();
  const drive = getDriveClient();

  let docId: string;
  let docUrl: string;
  let usedTemplateCopy = false;

  if (templateId) {
    const cloned = await cloneDriveTemplate({ templateId, title });
    docId = cloned.fileId;
    docUrl = cloned.webViewLink;
    usedTemplateCopy = true;
  } else {
    const folderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || undefined;
    const created = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: title,
        mimeType: "application/vnd.google-apps.document",
        ...(folderId ? { parents: [folderId] } : {}),
      },
      fields: "id, webViewLink",
    });
    docId = created.data.id!;
    docUrl = created.data.webViewLink || `https://docs.google.com/document/d/${docId}/edit`;
  }

  const lines = [
    `${opts.property.name} — Title & Meta Description Recommendations`,
    `Property URL: ${opts.property.url || "N/A"} | Market: ${opts.property.city}, ${opts.property.state}`,
    "",
    "Page | URL | Current Title | Proposed Title | Char Count | Current Meta | Proposed Meta | Char Count | Primary Keyword | Notes",
    ...renderedRows.map(
      (r) =>
        `${r.page} | ${r.url} | ${r.currentTitle || "-"} | ${r.proposedTitle} | ${r.titleCharCount} | ${r.currentMeta || "-"} | ${r.proposedMeta} | ${r.metaCharCount} | ${r.primaryKeyword || "-"} | ${r.notes || "-"}`,
    ),
  ];

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: `${lines.join("\n")}\n`,
          },
        },
      ],
    },
  });

  return {
    docId,
    docUrl,
    usedTemplateCopy,
    rows: renderedRows,
  };
}

