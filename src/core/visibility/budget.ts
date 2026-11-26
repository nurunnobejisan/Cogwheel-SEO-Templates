/**
 * Per-day cost guard for visibility provider calls (BYOK).
 *
 * Calls are only made when both the daily call cap and the estimated daily
 * cost cap allow it. When a cap is reached the adapter returns `unavailable`
 * with the cap reason; it never silently downgrades to a fake answer.
 */

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

interface Usage {
  date: string;
  calls: number;
  estimatedCostUsd: number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function usageFile(): string {
  return path.join(process.env.COGWHEEL_DATA_DIR || path.join(os.tmpdir(), "seo-studio-visibility"), "usage.json");
}

const DEFAULT_CALL_CAP = 60;
const DEFAULT_COST_CAP_USD = 3;

async function readUsage(): Promise<Usage> {
  try {
    const parsed = JSON.parse(await fs.readFile(usageFile(), "utf8")) as Usage;
    if (parsed.date !== today()) return { date: today(), calls: 0, estimatedCostUsd: 0 };
    return parsed;
  } catch {
    return { date: today(), calls: 0, estimatedCostUsd: 0 };
  }
}

async function writeUsage(usage: Usage): Promise<void> {
  await fs.mkdir(path.dirname(usageFile()), { recursive: true });
  await fs.writeFile(usageFile(), JSON.stringify(usage, null, 2), "utf8");
}

export async function canUseVisibilityProvider(estimatedCostUsd: number): Promise<{ allowed: boolean; reason?: string }> {
  const callsCap = Number(process.env.VISIBILITY_DAILY_CALL_CAP ?? DEFAULT_CALL_CAP);
  const costCap = Number(process.env.VISIBILITY_DAILY_COST_CAP_USD ?? DEFAULT_COST_CAP_USD);
  const usage = await readUsage();
  if (usage.calls >= callsCap) {
    return { allowed: false, reason: `daily visibility call cap reached (${usage.calls}/${callsCap})` };
  }
  if (usage.estimatedCostUsd + estimatedCostUsd > costCap) {
    return {
      allowed: false,
      reason: `daily visibility cost cap reached ($${usage.estimatedCostUsd.toFixed(2)}/$${costCap})`,
    };
  }
  return { allowed: true };
}

export async function recordVisibilityUsage(estimatedCostUsd: number): Promise<void> {
  const usage = await readUsage();
  usage.calls += 1;
  usage.estimatedCostUsd = Number((usage.estimatedCostUsd + estimatedCostUsd).toFixed(4));
  await writeUsage(usage);
}
