/**
 * Brain evaluation.
 *
 * Reports three numbers:
 *   - fabrication rate: pages with an untraced claim or a forbidden token (must be 0)
 *   - finding accuracy: hand-labelled expected actions found in the audit output
 *   - fix quality: heuristic completeness of the action plan (labelled estimated)
 *
 * Gold labels are human-supplied. The script never generates labels.
 *
 * Usage:
 *   npm run brain:eval -- [gold.json] [--limit N] [--report path.json]
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { runBrain } from "../src/core/brain";

interface GoldEntry {
  url: string;
  expectedActionTitles?: string[];
  forbiddenTokens?: string[];
  verifiedBy?: string;
}

interface PageResult {
  url: string;
  provider: string;
  fabrication: boolean;
  fabricationReasons: string[];
  expectedActions: number;
  matchedActions: number;
  fixQuality: number;
  actions: number;
  error?: string;
}

function argValue(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function normalized(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").replace(/[^\w\s]/g, "").trim();
}

function fixQualityScore(actions: Array<{ title?: string; description?: string; remediationGuide?: string }>): number {
  if (actions.length === 0) return 0;
  const scores = actions.map((action) => {
    const checks = [
      Boolean(action.remediationGuide && action.remediationGuide.trim().length >= 10),
      Boolean(action.description && action.description.trim().length >= 10),
      Boolean(action.title && action.title.trim().length >= 8 && action.title.trim().length <= 140),
    ];
    return (checks.filter(Boolean).length / checks.length) * 100;
  });
  return Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1));
}

async function main(): Promise<void> {
  const reportIndex = process.argv.indexOf("--report");
  const reportPath = reportIndex !== -1 ? process.argv[reportIndex + 1] : undefined;
  const positional = process.argv.slice(2).filter((arg, index, all) => {
    if (arg === "--report" || arg === "--limit") return false;
    const previous = all[index - 1];
    return previous !== "--report" && previous !== "--limit";
  });
  const goldPath = positional[0] || path.join(process.cwd(), "data", "brain-gold.json");
  const limit = Number(argValue("--limit")) || Infinity;
  const gold = JSON.parse(await fs.readFile(goldPath, "utf8")) as GoldEntry[];
  const entries = Number.isFinite(limit) ? gold.slice(0, limit) : gold;

  const pageResults: PageResult[] = [];
  let fabricationPages = 0;
  let expectedTotal = 0;
  let matchedTotal = 0;
  let labelledPages = 0;
  let errors = 0;

  for (const entry of entries) {
    try {
      const result = await runBrain({ targetUrl: entry.url, maxPages: 5 });
      const text = result.interpretation.toLowerCase();
      const forbiddenHits = (entry.forbiddenTokens ?? []).filter((token) => text.includes(token.toLowerCase()));
      const untraced = result.provenanceCheck?.untracedNumbers ?? [];
      const unmapped = result.provenanceCheck?.unmappedClaims ?? [];
      const fabricationReasons = [
        ...forbiddenHits.map((token) => `forbidden token: ${token}`),
        ...untraced.map((number) => `untraced number: ${number}`),
        ...(unmapped.length > 0 ? [`unmapped claims: ${unmapped.length}`] : []),
      ];
      const fabrication = fabricationReasons.length > 0;
      if (fabrication) fabricationPages += 1;

      const actionTitles = result.audit.actionPlan.map((action) => normalized(action.title));
      const expected = entry.expectedActionTitles ?? [];
      let matched = 0;
      if (expected.length > 0) {
        labelledPages += 1;
        expectedTotal += expected.length;
        for (const wanted of expected) {
          const needle = normalized(wanted);
          if (actionTitles.some((title) => title.includes(needle) || needle.includes(title))) matched += 1;
        }
        matchedTotal += matched;
      }

      const fixQuality = fixQualityScore(result.audit.actionPlan);
      pageResults.push({
        url: entry.url,
        provider: result.provider,
        fabrication,
        fabricationReasons,
        expectedActions: expected.length,
        matchedActions: matched,
        fixQuality,
        actions: result.audit.actionPlan.length,
      });

      console.log(`\n=== ${entry.url} ===`);
      console.log(`provider: ${result.provider}`);
      console.log(`actions: ${result.audit.actionPlan.length}`);
      console.log(`fix quality: ${fixQuality}/100 (estimated heuristic)`);
      console.log(`expected actions matched: ${expected.length ? `${matched}/${expected.length}` : "unlabelled"}`);
      console.log(`fabrication reasons: ${fabricationReasons.join("; ") || "none"}`);
      console.log(result.interpretation.slice(0, 400));
    } catch (err) {
      errors += 1;
      pageResults.push({
        url: entry.url,
        provider: "error",
        fabrication: false,
        fabricationReasons: [],
        expectedActions: 0,
        matchedActions: 0,
        fixQuality: 0,
        actions: 0,
        error: err instanceof Error ? err.message : String(err),
      });
      console.error(`\n=== ${entry.url} ===\nERROR: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const fabricationRate = entries.length ? fabricationPages / entries.length : 0;
  const findingAccuracy = expectedTotal > 0 ? matchedTotal / expectedTotal : null;
  const fixQuality = pageResults.length
    ? Number((pageResults.reduce((sum, page) => sum + page.fixQuality, 0) / pageResults.length).toFixed(1))
    : 0;

  console.log("\n=== Summary ===");
  console.log(`Pages evaluated: ${entries.length}`);
  console.log(`Fabrication-flagged pages: ${fabricationPages}`);
  console.log(`Fabrication rate: ${fabricationRate.toFixed(4)}`);
  console.log(`Labelled pages: ${labelledPages}`);
  console.log(
    `Finding accuracy: ${findingAccuracy === null ? "unlabelled" : `${(findingAccuracy * 100).toFixed(1)}% (${matchedTotal}/${expectedTotal})`}`
  );
  console.log(`Fix quality: ${fixQuality}/100 (estimated heuristic)`);
  console.log(`Errors: ${errors}`);
  console.log(`FABRICATION_RATE=${fabricationRate.toFixed(4)}`);
  console.log(`FINDING_ACCURACY=${findingAccuracy === null ? "null" : findingAccuracy.toFixed(4)}`);
  console.log(`FIX_QUALITY=${fixQuality.toFixed(1)}`);

  if (reportPath) {
    await fs.writeFile(
      reportPath,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          goldPath,
          pages: pageResults,
          fabricationRate,
          findingAccuracy,
          fixQuality,
          errors,
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    console.log(`Report: ${reportPath}`);
  }

  if (fabricationRate > 0) {
    console.error("BLOCKING: fabrication rate must be 0.");
    process.exit(1);
  }
  if (errors > 0) {
    console.error(`BLOCKING: ${errors} page(s) could not be evaluated.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
