import { promises as fs } from "node:fs";
import path from "node:path";
import { runBrain } from "../src/core/brain";

async function main() {
  const goldPath = process.argv[2] || path.join(process.cwd(), "data", "brain-gold.example.json");
  const gold = JSON.parse(await fs.readFile(goldPath, "utf8")) as Array<{
    url: string;
    expectedActionTitles?: string[];
    forbiddenTokens?: string[];
  }>;

  let total = 0;
  let fabricated = 0;
  for (const entry of gold) {
    total += 1;
    const result = await runBrain({ targetUrl: entry.url, maxPages: 5 });
    const text = result.interpretation.toLowerCase();
    const hits = (entry.forbiddenTokens ?? []).filter((t) => text.includes(t.toLowerCase()));
    if (hits.length) fabricated += 1;
    console.log(`\n=== ${entry.url} ===`);
    console.log(`provider: ${result.provider}`);
    console.log(`actions: ${result.audit.actionPlan.length}`);
    console.log(`forbidden hits: ${hits.join(", ") || "none"}`);
    console.log(result.interpretation.slice(0, 500));
  }

  console.log(`\nEvaluated ${total} pages. Fabrication-flagged: ${fabricated}. Fabrication rate must be 0.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
