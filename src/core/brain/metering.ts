import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

const FILE = path.join(process.cwd(), "data", "usage-meter.json");

interface ClientUsage {
  calls: number;
  estimatedCostUsd: number;
  lastUsedAt: string;
}

type Meter = Record<string, ClientUsage>;

async function readMeter(): Promise<Meter> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as Meter;
  } catch {
    return {};
  }
}

export async function recordClientUsage(clientId: string): Promise<void> {
  if (!clientId) return;
  const meter = await readMeter();
  const prev = meter[clientId] ?? { calls: 0, estimatedCostUsd: 0, lastUsedAt: new Date().toISOString() };
  prev.calls += 1;
  prev.estimatedCostUsd = Number((prev.estimatedCostUsd + 0.003).toFixed(4));
  prev.lastUsedAt = new Date().toISOString();
  meter[clientId] = prev;
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(meter, null, 2), "utf8");
}

export async function getClientUsage(clientId: string): Promise<ClientUsage | null> {
  const meter = await readMeter();
  return meter[clientId] ?? null;
}

export async function getAllUsage(): Promise<Meter> {
  return readMeter();
}
