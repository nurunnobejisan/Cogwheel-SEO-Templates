import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

const FILE = path.join(process.cwd(), "data", "brain-usage.json");

interface Usage {
  date: string;
  calls: number;
  estimatedCostUsd: number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function readUsage(): Promise<Usage> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
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
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(usage, null, 2), "utf8");
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
