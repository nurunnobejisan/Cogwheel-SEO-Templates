/**
 * SEO Studio — best-effort at-rest encryption for secrets.
 *
 * Single source for both the Next.js app and the Chrome extension (the
 * extension keeps a re-export wrapper at
 * `chrome-extension/src/utils/secureStorage.ts`).
 *
 * Uses Web Crypto (AES-GCM) with a key derived from the extension runtime id
 * when one is available (a fixed dev salt elsewhere). Values are stored with
 * an `enc:v1:` prefix so legacy plaintext values can be read back and migrated
 * transparently. This is not a substitute for a user passphrase, but it
 * prevents secrets from being stored or synced in clear text.
 */

const PREFIX = "enc:v1:";
const SALT = "cogwheel-extension-secret-salt-v1";

function getRuntimeSecret(): string {
  try {
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id) {
      return chrome.runtime.id;
    }
  } catch {
    // ignore
  }
  return "cogwheel-local-dev-secret";
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(): Promise<CryptoKey | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  try {
    const material = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(getRuntimeSecret()),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    return await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: new TextEncoder().encode(SALT), iterations: 100000, hash: "SHA-256" },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  } catch {
    return null;
  }
}

export async function encryptSecret(plaintext: string): Promise<string> {
  if (!plaintext) return "";
  const key = await deriveKey();
  if (!key) return plaintext;
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(plaintext)
    );
    return `${PREFIX}${toBase64(iv)}.${toBase64(new Uint8Array(cipher))}`;
  } catch {
    return plaintext;
  }
}

export async function decryptSecret(ciphertext: string): Promise<string> {
  if (!ciphertext || !ciphertext.startsWith(PREFIX)) return ciphertext;
  const key = await deriveKey();
  if (!key) return ciphertext;
  try {
    const payload = ciphertext.slice(PREFIX.length);
    const [ivB64, dataB64] = payload.split(".");
    if (!ivB64 || !dataB64) return ciphertext;
    const iv = fromBase64(ivB64);
    const data = fromBase64(dataB64);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as unknown as BufferSource }, key, data as unknown as BufferSource);
    return new TextDecoder().decode(plain);
  } catch {
    return ciphertext;
  }
}
