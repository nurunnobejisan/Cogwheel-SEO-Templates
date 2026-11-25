/**
 * Credential Management (Phase 3)
 *
 * Builds and opens `CmsCredential` records on top of the encrypted vault. The
 * secret payload (application password / OAuth token / API key) is sealed here
 * and never stored in plaintext.
 */

import type { CmsCredential, CmsPlatform, CmsSecretPayload } from "./types.ts";
import { redactSecret, type CredentialVault } from "./vault.ts";

export interface CreateCredentialInput {
  vault: CredentialVault;
  platform: CmsPlatform;
  label: string;
  /** Non-secret routing metadata (site URL, shop domain, username, scopes). */
  meta: Record<string, string>;
  /** Plaintext secret; sealed immediately. */
  secret: CmsSecretPayload;
  id?: string;
  now?: string;
}

function randomId(): string {
  return `cred_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function createCmsCredential(input: CreateCredentialInput): CmsCredential {
  const now = input.now ?? new Date().toISOString();
  return {
    id: input.id ?? randomId(),
    platform: input.platform,
    label: input.label,
    meta: { ...input.meta },
    secret: input.vault.seal(input.secret as Record<string, unknown>),
    createdAt: now,
    updatedAt: now,
  };
}

/** Decrypt a credential's secret payload. */
export function openCmsCredential(
  vault: CredentialVault,
  credential: CmsCredential
): CmsSecretPayload {
  return vault.open(credential.secret) as CmsSecretPayload;
}

/** A safe, log-friendly view of a credential (no secret plaintext). */
export function redactCmsCredential(
  vault: CredentialVault,
  credential: CmsCredential
): CmsCredential & { secretPreview: Record<string, string> } {
  const secret = openCmsCredential(vault, credential);
  const secretPreview: Record<string, string> = {};
  for (const [key, value] of Object.entries(secret)) {
    if (typeof value === "string" && /password|token|secret|key/i.test(key)) {
      secretPreview[key] = redactSecret(value);
    }
  }
  return { ...credential, secretPreview, secret: vault.fingerprint(credential.secret) };
}
