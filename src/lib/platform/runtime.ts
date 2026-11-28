/**
 * Platform Runtime Singleton (Phase 5.1)
 *
 * Server-only bootstrap for the Phase 5 gateway inside the Next.js app. It:
 *
 *   1. resolves a persistence adapter (NDJSON on disk, or in-memory),
 *   2. hydrates the durable stores from it,
 *   3. exposes the gateway to the `/api/platform` route handlers.
 *
 * The instance is memoized on `globalThis` so Next.js hot-reload and multiple
 * route handlers share one gateway (one audit chain, one rate limiter).
 *
 * Configure with:
 *   CMS_VAULT_KEY        — credential vault key (required for real CMS secrets)
 *   PLATFORM_DATA_DIR    — directory for the NDJSON adapter (default .platform-data)
 *   PLATFORM_FETCH_TIMEOUT_MS — optional outbound fetch timeout
 */

import "server-only";
import os from "node:os";
import path from "node:path";
import {
  createDurablePlatform,
  createJsonFileAdapter,
  createMemoryAdapter,
  type DurablePlatform,
  type PersistenceAdapter,
} from "../../../platform/index.ts";
import { createCredentialVault } from "../../../cms/index.ts";

export interface RuntimeHandle {
  platform: DurablePlatform;
  /** "jsonl" when persisting to disk, "memory" otherwise. */
  storage: "jsonl" | "memory";
  dataDir: string | null;
  /** True when no persisted state existed yet on this boot. */
  coldStart: boolean;
}

const GLOBAL_KEY = "__seo-studioPlatformRuntime__";

interface GlobalCache {
  [GLOBAL_KEY]?: Promise<RuntimeHandle>;
}

function cache(): GlobalCache {
  return globalThis as unknown as GlobalCache;
}

/** Choose a persistence adapter from the environment. */
function createAdapter(): { adapter: PersistenceAdapter; storage: RuntimeHandle["storage"]; dataDir: string | null } {
  const configured = process.env.PLATFORM_DATA_DIR;
  // Serverless filesystems are ephemeral/read-only, so fall back to /tmp there.
  const defaultDir = process.env.VERCEL
    ? path.join(os.tmpdir(), "seo-studio-platform")
    : path.join(process.cwd(), ".platform-data");
  const dir = configured ?? defaultDir;

  if (process.env.PLATFORM_STORAGE === "memory") {
    return { adapter: createMemoryAdapter(), storage: "memory", dataDir: null };
  }
  return { adapter: createJsonFileAdapter({ dir }), storage: "jsonl", dataDir: dir };
}

async function bootstrap(): Promise<RuntimeHandle> {
  const { adapter, storage, dataDir } = createAdapter();

  // A missing key still works (dev), but the vault then only protects state on
  // this machine. Production MUST set CMS_VAULT_KEY.
  const vaultKey = process.env.CMS_VAULT_KEY ?? "seo-studio-dev-insecure-vault-key";
  if (!process.env.CMS_VAULT_KEY) {
    console.warn(
      "[platform] CMS_VAULT_KEY is not set — the credential vault is using an " +
        "insecure development fallback key. Set CMS_VAULT_KEY in every deployed " +
        "environment before storing real CMS credentials.",
    );
  }
  const vault = createCredentialVault(vaultKey);

  // Sessions are only verifiable when a signing secret exists. Warn loudly:
  // without it, the platform API answers 401 for every non-health route.
  if (!process.env.PLATFORM_SESSION_SECRET) {
    console.warn(
      "[platform] PLATFORM_SESSION_SECRET is not set — signed sessions cannot be " +
        "issued or verified and all non-health platform API calls will return 401. " +
        "Set it to a random value of at least 32 characters in every deployment.",
    );
  }

  const empty = await adapter.readAll("audit_log");
  const coldStart = empty.length === 0;

  const platform = await createDurablePlatform({
    adapter,
    vault,
    now: () => new Date().toISOString(),
    fetchImpl: globalThis.fetch,
  });

  return { platform, storage, dataDir, coldStart };
}

/** Resolve (and cache) the platform runtime for this server process. */
export function getPlatformRuntime(): Promise<RuntimeHandle> {
  const store = cache();
  if (!store[GLOBAL_KEY]) {
    store[GLOBAL_KEY] = bootstrap();
  }
  return store[GLOBAL_KEY];
}

/** Test/CLI helper: drop the memoized runtime (adapter is not closed). */
export function resetPlatformRuntime(): void {
  delete cache()[GLOBAL_KEY];
}
