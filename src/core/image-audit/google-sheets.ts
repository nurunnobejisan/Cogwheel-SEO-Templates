import { getDriveClient, getSheetsClient, isGoogleConfigured } from "../google.ts";
import type { CrawlLogEntry, ImageAuditItem, ImageAuditSummary } from "./types.ts";

export async function exportAuditToGoogleSheets(
  summary: ImageAuditSummary,
  items: ImageAuditItem[],
  crawlLog: CrawlLogEntry[]
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  if (!isGoogleConfigured()) {
    throw new Error(
      "Google Workspace service account is not configured. Set GOOGLE_SERVICE_ACCOUNT_B64 or GOOGLE_SERVICE_ACCOUNT_JSON in environment variables."
    );
  }

  const drive = getDriveClient();
  const sheets = getSheetsClient();

  const title = `Image Optimization Audit — ${new URL(summary.websiteUrl).hostname} (${new Date().toISOString().split("T")[0]})`;
  const folderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || undefined;

  // 1. Create native Google Sheet
  const createRes = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: title,
      mimeType: "application/vnd.google-apps.spreadsheet",
      ...(folderId ? { parents: [folderId] } : {}),
    },
    fields: "id, webViewLink",
  });

  const spreadsheetId = createRes.data.id!;
  const spreadsheetUrl =
    createRes.data.webViewLink || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // 2. Setup tabs: "Image Optimization", "Overview", "Image Inventory", "Recommendations", "Crawl Log"
  const batchUpdateRequest = {
    requests: [
      {
        updateSheetProperties: {
          properties: {
            sheetId: 0,
            title: "Image Optimization",
          },
          fields: "title",
        },
      },
      { addSheet: { properties: { title: "Overview" } } },
      { addSheet: { properties: { title: "Image Inventory" } } },
      { addSheet: { properties: { title: "Recommendations" } } },
      { addSheet: { properties: { title: "Crawl Log" } } },
    ],
  };

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: batchUpdateRequest,
  });

  // 3. Populate Image Optimization tab (Matching reference sheet)
  const optHeaders = [
    "Image",
    "URL ",
    "Title ",
    "Length",
    "Optimized ALT Text",
    "Length",
    "Format",
    "Size (KB)",
    "Dimensions",
    "Status / Issue",
    "Recommendation",
    "Priority",
  ];
  const optValues = [
    optHeaders,
    ...items.map((item, idx) => {
      const r = idx + 2;
      const cleanTitle = item.imageUrl.split("/").pop()?.split("?")[0] || "Image";
      const dim = item.htmlWidth && item.htmlHeight ? `${item.htmlWidth}x${item.htmlHeight}` : "-";
      return [
        `=IMAGE(B${r})`,
        item.imageUrl,
        cleanTitle,
        `=LEN(C${r})`,
        item.proposedAlt,
        `=LEN(E${r})`,
        item.format,
        item.fileSizeKb ?? "-",
        dim,
        item.issues.map((i) => i.label).join("; ") || "Healthy",
        item.recommendation,
        item.priority,
      ];
    }),
  ];

  // 4. Populate Overview tab
  const overviewValues = [
    ["WEBSITE IMAGE OPTIMIZATION AUDIT REPORT", ""],
    ["Audited Website", summary.websiteUrl],
    ["Domain Origin", summary.origin],
    ["Timestamp", summary.crawledAt],
    ["Crawl Limit", `${summary.maxPagesLimit} pages`],
    ["Duration", `${Math.round(summary.durationMs / 1000)}s`],
    ["", ""],
    ["METRIC", "COUNT"],
    ["Pages Crawled", summary.pagesScanned],
    ["Total Images Audited", summary.totalImagesFound],
    ["Broken Images (4xx/5xx)", summary.brokenImagesCount],
    ["Missing Alt Attributes", summary.missingAltCount],
    ["Oversized Assets (>100KB)", summary.oversizedImagesCount],
    ["Missing Dimensions (CLS Risk)", summary.missingDimensionsCount],
    ["Legacy Formats (JPEG/PNG)", summary.legacyFormatCount],
    ["Above-The-Fold Lazy Loaded", summary.aboveFoldLazyCount],
    ["", ""],
    ["TOP FINDINGS", ""],
    ...summary.topFindings.map((f, i) => [`${i + 1}.`, f]),
  ];

  // 5. Populate Crawl Log
  const logValues = [
    ["Page URL", "Status", "Title", "Response Time (ms)", "Images", "Crawl Result", "Notes"],
    ...crawlLog.map((c) => [
      c.url,
      c.statusCode || "ERR",
      c.title || "-",
      c.responseTimeMs,
      c.imagesFound,
      c.status.toUpperCase(),
      c.notes || "-",
    ]),
  ];

  // Push values
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [
        {
          range: "'Image Optimization'!A1",
          values: optValues,
        },
        {
          range: "'Overview'!A1",
          values: overviewValues,
        },
        {
          range: "'Crawl Log'!A1",
          values: logValues,
        },
      ],
    },
  });

  return { spreadsheetId, spreadsheetUrl };
}
