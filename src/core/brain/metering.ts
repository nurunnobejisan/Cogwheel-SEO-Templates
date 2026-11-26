import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { seoStudioDataFile } from "@/lib/platform/data-dir";

interface ClientUsage {
  calls: number;
  estimatedCostUsd: number;
  lastUsedAt: string;
}

type Meter = Record<string, ClientUsage>;

function meterFile(): string {
  return seoStudioDataFile("usage-meter.json");
}

async function readMeter(): Promise<Meter> {
  try {
    return JSON.parse(await fs.readFile(meterFile(), "utf8")) as Meter;
  } catch {
    return {};
  }
}

export async function recordClientUsage(clientId: string): Promise<void> {
  if (!clientId) return;
  try {
    const meter = await readMeter();
    const prev = meter[clientId] ?? { calls: 0, estimatedCostUsd: 0, lastUsedAt: new Date().toISOString() };
    prev.calls += 1;
    prev.estimatedCostUsd = Number((prev.estimatedCostUsd + 0.003).toFixed(4));
    prev.lastUsedAt = new Date().toISOString();
    meter[clientId] = prev;
    const file = meterFile();
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(meter, null, 2), "utf8");
  } catch (err) {
    // Metering is best-effort and must never fail the measured request.
    console.warn("[brain:metering] usage write skipped:", err instanceof Error ? err.message : String(err));
  }
}

export async function getClientUsage(clientId: string): Promise<ClientUsage | null> {
  const meter = await readMeter();
  return meter[clientId] ?? null;
}

export async function getAllUsage(): Promise<Meter> {
  return readMeter();
}
