/**
 * Encrypted Credential Vault (Phase 3)
 *
 * AES-256-GCM authenticated encryption for API keys, OAuth tokens and
 * application passwords, matching the roadmap's "encrypted credential vault"
 * requirement.
 *
 * The data key is supplied by a `KeyProvider` so production can plug in AWS KMS
 * or GCP Secret Manager; a raw key / env var is used in dev and tests.
 */

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const FORMAT_PREFIX = "v1";

export interface KeyProvider {
  /** Return the 32-byte AES data key. */
  getKey(): Buffer;
}

export type VaultKey = Buffer | string | KeyProvider;

export interface CredentialVault {
  /** Encrypt a plaintext string → `v1:iv:tag:ciphertext` (all base64). */
  encrypt(plaintext: string): string;
  /** Decrypt a sealed string; throws on tampering or a wrong key. */
  decrypt(sealed: string): string;
  /** Encrypt a JSON secret object. */
  seal(secret: Record<string, unknown>): string;
  /** Decrypt a sealed JSON secret object. */
  open(sealed: string): Record<string, unknown>;
  /** Keyed, non-reversible fingerprint for audit logs (never the secret). */
  fingerprint(sealed: string): string;
}

function isKeyProvider(key: VaultKey): key is KeyProvider {
  return typeof key === "object" && key !== null && typeof (key as KeyProvider).getKey === "function";
}

/** Resolve an arbitrary key input to a 32-byte buffer. */
export function resolveVaultKey(key: VaultKey): Buffer {
  if (isKeyProvider(key)) {
    return assertKeyLength(key.getKey());
  }
  if (Buffer.isBuffer(key)) {
    return assertKeyLength(key);
  }
  // String key: prefer an exact base64/hex 32-byte key, otherwise derive one
  // deterministically so a simple passphrase still works in development.
  const base64 = Buffer.from(key, "base64");
  if (base64.length === KEY_BYTES) {
    return base64;
  }
  const hex = /^[0-9a-f]{64}$/i.test(key) ? Buffer.from(key, "hex") : null;
  if (hex) {
    return hex;
  }
  return createHash("sha256").update(key, "utf8").digest();
}

function assertKeyLength(key: Buffer): Buffer {
  if (key.length !== KEY_BYTES) {
    throw new Error(`vault key must be ${KEY_BYTES} bytes, received ${key.length}`);
  }
  return key;
}

/** Load the vault key from the environment (`CMS_VAULT_KEY`). */
export function resolveVaultKeyFromEnv(
  env: NodeJS.ProcessEnv = process.env
): Buffer | null {
  const raw = env.CMS_VAULT_KEY;
  return raw ? resolveVaultKey(raw) : null;
}

export function createCredentialVault(key: VaultKey): CredentialVault {
  const dataKey = resolveVaultKey(key);

  return {
    encrypt(plaintext: string): string {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv(ALGORITHM, dataKey, iv, { authTagLength: TAG_BYTES });
      const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
      const tag = cipher.getAuthTag();
      return [
        FORMAT_PREFIX,
        iv.toString("base64"),
        tag.toString("base64"),
        ciphertext.toString("base64"),
      ].join(":");
    },

    decrypt(sealed: string): string {
      const parts = sealed.split(":");
      if (parts.length !== 4 || parts[0] !== FORMAT_PREFIX) {
        throw new Error("malformed sealed value");
      }
      const iv = Buffer.from(parts[1]!, "base64");
      const tag = Buffer.from(parts[2]!, "base64");
      const ciphertext = Buffer.from(parts[3]!, "base64");
      const decipher = createDecipheriv(ALGORITHM, dataKey, iv, { authTagLength: TAG_BYTES });
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    },

    seal(secret: Record<string, unknown>): string {
      return this.encrypt(JSON.stringify(secret));
    },

    open(sealed: string): Record<string, unknown> {
      const parsed: unknown = JSON.parse(this.decrypt(sealed));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("sealed secret is not a JSON object");
      }
      return parsed as Record<string, unknown>;
    },

    fingerprint(sealed: string): string {
      const hmacKey = createHash("sha256").update(dataKey).digest();
      return createHash("sha256").update(hmacKey).update(sealed).digest("hex").slice(0, 16);
    },
  };
}

/** Redact a secret value for logs, showing only a short prefix. */
export function redactSecret(value: string | undefined | null, visible = 4): string {
  if (!value) {
    return "(unset)";
  }
  if (value.length <= visible) {
    return "*".repeat(value.length);
  }
  return `${value.slice(0, visible)}${"*".repeat(Math.min(12, value.length - visible))}`;
}
