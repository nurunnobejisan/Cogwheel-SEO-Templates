/**
 * Local-first GEO snapshot store.
 *
 * Serverless filesystems are ephemeral; production should back this with the
 * optional Supabase table (or any KV). The file store keeps local audits and
 * self-hosted deployments useful without extra infrastructure. It stores the
 * last N snapshots per domain and never throws into the audit path.
 */

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { GeoSnapshot } from "../../../rules/geo/types.ts";

const MAX_HISTORY = 30;

function storeDir(): string {
  return path.join(process.env.COGWHEEL_DATA_DIR || path.join(os.tmpdir(), "cogwheel-geo"), "snapshots");
}

function storeEnabled(): boolean {
  const flag = (process.env.COGWHEEL_GEO_STORE || "").toLowerCase();
  return flag !== "off" && flag !== "false" && flag !== "0";
}

function fileFor(domain: string): string {
  const safe = domain.replace(/[^a-z0-9.-]+/gi, "-").replace(/^-+|-+$/g, "") || "site";
  return path.join(storeDir(), `${safe}.json`);
}

export async function listGeoSnapshots(domain: string): Promise<GeoSnapshot[]> {
  if (!storeEnabled()) return [];
  try {
    const raw = await fs.readFile(fileFor(domain), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as GeoSnapshot[]) : [];
  } catch {
    return [];
  }
}

export async function loadLatestGeoSnapshot(domain: string): Promise<GeoSnapshot | null> {
  const all = await listGeoSnapshots(domain);
  return all.length > 0 ? all[all.length - 1]! : null;
}

export async function saveGeoSnapshot(snapshot: GeoSnapshot): Promise<void> {
  if (!storeEnabled()) return;
  try {
    const all = await listGeoSnapshots(snapshot.domain);
    // Replace a snapshot captured in the same run (same timestamp).
    const deduped = all.filter((entry) => entry.capturedAt !== snapshot.capturedAt);
    deduped.push(snapshot);
    const trimmed = deduped.slice(-MAX_HISTORY);
    await fs.mkdir(storeDir(), { recursive: true });
    await fs.writeFile(fileFor(snapshot.domain), JSON.stringify(trimmed, null, 2), "utf8");
  } catch {
    // Storage is best-effort; an audit must never fail because drift history
    // could not be written.
  }
}
