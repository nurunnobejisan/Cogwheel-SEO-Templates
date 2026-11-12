import "server-only";
import { google, type docs_v1, type drive_v3 } from "googleapis";
import { TEMPLATES } from "@/config/templates";
import { BUCKETS } from "@/lib/engine/bucket";
import { parseDiffSegments } from "@/lib/hilton-validator";
import type { MatrixRow, PoolEntry, Property, SitemapPage, TemplateId } from "@/lib/types";

interface ServiceAccountCreds {
  client_email: string;
  private_key: string;
}

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_B64 || process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
}

function loadCredentials(): ServiceAccountCreds {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_B64;
  const raw = b64 ? Buffer.from(b64, "base64").toString("utf-8") : process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Google Workspace credentials not configured (GOOGLE_SERVICE_ACCOUNT_B64)");
  const parsed = JSON.parse(raw) as Partial<ServiceAccountCreds>;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("Invalid Google service account JSON: missing client_email or private_key");
  }
  return { client_email: parsed.client_email, private_key: parsed.private_key };
}

function getGoogleClients(): { drive: drive_v3.Drive; docs: docs_v1.Docs } {
  const credentials = loadCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/documents",
    ],
  });
  return {
    drive: google.drive({ version: "v3", auth }),
    docs: google.docs({ version: "v1", auth }),
  };
}

export interface RationaleEntry {
  pageId: string;
  title: string;
  text: string;
}

export interface KeywordDocInput {
  property: Property;
  pages: SitemapPage[];
  template: TemplateId;
  matrix: MatrixRow[];
  pool: PoolEntry[];
  rationales: RationaleEntry[];
}

export interface KeywordDocResult {
  docId: string;
  docUrl: string;
  usedTemplateCopy: boolean;
  preservedTemplateDesign?: boolean;
  unresolvedPlaceholders?: string[];
}

export interface TemplateInspection {
  docId: string;
  title: string;
  headings: Array<{ level: number; text: string }>;
  tableCount: number;
  paragraphCount: number;
  hasHeader: boolean;
  hasFooter: boolean;
  placeholders: string[];
}

type TableSpec = { rows: string[][] };

type DocBlock =
  | { kind: "heading"; text: string; level: 1 | 2 | 3 }
  | { kind: "paragraph"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "table"; table: TableSpec };

function buildDocumentBlocks(input: KeywordDocInput): DocBlock[] {
  const tmpl = TEMPLATES[input.template];
  const blocks: DocBlock[] = [];

  blocks.push({ kind: "heading", level: 1, text: `${input.property.name} — Keyword Recommendation Report` });
  const metaLines = [
    `Market: ${input.property.city}, ${input.property.state}${input.property.brand ? ` (${input.property.brand})` : ""}`,
    input.property.url ? `URL: ${input.property.url}` : null,
    `Format: ${tmpl.name} (${tmpl.clients})`,
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
  ].filter(Boolean) as string[];
  blocks.push({ kind: "paragraph", text: metaLines.join("\n") });

  if (input.property.notes?.trim()) {
    blocks.push({ kind: "heading", level: 2, text: "Property Notes" });
    blocks.push({ kind: "paragraph", text: input.property.notes.trim() });
  }

  if (tmpl.includeCurrentSitemap) {
    blocks.push({ kind: "heading", level: 2, text: "Current Sitemap" });
    const activePages = input.pages.filter((p) => p.active);
    for (const p of activePages) {
      blocks.push({ kind: "bullet", text: `${p.title} (${p.path})` });
    }
  }

  // Recommendation Table
  blocks.push({ kind: "heading", level: 2, text: "Keyword Recommendations" });
  const recRows: string[][] = [
    tmpl.usesSecondaryKeywords
      ? ["Page", "Primary Keyword", "Secondary Keyword"]
      : ["Page", "Primary Keyword"],
  ];
  for (const row of input.matrix) {
    const primaryLabel = row.primary
      ? `${row.primary.keyword} (SV: ${row.primary.volume.toLocaleString()}, KD: ${row.primary.kd ?? "N/A"})`
      : "No Data";
    if (tmpl.usesSecondaryKeywords) {
      const secLabel = row.secondary
        ? `${row.secondary.keyword} (SV: ${row.secondary.volume.toLocaleString()}, KD: ${row.secondary.kd ?? "N/A"})`
        : "—";
      recRows.push([`${row.title}\n${row.path}`, primaryLabel, secLabel]);
    } else {
      recRows.push([`${row.title}\n${row.path}`, primaryLabel]);
    }
  }
  blocks.push({ kind: "table", table: { rows: recRows } });

  // Rationale Section
  blocks.push({ kind: "heading", level: 2, text: tmpl.rationaleHeading });
  for (const r of input.rationales) {
    if (tmpl.rationaleStyle === "bullets") {
      blocks.push({ kind: "bullet", text: `${r.title}: ${r.text}` });
    } else {
      blocks.push({ kind: "heading", level: 3, text: r.title });
      blocks.push({ kind: "paragraph", text: r.text });
    }
  }

  // 78-Keyword Bucket Tables (insert "No Data" for empty buckets)
  blocks.push({ kind: "heading", level: 2, text: `78-Keyword Pool by Bucket (${input.pool.length} keywords)` });
  const byBucket = new Map<string, PoolEntry[]>();
  for (const kw of input.pool) {
    const id = kw.bucketId ?? "unassigned";
    const list = byBucket.get(id) ?? [];
    list.push(kw);
    byBucket.set(id, list);
  }

  const orderedBuckets: Array<{ id: string; name: string }> = BUCKETS.map((b) => ({ id: b.id, name: b.name }));
  for (const [id, list] of byBucket.entries()) {
    if (!orderedBuckets.some((b) => b.id === id)) {
      orderedBuckets.push({ id, name: list[0]?.bucketName ?? id });
    }
  }

  for (const bucket of orderedBuckets) {
    const kws = byBucket.get(bucket.id) ?? [];
    blocks.push({ kind: "heading", level: 3, text: bucket.name });
    if (kws.length === 0) {
      blocks.push({ kind: "table", table: { rows: [["Keyword", "Volume", "KD", "Role"], ["No Data", "—", "—", "—"]] } });
    } else {
      const rows: string[][] = [["Keyword", "Volume", "KD", "Role"]];
      for (const k of kws) {
        rows.push([
          k.keyword,
          k.volume.toLocaleString(),
          k.kd === null ? "N/A" : String(k.kd),
          k.pageId ? `${k.role} (${k.pageId})` : k.role,
        ]);
      }
      blocks.push({ kind: "table", table: { rows } });
    }
  }

  return blocks;
}

export function extractGoogleDocId(urlOrId?: string): string | undefined {
  const s = (urlOrId ?? "").trim();
  if (!s) return undefined;
  const m = s.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  return /^[a-zA-Z0-9_-]{20,}$/.test(s) ? s : undefined;
}

function collectDocText(doc: docs_v1.Schema$Document): string {
  const chunks: string[] = [];
  const walkElements = (elements?: docs_v1.Schema$StructuralElement[]) => {
    for (const el of elements ?? []) {
      if (el.paragraph) {
        for (const pe of el.paragraph.elements ?? []) {
          if (pe.textRun?.content) chunks.push(pe.textRun.content);
        }
      } else if (el.table) {
        for (const row of el.table.tableRows ?? []) {
          for (const cell of row.tableCells ?? []) {
            walkElements(cell.content);
          }
        }
      }
    }
  };
  walkElements(doc.body?.content);
  for (const h of Object.values(doc.headers ?? {})) walkElements(h.content);
  for (const f of Object.values(doc.footers ?? {})) walkElements(f.content);
  return chunks.join("");
}

export function extractPlaceholdersFromDoc(doc: docs_v1.Schema$Document): string[] {
  const text = collectDocText(doc);
  return [...new Set([...text.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)].map((m) => `{{${m[1]}}}`))];
}

export async function inspectGoogleDocTemplate(urlOrId: string): Promise<TemplateInspection> {
  const docId = extractGoogleDocId(urlOrId);
  if (!docId) throw new Error("Invalid Google Docs URL or document ID.");
  const { docs } = getGoogleClients();
  const res = await docs.documents.get({ documentId: docId });
  const doc = res.data;

  const headings: Array<{ level: number; text: string }> = [];
  let tableCount = 0;
  let paragraphCount = 0;

  for (const el of doc.body?.content ?? []) {
    if (el.table) {
      tableCount++;
    } else if (el.paragraph) {
      paragraphCount++;
      const named = el.paragraph.paragraphStyle?.namedStyleType ?? "";
      const match = named.match(/^HEADING_(\d)$/);
      if (match) {
        const text = (el.paragraph.elements ?? [])
          .map((e) => e.textRun?.content ?? "")
          .join("")
          .trim();
        if (text) headings.push({ level: Number(match[1]), text });
      }
    }
  }

  return {
    docId,
    title: doc.title ?? "Untitled Template",
    headings,
    tableCount,
    paragraphCount,
    hasHeader: Object.keys(doc.headers ?? {}).length > 0,
    hasFooter: Object.keys(doc.footers ?? {}).length > 0,
    placeholders: extractPlaceholdersFromDoc(doc),
  };
}

export async function exportGoogleDoc(docId: string, format: "pdf" | "docx"): Promise<Buffer> {
  const { drive } = getGoogleClients();
  const mimeType =
    format === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const res = await drive.files.export(
    { fileId: docId, mimeType },
    { responseType: "arraybuffer" },
  );
  return Buffer.from(res.data as ArrayBuffer);
}

export function extractGoogleFolderId(urlOrId?: string): string | undefined {
  const s = (urlOrId ?? "").trim();
  if (!s) return undefined;
  const m = s.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  return /^[a-zA-Z0-9_-]{15,}$/.test(s) ? s : undefined;
}

export interface DriveSyncedFile {
  fileName: string;
  buffer: ArrayBuffer;
}

/**
 * Read all CSV/XLSX/XLS/TSV files from a property's Google Drive folder.
 * If a `01-semrush` subfolder exists, reads from it; also resolves `03-output` if present.
 */
export async function listAndDownloadDriveExports(folderUrlOrId: string): Promise<{
  files: DriveSyncedFile[];
  semrushFolderId: string;
  outputFolderId?: string;
}> {
  const rootId = extractGoogleFolderId(folderUrlOrId);
  if (!rootId) throw new Error("Invalid Google Drive folder URL or ID");

  const { drive } = getGoogleClients();
  const children = await drive.files.list({
    q: `'${rootId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    pageSize: 100,
  });

  const folders = (children.data.files ?? []).filter(
    (f) => f.mimeType === "application/vnd.google-apps.folder",
  );
  const semrushSub = folders.find((f) => /^01[-_\s]?semrush/i.test(f.name ?? ""));
  const outputSub = folders.find((f) => /^03[-_\s]?output/i.test(f.name ?? ""));
  const semrushFolderId = semrushSub?.id ?? rootId;

  const listRes =
    semrushFolderId === rootId
      ? children
      : await drive.files.list({
          q: `'${semrushFolderId}' in parents and trashed = false`,
          fields: "files(id, name, mimeType)",
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          pageSize: 100,
        });

  const exportFiles = (listRes.data.files ?? []).filter((f) =>
    /\.(csv|xlsx|xls|tsv)$/i.test(f.name ?? ""),
  );

  const files: DriveSyncedFile[] = [];
  for (const f of exportFiles) {
    if (!f.id || !f.name) continue;
    const media = await drive.files.get(
      { fileId: f.id, alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" },
    );
    files.push({ fileName: f.name, buffer: media.data as ArrayBuffer });
  }

  return {
    files,
    semrushFolderId,
    outputFolderId: outputSub?.id ?? undefined,
  };
}

export async function createKeywordReportDoc(input: KeywordDocInput): Promise<KeywordDocResult> {
  const { drive, docs } = getGoogleClients();
  const folderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || undefined;
  const templateId =
    extractGoogleDocId(input.property.templateDocUrl) ??
    (input.template === "A"
      ? process.env.GOOGLE_TEMPLATE_DOC_ID_A || "1TIGp2n1UAfz_UKGyJl4ZK-jdcITxsjO6EgqRvy1CVSw"
      : process.env.GOOGLE_TEMPLATE_DOC_ID_B);

  const docTitle = `${input.property.name} — Keyword Report (Format ${input.template})`;
  let docId: string;
  let usedTemplateCopy = false;

  if (templateId) {
    const copied = await drive.files.copy({
      fileId: templateId,
      supportsAllDrives: true,
      requestBody: {
        name: docTitle,
        parents: folderId ? [folderId] : undefined,
      },
    });
    if (!copied.data.id) throw new Error("Drive copy returned no file id");
    docId = copied.data.id;
    usedTemplateCopy = true;
  } else {
    const created = await docs.documents.create({ requestBody: { title: docTitle } });
    if (!created.data.documentId) throw new Error("Docs create returned no documentId");
    docId = created.data.documentId;
    if (folderId) {
      const file = await drive.files.get({ fileId: docId, fields: "parents", supportsAllDrives: true });
      const prevParents = (file.data.parents ?? []).join(",");
      await drive.files.update({
        fileId: docId,
        addParents: folderId,
        removeParents: prevParents || undefined,
        supportsAllDrives: true,
      });
    }
  }

  const existing = await docs.documents.get({ documentId: docId });
  const templatePlaceholders = usedTemplateCopy ? extractPlaceholdersFromDoc(existing.data) : [];

  if (usedTemplateCopy && templatePlaceholders.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const primarySummary = input.matrix
      .filter((r) => r.primary)
      .map((r) => `${r.title} (${r.path}): ${r.primary!.keyword} — SV ${r.primary!.volume.toLocaleString()}, KD ${r.primary!.kd ?? "N/A"}`)
      .join("\n");
    const secondarySummary = input.matrix
      .filter((r) => r.secondary)
      .map((r) => `${r.title}: ${r.secondary!.keyword} — SV ${r.secondary!.volume.toLocaleString()}, KD ${r.secondary!.kd ?? "N/A"}`)
      .join("\n");
    const rationalesText = input.rationales.map((r) => `${r.title}\n${r.text}`).join("\n\n");

    const placeholderValues: Record<string, string> = {
      "{{HOTEL_NAME}}": input.property.name,
      "{{PROPERTY_NAME}}": input.property.name,
      "{{WEBSITE_URL}}": input.property.url ?? "",
      "{{BRAND}}": input.property.brand ?? "",
      "{{MARKET}}": `${input.property.city}, ${input.property.state}`,
      "{{CITY}}": input.property.city,
      "{{STATE}}": input.property.state,
      "{{REPORT_DATE}}": today,
      "{{PROPERTY_OVERVIEW}}": `${input.property.name} in ${input.property.city}, ${input.property.state}${input.property.url ? ` (${input.property.url})` : ""}`,
      "{{EXECUTIVE_SUMMARY}}": `Keyword research and mapping across ${input.matrix.length} active pages and ${input.pool.length} pooled keywords for ${input.property.name}.`,
      "{{KEYWORD_RESEARCH}}": `${input.pool.length} keywords selected across ${BUCKETS.length} buckets.`,
      "{{PRIMARY_KEYWORDS}}": primarySummary || "None",
      "{{SECONDARY_KEYWORDS}}": secondarySummary || "None",
      "{{KEYWORD_MAPPING_TABLE}}": primarySummary || "None",
      "{{PAGE_RECOMMENDATIONS}}": rationalesText,
      "{{LOCAL_SEO_ANALYSIS}}": `Market: ${input.property.city}, ${input.property.state}. Allowed locations: ${input.property.allowedLocations.join(", ") || "Default"}.`,
      "{{GEO_RECOMMENDATIONS}}": rationalesText,
      "{{FINAL_RECOMMENDATIONS}}": rationalesText,
    };

    const requests: docs_v1.Schema$Request[] = Object.entries(placeholderValues)
      .filter(([token]) => templatePlaceholders.includes(token))
      .map(([token, value]) => ({
        replaceAllText: {
          containsText: { text: token, matchCase: true },
          replaceText: value,
        },
      }));

    if (requests.length > 0) {
      await docs.documents.batchUpdate({ documentId: docId, requestBody: { requests } });
    }

    const verified = await docs.documents.get({ documentId: docId });
    const unresolvedPlaceholders = extractPlaceholdersFromDoc(verified.data);

    return {
      docId,
      docUrl: `https://docs.google.com/document/d/${docId}/edit`,
      usedTemplateCopy: true,
      preservedTemplateDesign: true,
      unresolvedPlaceholders,
    };
  }

  const blocks = buildDocumentBlocks(input);
  const bodyContent = existing.data.body?.content ?? [];
  const lastEnd = bodyContent[bodyContent.length - 1]?.endIndex ?? 1;
  let cursor = Math.max(1, lastEnd - 1);

  // If copying a template with existing content (and no {{PLACEHOLDERS}}), clear body before populating
  const pass1: docs_v1.Schema$Request[] = [];
  if (usedTemplateCopy && cursor > 1) {
    pass1.push({ deleteContentRange: { range: { startIndex: 1, endIndex: cursor } } });
    cursor = 1;
  }

  const tableSpecs: TableSpec[] = [];
  for (const block of blocks) {
    if (block.kind === "table") {
      tableSpecs.push(block.table);
      const rows = block.table.rows.length;
      const cols = block.table.rows[0]?.length ?? 1;
      pass1.push({ insertTable: { rows, columns: cols, location: { index: cursor } } });
      // An empty table occupies 1 (table start) + rows*(1 + cols*2) + 1 chars approx; re-read doc in pass 2.
      // We insert sequentially from endOfSegmentLocation after pass 1? No — Docs API supports endOfSegmentLocation!
      // Using endOfSegmentLocation avoids manual index math completely in pass 1.
      pass1.pop();
      pass1.push({ insertTable: { rows, columns: cols, endOfSegmentLocation: { segmentId: "" } } });
      continue;
    }

    const line = `${block.text}\n`;
    const namedStyle =
      block.kind === "heading"
        ? (`HEADING_${block.level}` as "HEADING_1" | "HEADING_2" | "HEADING_3")
        : "NORMAL_TEXT";

    pass1.push({ insertText: { text: line, endOfSegmentLocation: { segmentId: "" } } });
    // Style will be applied in pass 2 or via text ranges; let's track by reading doc in pass 2?
    // Even simpler: compute exact start/end in pass 1? Not if insertTable shifts by variable amount.
    // So we record paragraph styles? Actually, if we insert text BEFORE tables or track paragraph order, we can style in pass 2,
    // OR we only use endOfSegmentLocation in pass 1 and populate tables + bullets in pass 2!
    void namedStyle;
  }

  await docs.documents.batchUpdate({ documentId: docId, requestBody: { requests: pass1 } });

  // Pass 2: Read the document to get exact indices for headings, bullets, and table cells.
  const populated = await docs.documents.get({ documentId: docId });
  const elements = populated.data.body?.content ?? [];

  const textInsertions: Array<{ index: number; text: string; bold?: boolean }> = [];
  const styleRequests: docs_v1.Schema$Request[] = [];

  // Match tables in order
  const docTables = elements.filter((el) => el.table).map((el) => el.table!);
  docTables.forEach((docTable, tIdx) => {
    const spec = tableSpecs[tIdx];
    if (!spec) return;
    spec.rows.forEach((rowCells, rIdx) => {
      const tableRow = docTable.tableRows?.[rIdx];
      if (!tableRow) return;
      rowCells.forEach((cellText, cIdx) => {
        const cell = tableRow.tableCells?.[cIdx];
        const pStart = cell?.content?.[0]?.paragraph?.elements?.[0]?.startIndex;
        if (typeof pStart === "number" && cellText) {
          textInsertions.push({ index: pStart, text: cellText, bold: rIdx === 0 });
        }
      });
    });
  });

  // Match paragraphs (outside tables) to apply heading / bullet styles
  const nonTableBlocks = blocks.filter((b): b is Exclude<DocBlock, { kind: "table" }> => b.kind !== "table");
  const docParas = elements.filter((el) => el.paragraph && typeof el.startIndex === "number");
  let pCursor = 0;
  for (const block of nonTableBlocks) {
    // Find the next non-empty paragraph matching the start of block.text
    const firstLine = block.text.split("\n")[0];
    while (pCursor < docParas.length) {
      const el = docParas[pCursor++];
      const content = (el.paragraph?.elements ?? []).map((e) => e.textRun?.content ?? "").join("").trim();
      if (!content) continue;
      if (content.startsWith(firstLine.slice(0, 30))) {
        const start = el.startIndex!;
        const end = el.endIndex!;
        if (block.kind === "heading") {
          styleRequests.push({
            updateParagraphStyle: {
              range: { startIndex: start, endIndex: end },
              paragraphStyle: { namedStyleType: `HEADING_${block.level}` },
              fields: "namedStyleType",
            },
          });
        } else if (block.kind === "bullet") {
          styleRequests.push({
            createParagraphBullets: {
              range: { startIndex: start, endIndex: end },
              bulletPreset: "BULLET_DISC_CIRCLE_SQUARE",
            },
          });
        }
        break;
      }
    }
  }

  // Sort text insertions in descending index order so earlier indices never shift!
  textInsertions.sort((a, b) => b.index - a.index);
  const pass2: docs_v1.Schema$Request[] = [...styleRequests];
  for (const ins of textInsertions) {
    pass2.push({ insertText: { text: ins.text, location: { index: ins.index } } });
    if (ins.bold) {
      pass2.push({
        updateTextStyle: {
          range: { startIndex: ins.index, endIndex: ins.index + ins.text.length },
          textStyle: { bold: true },
          fields: "bold",
        },
      });
    }
  }

  if (pass2.length > 0) {
    await docs.documents.batchUpdate({ documentId: docId, requestBody: { requests: pass2 } });
  }

  return {
    docId,
    docUrl: `https://docs.google.com/document/d/${docId}/edit`,
    usedTemplateCopy,
  };
}

export interface HiltonDocSection {
  id: string;
  label: string;
  keyword?: string;
  /** Diff-marked text (`**added**`, `~~removed~~`) or plain text. */
  content: string;
}

export interface HiltonDocInput {
  property: Property;
  sections: HiltonDocSection[];
}

export interface HiltonDocResult {
  docId: string;
  docUrl: string;
  usedTemplateCopy: boolean;
  strippedInstructionsCount: number;
}

/**
 * Clone the Hilton Google Doc template (or create a new Doc), strip all
 * "REMOVE THESE INSTRUCTIONS" blocks, and populate each section with native
 * Google Docs bold (`**...**`) and strikethrough (`~~...~~`) styling.
 */
export async function createHiltonContentDoc(input: HiltonDocInput): Promise<HiltonDocResult> {
  const { drive, docs } = getGoogleClients();
  const folderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || undefined;
  const templateId = process.env.GOOGLE_HILTON_TEMPLATE_DOC_ID || undefined;
  const docTitle = `${input.property.name} — Hilton SEO/GEO Content`;

  let docId: string;
  let usedTemplateCopy = false;

  if (templateId) {
    const copied = await drive.files.copy({
      fileId: templateId,
      supportsAllDrives: true,
      requestBody: { name: docTitle, parents: folderId ? [folderId] : undefined },
    });
    if (!copied.data.id) throw new Error("Drive copy returned no file id");
    docId = copied.data.id;
    usedTemplateCopy = true;
  } else {
    const created = await docs.documents.create({ requestBody: { title: docTitle } });
    if (!created.data.documentId) throw new Error("Docs create returned no documentId");
    docId = created.data.documentId;
    if (folderId) {
      const file = await drive.files.get({ fileId: docId, fields: "parents", supportsAllDrives: true });
      const prevParents = (file.data.parents ?? []).join(",");
      await drive.files.update({
        fileId: docId,
        addParents: folderId,
        removeParents: prevParents || undefined,
        supportsAllDrives: true,
      });
    }
  }

  // Step 1: Strip any "REMOVE THESE INSTRUCTIONS" blocks from the copied template.
  let strippedInstructionsCount = 0;
  if (usedTemplateCopy) {
    const existing = await docs.documents.get({ documentId: docId });
    const elements = existing.data.body?.content ?? [];
    const docEnd = elements[elements.length - 1]?.endIndex ?? 1;
    const rangesToDelete: Array<{ startIndex: number; endIndex: number }> = [];
    let blockStart: number | null = null;

    for (const el of elements) {
      if (!el.paragraph || typeof el.startIndex !== "number" || typeof el.endIndex !== "number") continue;
      const text = (el.paragraph.elements ?? []).map((e) => e.textRun?.content ?? "").join("");
      const upper = text.toUpperCase();
      if (upper.includes("REMOVE THESE INSTRUCTIONS START")) {
        blockStart = el.startIndex;
      } else if (upper.includes("REMOVE THESE INSTRUCTIONS END") && blockStart !== null) {
        rangesToDelete.push({ startIndex: blockStart, endIndex: Math.min(el.endIndex, docEnd - 1) });
        blockStart = null;
        strippedInstructionsCount++;
      } else if (blockStart === null && upper.includes("REMOVE THESE INSTRUCTIONS")) {
        rangesToDelete.push({ startIndex: el.startIndex, endIndex: Math.min(el.endIndex, docEnd - 1) });
        strippedInstructionsCount++;
      }
    }

    if (rangesToDelete.length > 0) {
      rangesToDelete.sort((a, b) => b.startIndex - a.startIndex);
      await docs.documents.batchUpdate({
        documentId: docId,
        requestBody: {
          requests: rangesToDelete
            .filter((r) => r.endIndex > r.startIndex)
            .map((r) => ({ deleteContentRange: { range: r } })),
        },
      });
    }
  }

  // Step 2: Build plain text + native formatting spans, then insert at end of doc.
  const fresh = await docs.documents.get({ documentId: docId });
  const freshContent = fresh.data.body?.content ?? [];
  let cursor = Math.max(1, (freshContent[freshContent.length - 1]?.endIndex ?? 1) - 1);

  let fullText = "";
  const headingRanges: Array<{ start: number; end: number; level: "HEADING_1" | "HEADING_2" }> = [];
  const styleSpans: Array<{ start: number; end: number; bold?: boolean; strikethrough?: boolean }> = [];

  const pushText = (t: string) => {
    const start = cursor + fullText.length;
    fullText += t;
    return { start, end: cursor + fullText.length };
  };

  const titleRange = pushText(`${input.property.name} — Hilton SEO/GEO Copy\n`);
  headingRanges.push({ ...titleRange, level: "HEADING_1" });
  pushText(
    `Brand: ${input.property.brand || "Hilton"} | Market: ${input.property.city}, ${input.property.state}${
      input.property.url ? ` | ${input.property.url}` : ""
    }\n\n`,
  );

  for (const sec of input.sections) {
    const hRange = pushText(`${sec.label}${sec.keyword ? ` (Target: ${sec.keyword})` : ""}\n`);
    headingRanges.push({ ...hRange, level: "HEADING_2" });

    const segments = parseDiffSegments(sec.content || "");
    for (const seg of segments) {
      if (!seg.text) continue;
      const r = pushText(seg.text);
      if (seg.kind === "added") {
        styleSpans.push({ ...r, bold: true });
      } else if (seg.kind === "removed") {
        styleSpans.push({ ...r, strikethrough: true });
      }
    }
    pushText("\n\n");
  }

  const requests: docs_v1.Schema$Request[] = [{ insertText: { text: fullText, location: { index: cursor } } }];
  for (const h of headingRanges) {
    requests.push({
      updateParagraphStyle: {
        range: { startIndex: h.start, endIndex: h.end },
        paragraphStyle: { namedStyleType: h.level },
        fields: "namedStyleType",
      },
    });
  }
  for (const sp of styleSpans) {
    requests.push({
      updateTextStyle: {
        range: { startIndex: sp.start, endIndex: sp.end },
        textStyle: { bold: Boolean(sp.bold), strikethrough: Boolean(sp.strikethrough) },
        fields: sp.bold ? "bold" : "strikethrough",
      },
    });
  }

  await docs.documents.batchUpdate({ documentId: docId, requestBody: { requests } });

  return {
    docId,
    docUrl: `https://docs.google.com/document/d/${docId}/edit`,
    usedTemplateCopy,
    strippedInstructionsCount,
  };
}

