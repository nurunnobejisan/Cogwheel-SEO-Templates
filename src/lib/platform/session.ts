/**
 * Signed session tokens for the operator console.
 *
 * The console authenticates a user out-of-band (SSO, a login route, or a
 * platform-provided session cookie) and mints a compact signed token:
 *
 *     base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload))
 *
 * The payload is `{ sub, role, org?, exp }`. Verification uses Web Crypto, so
 * the same code runs in Node route handlers and Edge middleware.
 *
 * Required env:
 *   PLATFORM_SESSION_SECRET — >= 32 random bytes, e.g. `openssl rand -hex 32`
 *
 * Local development without a secret: set `PLATFORM_DEV_AUTH=1` to fall back to
 * the unsigned `cw_actor_*` cookies used by the console's role switcher. That
 * fallback is refused when `NODE_ENV=production`.
 */

import type { Principal, Role } from "../../../platform/index.ts";

export const SESSION_COOKIE = "cw_session";
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

const ROLES: readonly Role[] = ["viewer", "specialist", "admin"];

export function isRole(value: string | undefined | null): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

interface SessionPayload {
  /** Subject — the authenticated user id. */
  sub: string;
  role: Role;
  org?: string;
  /** Expiry, epoch seconds. */
  exp: number;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export function sessionSecret(): string | null {
  const secret = process.env.PLATFORM_SESSION_SECRET?.trim();
  if (!secret) {
    return null;
  }
  if (secret.length < 32) {
    throw new Error("PLATFORM_SESSION_SECRET must be at least 32 characters.");
  }
  return secret;
}

/** True when the insecure local-only actor cookies may be honoured. */
export function devAuthEnabled(): boolean {
  return process.env.PLATFORM_DEV_AUTH === "1" && process.env.NODE_ENV !== "production";
}

/** Mints a signed session token. Throws when no secret is configured. */
export async function createSessionToken(
  principal: Principal,
  ttlSeconds = SESSION_TTL_SECONDS,
): Promise<string> {
  const secret = sessionSecret();
  if (!secret) {
    throw new Error(
      "PLATFORM_SESSION_SECRET is not set — cannot issue session tokens. " +
        "Set it to a random value of at least 32 characters.",
    );
  }

  const payload: SessionPayload = {
    sub: principal.id,
    role: principal.role,
    ...(principal.organizationId ? { org: principal.organizationId } : {}),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };

  const encoded = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(encoded));
  return `${encoded}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/** Verifies a token and returns the principal, or null when invalid/expired. */
export async function verifySessionToken(token: string | null | undefined): Promise<Principal | null> {
  if (!token) {
    return null;
  }

  const secret = sessionSecret();
  if (!secret) {
    return null;
  }

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    return null;
  }

  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      base64UrlDecode(signature),
      new TextEncoder().encode(encoded),
    );
  } catch {
    return null;
  }
  if (!valid) {
    return null;
  }

  let payload: SessionPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encoded))) as SessionPayload;
  } catch {
    return null;
  }

  if (!payload || typeof payload.sub !== "string" || !payload.sub.trim()) {
    return null;
  }
  if (!isRole(payload.role)) {
    return null;
  }
  if (typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) {
    return null;
  }

  return {
    id: payload.sub,
    role: payload.role,
    ...(typeof payload.org === "string" && payload.org ? { organizationId: payload.org } : {}),
  };
}

/** Reads a cookie value from a raw `Cookie:` header. */
export function readCookie(header: string | null, name: string): string | null {
  if (!header) {
    return null;
  }
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

/** Serializes a Set-Cookie value for the session. */
export function sessionCookie(token: string, maxAgeSeconds = SESSION_TTL_SECONDS): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

export function clearSessionCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}