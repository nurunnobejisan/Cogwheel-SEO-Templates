/**
 * Shopify OAuth 2.0 Flow (Phase 3)
 *
 * Implements the native Shopify app authorization handshake: the granular
 * scope set from the roadmap, the authorize redirect, HMAC verification of the
 * callback query, and the code → access-token exchange.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { FetchLike } from "../types.ts";

/** Granular scopes required by the SEO auto-fix engine. */
export const SHOPIFY_SCOPES: readonly string[] = [
  "read_products",
  "write_products",
  "read_content",
  "write_content",
  "read_themes",
  "write_themes",
];

export interface ShopifyOAuthConfig {
  clientId: string;
  clientSecret: string;
  /** e.g. "https://api.platform.com/oauth/shopify/callback". */
  redirectUri: string;
}

export function normalizeShopDomain(shop: string): string {
  const trimmed = shop.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return trimmed.includes(".") ? trimmed : `${trimmed}.myshopify.com`;
}

export function buildShopifyAuthorizeUrl(params: {
  shop: string;
  config: Pick<ShopifyOAuthConfig, "clientId" | "redirectUri">;
  state: string;
  scopes?: readonly string[];
}): string {
  const shop = normalizeShopDomain(params.shop);
  const query = new URLSearchParams({
    client_id: params.config.clientId,
    scope: (params.scopes ?? SHOPIFY_SCOPES).join(","),
    redirect_uri: params.config.redirectUri,
    state: params.state,
  });
  return `https://${shop}/admin/oauth/authorize?${query.toString()}`;
}

export interface ShopifyTokenResponse {
  accessToken: string;
  scope: string;
  raw: Record<string, unknown>;
}

/**
 * Exchange an authorization code for a permanent access token.
 * Docs: POST https://{shop}/admin/oauth/access_token
 */
export async function exchangeShopifyCode(params: {
  shop: string;
  config: ShopifyOAuthConfig;
  code: string;
  fetchImpl?: FetchLike;
}): Promise<ShopifyTokenResponse> {
  const shop = normalizeShopDomain(params.shop);
  const fetchImpl = params.fetchImpl ?? fetch;
  const response = await fetchImpl(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: params.config.clientId,
      client_secret: params.config.clientSecret,
      code: params.code,
    }),
  });
  if (!response.ok) {
    throw new Error(`Shopify token exchange failed with HTTP ${response.status}`);
  }
  const raw = (await response.json()) as Record<string, unknown>;
  const accessToken = typeof raw.access_token === "string" ? raw.access_token : "";
  if (!accessToken) {
    throw new Error("Shopify token exchange returned no access_token");
  }
  return { accessToken, scope: typeof raw.scope === "string" ? raw.scope : "", raw };
}

/**
 * Verify the HMAC signature Shopify attaches to the app's redirect query
 * string. The `hmac` parameter itself is excluded from the signed message.
 */
export function verifyShopifyHmac(
  query: Record<string, string>,
  clientSecret: string
): boolean {
  const { hmac, signature, ...rest } = query;
  if (!hmac) {
    return false;
  }
  const message = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${rest[key]}`)
    .join("&");
  const digest = createHmac("sha256", clientSecret).update(message).digest("hex");
  const provided = Buffer.from(hmac, "utf8");
  const expected = Buffer.from(digest, "utf8");
  if (provided.length !== expected.length) {
    return false;
  }
  void signature;
  return timingSafeEqual(provided, expected);
}
