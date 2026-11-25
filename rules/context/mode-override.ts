/**
 * Manual Mode Override Store
 *
 * Persists an operator's per-domain mode lock ("universal" | "hotel") so a
 * site can be pinned to a mode regardless of automatic detection. Storage is
 * adapter-based: the extension injects localStorage/chrome.storage, tests and
 * the Node backend use the in-memory store.
 */

import type { AuditMode, ModeOverrideStoreLike } from "../types.ts";

export interface ModeOverrideStore extends ModeOverrideStoreLike {
  /** Remove an override, restoring automatic detection for the domain. */
  clear(domain: string): void;
  /** Snapshot of every stored override. */
  entries(): Record<string, AuditMode>;
}

export const MODE_OVERRIDE_STORAGE_KEY = "cogwheel:audit-mode-overrides";

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^www\./, "");
}

/** Volatile store — ideal for SSR, tests and the Node audit pipeline. */
export function createMemoryOverrideStore(
  initial: Record<string, AuditMode> = {}
): ModeOverrideStore {
  const map = new Map<string, AuditMode>();
  for (const [domain, mode] of Object.entries(initial)) {
    map.set(normalizeDomain(domain), mode);
  }

  return {
    get(domain) {
      return map.get(normalizeDomain(domain)) ?? null;
    },
    set(domain, mode) {
      const key = normalizeDomain(domain);
      if (mode === null) {
        map.delete(key);
      } else {
        map.set(key, mode);
      }
    },
    clear(domain) {
      map.delete(normalizeDomain(domain));
    },
    entries() {
      return Object.fromEntries(map.entries());
    },
  };
}

/**
 * Persistent store backed by a Web Storage-like API (localStorage in the
 * extension side-panel/options page). Returns null when no storage is
 * available so callers can fall back to the memory store.
 */
export function createLocalStorageOverrideStore(
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  key: string = MODE_OVERRIDE_STORAGE_KEY
): ModeOverrideStore | null {
  const store =
    storage ??
    (typeof localStorage !== "undefined" ? localStorage : undefined);
  if (!store) {
    return null;
  }

  function read(): Record<string, AuditMode> {
    try {
      const raw = store!.getItem(key);
      if (!raw) {
        return {};
      }
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return {};
      }
      const safe: Record<string, AuditMode> = {};
      for (const [domain, mode] of Object.entries(parsed as Record<string, unknown>)) {
        if (mode === "universal" || mode === "hotel") {
          safe[domain] = mode;
        }
      }
      return safe;
    } catch {
      return {};
    }
  }

  function write(map: Record<string, AuditMode>): void {
    try {
      store!.setItem(key, JSON.stringify(map));
    } catch {
      /* storage full or disabled — overrides stay in-memory for this session */
    }
  }

  return {
    get(domain) {
      return read()[normalizeDomain(domain)] ?? null;
    },
    set(domain, mode) {
      const map = read();
      const keyName = normalizeDomain(domain);
      if (mode === null) {
        delete map[keyName];
      } else {
        map[keyName] = mode;
      }
      write(map);
    },
    clear(domain) {
      const map = read();
      delete map[normalizeDomain(domain)];
      write(map);
    },
    entries() {
      return read();
    },
  };
}
