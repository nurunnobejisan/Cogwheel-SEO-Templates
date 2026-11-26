import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { seoStudioDataFile } from "@/lib/platform/data-dir";

interface Usage {
  date: string;
  calls: number;
  estimatedCostUsd: number;
}

function usageFile(): string {
  return seoStudioDataFile("brain-usage.json");
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function readUsage(): Promise<Usage> {
  try {
    const raw = await fs.readFile(usageFile(), "utf8");
    const parsed = JSON.parse(raw) as Usage;
    if (parsed.date !== today()) {
      return { date: today(), calls: 0, estimatedCostUsd: 0 };
    }
    return parsed;
  } catch {
    return { date: today(), calls: 0, estimatedCostUsd: 0 };
  }
}

async function writeUsage(usage: Usage): Promise<void> {
  try {
    const file = usageFile();
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(usage, null, 2), "utf8");
  } catch (err) {
    // Best-effort: a read-only filesystem must not break the brain.
    console.warn("[brain:usage] usage write skipped:", err instanceof Error ? err.message : String(err));
  }
}

const DEFAULT_CALL_CAP = 100;
const DEFAULT_COST_CAP = 5.0;
const ESTIMATED_COST_PER_CALL = 0.003;

export async function canUseLlm(): Promise<{ allowed: boolean; reason?: string }> {
  const callsCap = Number(process.env.BRAIN_DAILY_CALL_CAP ?? DEFAULT_CALL_CAP);
  const costCap = Number(process.env.BRAIN_DAILY_COST_CAP_USD ?? DEFAULT_COST_CAP);
  const usage = await readUsage();
  if (usage.calls >= callsCap) {
    return { allowed: false, reason: `daily call cap reached (${usage.calls}/${callsCap})` };
  }
  if (usage.estimatedCostUsd >= costCap) {
    return { allowed: false, reason: `daily cost cap reached ($${usage.estimatedCostUsd.toFixed(2)}/$${costCap})` };
  }
  return { allowed: true };
}

export async function recordLlmUsage(): Promise<void> {
  const usage = await readUsage();
  usage.calls += 1;
  usage.estimatedCostUsd = Number((usage.estimatedCostUsd + ESTIMATED_COST_PER_CALL).toFixed(4));
  await writeUsage(usage);
}
