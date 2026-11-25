/**
 * OAuth 2.0 State Handlers + PKCE (Phase 3)
 *
 * Centralized, tamper-proof state management for the platform authorization
 * flows. The state token is an HMAC-signed, expiring payload that also carries
 * the PKCE code_verifier, so callbacks can be validated without server-side
 * session storage. Consumed states are tracked to prevent replay.
 */

import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { CmsPlatform } from "../types.ts";

export interface OAuthStatePayload {
  platform: CmsPlatform | string;
  redirectUri: string;
  /** PKCE code_verifier bound to this authorization request. */
  codeVerifier: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
  extra?: Record<string, string>;
}

export interface IssuedState {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  expiresAt: number;
}

export interface IssueStateInput {
  platform: CmsPlatform | string;
  redirectUri: string;
  ttlMs?: number;
  extra?: Record<string, string>;
}

export interface StateManagerOptions {
  secret: string | Buffer;
  /** Default lifetime of an issued state token. */
  ttlMs?: number;
  /** Injectable clock for deterministic tests. */
  now?: () => number;
}

export interface OAuthStateManager {
  issue(input: IssueStateInput): IssuedState;
  /** Verify + decode a state token. Throws when invalid, expired or replayed. */
  consume(state: string): OAuthStatePayload;
  /** Whether a state token has already been consumed. */
  isConsumed(state: string): boolean;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000;

function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function createCodeVerifier(): string {
  return base64url(randomBytes(32));
}

export function codeChallengeFor(verifier: string): string {
  return base64url(createHash("sha256").update(verifier).digest());
}

export function createPkcePair(): {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
} {
  const codeVerifier = createCodeVerifier();
  return { codeVerifier, codeChallenge: codeChallengeFor(codeVerifier), codeChallengeMethod: "S256" };
}

export function createOAuthStateManager(options: StateManagerOptions): OAuthStateManager {
  const key = typeof options.secret === "string" ? Buffer.from(options.secret, "utf8") : options.secret;
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const now = options.now ?? (() => Date.now());
  const consumed = new Set<string>();

  const sign = (payload: string): string =>
    base64url(createHmac("sha256", key).update(payload).digest());

  return {
    issue(input: IssueStateInput): IssuedState {
      const pkce = createPkcePair();
      const issuedAt = now();
      const expiresAt = issuedAt + (input.ttlMs ?? ttlMs);
      const payload: OAuthStatePayload = {
        platform: input.platform,
        redirectUri: input.redirectUri,
        codeVerifier: pkce.codeVerifier,
        nonce: base64url(randomBytes(12)),
        issuedAt,
        expiresAt,
        extra: input.extra,
      };
      const encoded = base64url(Buffer.from(JSON.stringify(payload), "utf8"));
      const state = `${encoded}.${sign(encoded)}`;
      return {
        state,
        codeVerifier: pkce.codeVerifier,
        codeChallenge: pkce.codeChallenge,
        codeChallengeMethod: "S256",
        expiresAt,
      };
    },

    consume(state: string): OAuthStatePayload {
      const parts = state.split(".");
      if (parts.length !== 2) {
        throw new Error("malformed OAuth state");
      }
      const [encoded, signature] = parts as [string, string];
      const expected = sign(encoded);
      const provided = Buffer.from(signature);
      const expectedBuf = Buffer.from(expected);
      if (provided.length !== expectedBuf.length || !timingSafeEqual(provided, expectedBuf)) {
        throw new Error("OAuth state signature mismatch");
      }
      if (consumed.has(state)) {
        throw new Error("OAuth state already consumed (possible replay)");
      }
      let payload: OAuthStatePayload;
      try {
        payload = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as OAuthStatePayload;
      } catch {
        throw new Error("OAuth state payload is not valid JSON");
      }
      if (typeof payload.expiresAt !== "number" || now() > payload.expiresAt) {
        throw new Error("OAuth state has expired");
      }
      consumed.add(state);
      return payload;
    },

    isConsumed(state: string): boolean {
      return consumed.has(state);
    },
  };
}
