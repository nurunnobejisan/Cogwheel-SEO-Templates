/**
 * Credential Store (Phase 5)
 *
 * Persists `CmsCredential` records (vault-sealed) outside the vault key
 * material. In-memory by default; production swaps in PostgreSQL/Redis without
 * touching the gateway.
 */

import type { CmsCredential } from "../cms/types.ts";

export interface CredentialStore {
  put(credential: CmsCredential): CmsCredential;
  get(id: string): CmsCredential | null;
  list(): CmsCredential[];
  delete(id: string): boolean;
  size(): number;
}

export function createCredentialStore(): CredentialStore {
  const credentials = new Map<string, CmsCredential>();
  return {
    put(credential) {
      credentials.set(credential.id, credential);
      return credential;
    },
    get(id) {
      return credentials.get(id) ?? null;
    },
    list() {
      return [...credentials.values()];
    },
    delete(id) {
      return credentials.delete(id);
    },
    size() {
      return credentials.size;
    },
  };
}