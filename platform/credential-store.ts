/**
 * Credential Store (Phase 5)
 *
 * Persists `CmsCredential` records (vault-sealed) outside the vault key
 * material. In-memory by default; inject an initial set + hooks for durable
 * persistence.
 */

import type { CmsCredential } from "../cms/types.ts";

export interface CredentialStoreHooks {
  onPut?: (credential: CmsCredential) => void;
  onDelete?: (id: string) => void;
}

export interface CredentialStore {
  put(credential: CmsCredential): CmsCredential;
  get(id: string): CmsCredential | null;
  list(): CmsCredential[];
  delete(id: string): boolean;
  size(): number;
}

export function createCredentialStore(
  initial: CmsCredential[] = [],
  hooks: CredentialStoreHooks = {}
): CredentialStore {
  const credentials = new Map<string, CmsCredential>();
  for (const credential of initial) {
    credentials.set(credential.id, credential);
  }

  return {
    put(credential) {
      credentials.set(credential.id, credential);
      hooks.onPut?.({ ...credential });
      return credential;
    },
    get(id) {
      return credentials.get(id) ?? null;
    },
    list() {
      return [...credentials.values()];
    },
    delete(id) {
      const removed = credentials.delete(id);
      if (removed) {
        hooks.onDelete?.(id);
      }
      return removed;
    },
    size() {
      return credentials.size;
    },
  };
}