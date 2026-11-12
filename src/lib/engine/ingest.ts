import { COMPETITOR_CHAIN_BRANDS } from "@/config/geo";
import { resolveRules, type RulesOverride } from "@/config/rules";
import type { DroppedRow, FileStat, IngestResult, KeywordFlag, KeywordRecord, Property } from "@/lib/types";
import { knownBucketFor } from "./bucket";
import { buildGeoFilter } from "./geo";
import { containsPhrase, keywordId, normalizeKeyword, parseKd, parseNumberOrNull, parseVolume } from "./normalize";
import type { ParsedFile } from "./parse";
import { compareByVolume } from "./sort";

interface RowObs {
  volume: number;
  kd: number | null;
  cpc: number | null;
  intent: string | null;
  group: string;
  file: string;
  order: number;
}

/**
 * Pure ingest pipeline: merge parsed files → normalize → dedupe → clean KD → geo filter → volume floor.
 * Deterministic for a given input (file order matters only for exact ties).
 */
export function ingestParsedFiles(
  files: ParsedFile[],
  property: Property,
  rulesOverride?: RulesOverride,
  fileErrors: FileStat[] = [],
): IngestResult {
  const rules = resolveRules(rulesOverride);
  const dropped: DroppedRow[] = [];
  const obs = new Map<string, RowObs[]>();
  let rawRows = 0;
  let order = 0;

  const fileStats: FileStat[] = files.map((f) => ({
    fileName: f.fileName,
    rows: f.rows.length,
    sourceGroup: f.sourceGroup,
    usedGroupColumn: f.usedGroupColumn,
  }));

  for (const f of files) {
    for (const row of f.rows) {
      rawRows++;
      const norm = normalizeKeyword(row.keyword);
      const volume = parseVolume(row.volume);
      const kd = parseKd(row.kd);
      if (!norm) {
        dropped.push({ keyword: row.keyword, volume, kd, sourceFile: f.fileName, reason: "empty" });
        continue;
      }
      const list = obs.get(norm) ?? [];
      list.push({
        volume,
        kd,
        cpc: parseNumberOrNull(row.cpc),
        intent: row.intent == null || String(row.intent).trim() === "" ? null : String(row.intent).trim(),
        group: (row.group ?? f.sourceGroup).trim(),
        file: f.fileName,
        order: order++,
      });
      obs.set(norm, list);
    }
  }

  const geo = buildGeoFilter(property);
  const kept: KeywordRecord[] = [];
  let duplicatesMerged = 0;
  let kdCleaned = 0;

  for (const [norm, list] of obs) {
    duplicatesMerged += list.length - 1;
    // Highest volume first; earliest observation wins ties.
    const sorted = [...list].sort((a, b) => b.volume - a.volume || a.order - b.order);
    const best = sorted[0];
    const kd = sorted.find((o) => o.kd !== null)?.kd ?? null;
    const flags: KeywordFlag[] = [];
    if (kd === null) {
      flags.push("kd-na");
      kdCleaned++;
    }
    const sourceFiles = [...new Set(sorted.map((o) => o.file))].sort();

    const verdict = geo(norm);
    if (!verdict.ok) {
      dropped.push({
        keyword: norm,
        volume: best.volume,
        kd,
        sourceFile: sourceFiles.join(", "),
        reason: "geo",
        detail: `${verdict.kind}: ${verdict.term}`,
      });
      continue;
    }

    // Physical street addresses (e.g. "10 hightower pl florence al 35630")
    if (/^\d{1,5}\s+[a-z0-9\s]+\b(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|pl|place|ln|lane|way|ct|court|pkwy|hwy)\b/i.test(norm) || /\b\d{5}(?:-\d{4})?\b/.test(norm)) {
      dropped.push({
        keyword: norm,
        volume: best.volume,
        kd,
        sourceFile: sourceFiles.join(", "),
        reason: "geo",
        detail: "physical address",
      });
      continue;
    }

    // Competitor chain brands (trained on Razib Marketing / Cogwheel SEO exclusion list)
    const compBrand = COMPETITOR_CHAIN_BRANDS.find((b) => containsPhrase(norm, b));
    if (compBrand) {
      dropped.push({
        keyword: norm,
        volume: best.volume,
        kd,
        sourceFile: sourceFiles.join(", "),
        reason: "geo",
        detail: `competitor brand: ${compBrand}`,
      });
      continue;
    }

    if (best.volume < rules.minVolume) {
      const bucket = knownBucketFor(norm, best.group);
      const isLocalDemand = bucket !== null && rules.localDemandBuckets.includes(bucket);
      if (kd !== null && kd < rules.lowVolumeExceptionMaxKd && isLocalDemand) {
        flags.push("low-sv-exception");
      } else {
        dropped.push({
          keyword: norm,
          volume: best.volume,
          kd,
          sourceFile: sourceFiles.join(", "),
          reason: "low-volume",
          detail: `SV ${best.volume} < ${rules.minVolume}`,
        });
        continue;
      }
    }

    kept.push({
      id: keywordId(norm),
      keyword: norm,
      volume: best.volume,
      kd,
      cpc: sorted.find((o) => o.cpc !== null)?.cpc ?? null,
      intent: sorted.find((o) => o.intent !== null)?.intent ?? null,
      sourceGroup: best.group,
      sourceFiles,
      flags,
    });
  }

  kept.sort(compareByVolume);
  dropped.sort((a, b) => a.reason.localeCompare(b.reason) || b.volume - a.volume || a.keyword.localeCompare(b.keyword));

  const dropCounts = { empty: 0, "low-volume": 0, geo: 0 };
  dropped.forEach((d) => dropCounts[d.reason]++);

  return {
    keywords: kept,
    dropped,
    files: [...fileStats, ...fileErrors],
    stats: {
      files: files.length,
      rawRows,
      uniqueKeywords: obs.size,
      duplicatesMerged,
      kdCleaned,
      dropped: dropCounts,
      kept: kept.length,
    },
  };
}

