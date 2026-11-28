import { describe, it, expect } from "vitest";
import type { FixPatch } from "../ai/types.ts";
import {
  buildSeoAutofixScript,
  buildSeoAutofixSnippet,
  buildShopifyAuthorizeUrl,
  buildShopifyInput,
  buildRuntimePatch,
  buildWebflowFieldData,
  buildWordPressPayload,
  createCmsCredential,
  createConnectorForCredential,
  createCredentialVault,
  createCustomConnector,
  createMemoryPatchRegistry,
  createOAuthStateManager,
  createPkcePair,
  createShopifyConnector,
  createWebflowConnector,
  createWordPressConnector,
  deployPatch,
  exchangeShopifyCode,
  measureScriptBytes,
  normalizeShopDomain,
  openCmsCredential,
  previewPatchDiff,
  redactCmsCredential,
  redactSecret,
  resolveVaultKeyFromEnv,
  resolveWordPressMetaKey,
  SEO_AUTOFIX_MAX_BYTES,
  SHOPIFY_SCOPES,
  shopifyUpdateMutation,
  verifyShopifyHmac,
  type CmsConnector,
  type ConnectorMutation,
  type FetchLike,
} from "../cms/index.ts";

const NOW = "2026-02-01T09:00:00.000Z";

/* --------------------------------------------------------------- helpers -- */

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function recordingFetch(
  responder: (url: string, init?: RequestInit) => Response
): { calls: Array<{ url: string; init?: RequestInit }>; fetchImpl: FetchLike } {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return responder(url, init);
  };
  return { calls, fetchImpl };
}

function makePatch(mutations: FixPatch["mutations"]): FixPatch {
  return {
    patchId: "ptch_test",
    auditId: "aud_test_univ",
    targetUrl: "https://example.com/products/widgets",
    mode: "universal",
    createdAt: NOW,
    mutations,
  };
}

/* ----------------------------------------------------------------- vault -- */

describe("Phase 3 — Encrypted credential vault", () => {
  const vault = createCredentialVault(Buffer.alloc(32, 7));

  it("round-trips plaintext and JSON secrets", () => {
    const sealed = vault.encrypt("super-secret-app-password");
    expect(sealed.startsWith("v1:")).toBe(true);
    expect(sealed).not.toContain("super-secret-app-password");
    expect(vault.decrypt(sealed)).toBe("super-secret-app-password");

    const wrapped = vault.seal({ accessToken: "tok_123", scopes: ["read_products"] });
    expect(vault.open(wrapped)).toEqual({ accessToken: "tok_123", scopes: ["read_products"] });
  });

  it("detects tampering and wrong keys (AES-GCM auth tag)", () => {
    const sealed = vault.encrypt("value");
    const tampered = `${sealed.slice(0, -2)}AA`;
    expect(() => vault.decrypt(tampered)).toThrow();

    const other = createCredentialVault(Buffer.alloc(32, 9));
    expect(() => other.decrypt(sealed)).toThrow();
  });

  it("derives a 32-byte key from a passphrase and loads from env", () => {
    const fromString = createCredentialVault("a-development-passphrase");
    expect(fromString.decrypt(fromString.encrypt("x"))).toBe("x");
    const env: NodeJS.ProcessEnv = { NODE_ENV: "test", CMS_VAULT_KEY: "a-development-passphrase" };
    expect(resolveVaultKeyFromEnv(env)?.length).toBe(32);
  });

  it("redacts secrets for logs and credentials", () => {
    expect(redactSecret("abcdefghijkl")).toBe("abcd********");
    expect(redactSecret(undefined)).toBe("(unset)");

    const credential = createCmsCredential({
      vault,
      platform: "shopify",
      label: "Example Shopify",
      meta: { shop: "example.myshopify.com" },
      secret: { accessToken: "shpat_1234567890" },
      id: "cred_1",
      now: NOW,
    });
    const safe = redactCmsCredential(vault, credential);
    expect(safe.secretPreview.accessToken).toBe("shpa" + "*".repeat(12));
    expect(safe.secret).not.toContain("shpat_1234567890");
    expect(openCmsCredential(vault, credential)).toEqual({ accessToken: "shpat_1234567890" });
  });
});

/* ----------------------------------------------------------------- oauth -- */

describe("Phase 3 — OAuth 2.0 state handlers", () => {
  it("issues and consumes a signed, expiring state with PKCE", () => {
    const manager = createOAuthStateManager({ secret: "state-secret", now: () => 1_000 });
    const issued = manager.issue({ platform: "shopify", redirectUri: "https://app/cb" });
    expect(issued.codeChallengeMethod).toBe("S256");

    const payload = manager.consume(issued.state);
    expect(payload.platform).toBe("shopify");
    expect(payload.redirectUri).toBe("https://app/cb");
    expect(payload.codeVerifier).toBe(issued.codeVerifier);

    // The challenge is the SHA-256 of the verifier.
    const pkce = createPkcePair();
    expect(pkce.codeChallenge).not.toBe(pkce.codeVerifier);
  });

  it("rejects replay, tampering and expiry", () => {
    let clock = 1_000;
    const manager = createOAuthStateManager({
      secret: "state-secret",
      ttlMs: 500,
      now: () => clock,
    });
    const issued = manager.issue({ platform: "wordpress", redirectUri: "https://app/cb" });
    expect(() => manager.consume(`${issued.state}x`)).toThrow(/signature mismatch/);
    manager.consume(issued.state);
    expect(() => manager.consume(issued.state)).toThrow(/replay/);

    clock = 1_000;
    const shortLived = createOAuthStateManager({ secret: "s", ttlMs: 100, now: () => clock });
    const second = shortLived.issue({ platform: "shopify", redirectUri: "https://app/cb" });
    clock = 2_000;
    expect(() => shortLived.consume(second.state)).toThrow(/expired/);
  });
});

describe("Phase 3 — Shopify OAuth flow", () => {
  it("normalises shop domains and builds the authorize URL with granular scopes", () => {
    expect(normalizeShopDomain("example")).toBe("example.myshopify.com");
    expect(normalizeShopDomain("https://Example.myshopify.com/")).toBe("example.myshopify.com");
    const url = buildShopifyAuthorizeUrl({
      shop: "example",
      config: { clientId: "cid", redirectUri: "https://app/cb" },
      state: "xyz",
    });
    expect(url).toContain("https://example.myshopify.com/admin/oauth/authorize?");
    expect(decodeURIComponent(url)).toContain(SHOPIFY_SCOPES.join(","));
    expect(url).toContain("state=xyz");
  });

  it("verifies the callback HMAC and rejects forgeries", () => {
    const secret = "shpss_secret";
    // Deterministic signature for a known query set.
    const { createHmac } = require("node:crypto") as typeof import("node:crypto");
    const base = { code: "abc", shop: "example.myshopify.com", state: "xyz", timestamp: "1700000000" };
    const message = Object.keys(base)
      .sort()
      .map((k) => `${k}=${(base as Record<string, string>)[k]}`)
      .join("&");
    const hmac = createHmac("sha256", secret).update(message).digest("hex");
    expect(verifyShopifyHmac({ ...base, hmac }, secret)).toBe(true);
    expect(verifyShopifyHmac({ ...base, hmac: hmac.replace(/.$/, "0") }, secret)).toBe(false);
    expect(verifyShopifyHmac(base, secret)).toBe(false);
  });

  it("exchanges the code for an access token", async () => {
    const { fetchImpl, calls } = recordingFetch(() =>
      jsonResponse({ access_token: "shpat_x", scope: "read_products" })
    );
    const result = await exchangeShopifyCode({
      shop: "example",
      config: { clientId: "cid", clientSecret: "sec", redirectUri: "https://app/cb" },
      code: "code123",
      fetchImpl,
    });
    expect(result.accessToken).toBe("shpat_x");
    expect(calls[0]!.url).toBe("https://example.myshopify.com/admin/oauth/access_token");
  });
});

/* ------------------------------------------------------------- WordPress -- */

describe("Phase 3 — WordPress connector", () => {
  it("maps CMS fields onto Yoast / Rank Math / AIOSEO meta keys", () => {
    expect(resolveWordPressMetaKey("title", "yoast")).toBe("_yoast_wpseo_title");
    expect(resolveWordPressMetaKey("meta_description", "rank_math")).toBe("rank_math_description");
    expect(resolveWordPressMetaKey("canonical_url", "aioseo")).toBe("_aioseo_canonical_url");
    expect(resolveWordPressMetaKey("meta_description", "none")).toBe("_seo_studio_meta_description");
    expect(resolveWordPressMetaKey("image_alt_text", "yoast")).toBeNull();
  });

  it("builds a REST payload and flags unsupported fields", () => {
    const mutations: ConnectorMutation[] = [
      { field: "title", action: "replace", before: "", after: "New SEO Title" },
      { field: "meta_description", action: "replace", before: "", after: "Desc" },
      { field: "h1", action: "inject", before: null, after: "Visible Heading" },
      { field: "image_url", action: "replace", before: null, after: "x.jpg" },
    ];
    const { body, applied, errors } = buildWordPressPayload(mutations, "yoast");
    expect(applied).toBe(3);
    expect(body.title).toBe("Visible Heading");
    expect(body.meta).toMatchObject({ _yoast_wpseo_title: "New SEO Title", _yoast_wpseo_metadesc: "Desc" });
    expect(errors.join(" ")).toMatch(/image_url/);
  });

  it("reads, updates and restores a post via the REST API with app-password auth", async () => {
    const { fetchImpl, calls } = recordingFetch((url) => {
      if (url.includes("?context=edit")) {
        return jsonResponse({ title: { raw: "Old" }, meta: { _yoast_wpseo_title: "Old" }, status: "publish" });
      }
      return jsonResponse({ id: 42 });
    });

    const connector = createWordPressConnector({
      baseUrl: "https://example.com/",
      username: "seo-autofix-bot",
      applicationPassword: "abcd efgh",
      seoPlugin: "yoast",
      target: { url: "https://example.com/blog/post", resourceId: "42", resourceType: "posts" },
      fetchImpl,
    });

    const snapshot = await connector.readSnapshot();
    expect(snapshot.title).toBe("Old");

    const applied = await connector.applyMutations([
      { field: "meta_description", action: "replace", before: null, after: "Fresh description" },
    ]);
    expect(applied.ok).toBe(true);
    expect(applied.applied).toBe(1);

    const auth = (calls[1]!.init?.headers as Record<string, string>).Authorization;
    expect(auth).toBe(`Basic ${Buffer.from("seo-autofix-bot:abcd efgh").toString("base64")}`);
    expect(calls[1]!.url).toBe("https://example.com/wp-json/wp/v2/posts/42");

    await connector.restore(snapshot);
    const restoreBody = JSON.parse(String(calls[2]!.init?.body));
    expect(restoreBody.title).toBe("Old");
  });
});

/* --------------------------------------------------------------- Shopify -- */

describe("Phase 3 — Shopify connector", () => {
  it("maps mutations to the seo input and schema metafield", () => {
    expect(shopifyUpdateMutation("product")).toBe("productUpdate");
    expect(shopifyUpdateMutation("collection")).toBe("collectionUpdate");
    const { input, schema, errors } = buildShopifyInput([
      { field: "title", action: "replace", before: null, after: "SEO title" },
      { field: "meta_description", action: "replace", before: null, after: "SEO desc" },
      { field: "h1", action: "inject", before: null, after: "Visible" },
      { field: "json_ld_schema", action: "inject", before: null, after: { "@type": "Product" } },
      { field: "meta_robots", action: "replace", before: null, after: "noindex" },
    ]);
    expect(input.seo).toEqual({ title: "SEO title", description: "SEO desc" });
    expect(input.title).toBe("Visible");
    expect(schema).toEqual({ "@type": "Product" });
    expect(errors.join(" ")).toMatch(/meta_robots/);
  });

  it("executes productUpdate + metafieldsSet GraphQL mutations", async () => {
    const { fetchImpl, calls } = recordingFetch((url, init) => {
      const body = JSON.parse(String(init?.body)) as { query: string };
      if (body.query.includes("userErrors")) {
        return jsonResponse({ data: { productUpdate: { userErrors: [] }, metafieldsSet: { userErrors: [] } } });
      }
      return jsonResponse({ data: { product: { title: "P", seo: { title: "", description: "" } } } });
    });

    const connector = createShopifyConnector({
      shop: "example",
      accessToken: "shpat_x",
      target: { url: "https://example.com/products/x", resourceId: "gid://shopify/Product/1", resourceType: "product" },
      fetchImpl,
    });

    await connector.readSnapshot();
    const result = await connector.applyMutations([
      { field: "title", action: "replace", before: null, after: "SEO title" },
      { field: "json_ld_schema", action: "inject", before: null, after: { "@type": "Product" } },
    ]);
    expect(result.ok).toBe(true);
    expect(result.applied).toBe(2);
    expect(calls[0]!.url).toContain("/admin/api/2024-10/graphql.json");
    expect((calls[1]!.init?.headers as Record<string, string>)["X-Shopify-Access-Token"]).toBe("shpat_x");
  });

  it("surfaces Shopify userErrors as apply failures", async () => {
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse({ data: { productUpdate: { userErrors: [{ field: ["seo"], message: "Invalid" }] } } })
    );
    const connector = createShopifyConnector({
      shop: "example",
      accessToken: "shpat_x",
      target: { url: "https://x", resourceId: "gid://shopify/Product/1", resourceType: "product" },
      fetchImpl,
    });
    const result = await connector.applyMutations([
      { field: "title", action: "replace", before: null, after: "T" },
    ]);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/Invalid/);
  });
});

/* --------------------------------------------------------------- Webflow -- */

describe("Phase 3 — Webflow connector", () => {
  it("maps fields to CMS custom fields", () => {
    const { fieldData, errors } = buildWebflowFieldData(
      [
        { field: "title", action: "replace", before: null, after: "T" },
        { field: "meta_description", action: "replace", before: null, after: "D" },
        { field: "heading_structure", action: "replace", before: null, after: "x" },
      ],
      { title: "meta-title", meta_description: "meta-description" }
    );
    expect(fieldData).toEqual({ "meta-title": "T", "meta-description": "D" });
    expect(errors.join(" ")).toMatch(/heading_structure/);
  });

  it("PATCHes the collection item", async () => {
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse({ id: "item1" }));
    const connector = createWebflowConnector({
      accessToken: "wf_token",
      collectionId: "col1",
      target: { url: "https://example.com/x", resourceId: "item1" },
      fetchImpl,
    });
    const result = await connector.applyMutations([
      { field: "title", action: "replace", before: null, after: "T" },
    ]);
    expect(result.ok).toBe(true);
    expect(calls[0]!.url).toBe("https://api.webflow.com/v2/collections/col1/items/item1");
    expect(calls[0]!.init?.method).toBe("PATCH");
  });
});

/* ----------------------------------------------- universal runtime + edge -- */

describe("Phase 3 — Universal fallback runtime", () => {
  it("builds an under-budget runtime that patches the DOM before render", () => {
    const script = buildSeoAutofixScript({ apiBase: "https://cdn.platform.com/" });
    expect(measureScriptBytes(script)).toBeLessThan(SEO_AUTOFIX_MAX_BYTES);
    expect(script).toContain("/v1/seo-patches");
    expect(script).toContain("data-client-id");
    expect(script).toContain("application/ld+json");
    expect(script).toContain("document.title");
  });

  it("emits the roadmap embed snippet", () => {
    const snippet = buildSeoAutofixSnippet({ clientId: "cli_9988776655" });
    expect(snippet).toContain('src="https://cdn.platform.com/v1/seo-autofix.js"');
    expect(snippet).toContain('data-client-id="cli_9988776655"');
    expect(snippet).toContain("async");
  });

  it("registers runtime patches and verifies the edge", async () => {
    const registry = createMemoryPatchRegistry();
    const { fetchImpl } = recordingFetch(() => jsonResponse({}, 200));
    const connector = createCustomConnector({
      clientId: "cli_1",
      target: { url: "https://custom.example/page", resourceId: "https://custom.example/page" },
      registry,
      fetchImpl,
      now: () => NOW,
    });

    const { config, applied } = buildRuntimePatch(
      [
        { field: "title", action: "replace", before: null, after: "T" },
        { field: "meta_description", action: "replace", before: null, after: "D" },
        { field: "json_ld_schema", action: "inject", before: null, after: { "@type": "Organization" } },
        { field: "og_title", action: "inject", before: null, after: "OT" },
      ],
      { url: "https://custom.example/page", clientId: "cli_1", updatedAt: NOW }
    );
    expect(applied).toBe(4);
    expect(config.og).toEqual({ "og:title": "OT" });

    const result = await connector.applyMutations([
      { field: "title", action: "replace", before: null, after: "T" },
    ]);
    expect(result.ok).toBe(true);
    expect(registry.get("https://custom.example/page")?.title).toBe("T");
    const verification = await connector.verify?.();
    expect(verification?.ok).toBe(true);
  });
});

/* ------------------------------------------------------ deploy orchestrator -- */

function fakeConnector(overrides: Partial<CmsConnector> = {}): CmsConnector & {
  restored: boolean;
  applied: ConnectorMutation[];
} {
  const state = {
    restored: false,
    applied: [] as ConnectorMutation[],
    platform: "wordpress" as const,
    target: { url: "https://example.com/products/widgets", resourceId: "42", resourceType: "posts" },
    async readSnapshot() {
      return { title: "Old" };
    },
    async applyMutations(mutations: ConnectorMutation[]) {
      state.applied = mutations;
      return { ok: true, applied: mutations.length, errors: [] };
    },
    async verify() {
      return { ok: true, status: 200 };
    },
    async restore() {
      state.restored = true;
    },
  };
  return Object.assign(state, overrides) as CmsConnector & { restored: boolean; applied: ConnectorMutation[] };
}

const AUTOPILOT_PATCH = makePatch([
  { field: "meta_description", action: "replace", before: "", after: "New description", risk: "low", autoApply: true },
  { field: "canonical_url", action: "replace", before: "", after: "https://example.com/products/widgets", risk: "medium", autoApply: false },
  { field: "meta_robots", action: "manual_review", before: null, after: null, risk: "high", autoApply: false },
]);

describe("Phase 3 — Guarded deployment orchestrator", () => {
  it("previews the diff and performs a dry run without touching the connector", async () => {
    const connector = fakeConnector();
    const diff = previewPatchDiff(AUTOPILOT_PATCH);
    expect(diff).toHaveLength(3);
    expect(diff[0]!.field).toBe("meta_description");

    const result = await deployPatch(AUTOPILOT_PATCH, { connector, autoPilot: true, dryRun: true, now: NOW });
    expect(result.status).toBe("dry_run");
    expect(result.applied).toBe(0);
    expect(connector.applied).toHaveLength(0);
  });

  it("deploys only auto-approved mutations under auto-pilot", async () => {
    const connector = fakeConnector();
    const result = await deployPatch(AUTOPILOT_PATCH, { connector, autoPilot: true, now: NOW });
    expect(result.status).toBe("deployed");
    expect(result.applied).toBe(1);
    expect(result.queued).toBe(2);
    expect(connector.applied.map((m) => m.field)).toEqual(["meta_description"]);
  });

  it("queues everything when no approval is given", async () => {
    const connector = fakeConnector();
    const result = await deployPatch(AUTOPILOT_PATCH, { connector, now: NOW });
    expect(result.status).toBe("queued");
    expect(result.queued).toBe(3);
    expect(connector.applied).toHaveLength(0);
  });

  it("deploys the full patch (minus manual_review) when the operator approves", async () => {
    const connector = fakeConnector();
    const result = await deployPatch(AUTOPILOT_PATCH, { connector, approveAll: true, now: NOW });
    expect(result.status).toBe("deployed");
    expect(result.applied).toBe(2);
    expect(connector.applied.map((m) => m.field)).toEqual(["meta_description", "canonical_url"]);
  });

  it("rolls back when apply fails", async () => {
    const connector = fakeConnector({
      async applyMutations() {
        return { ok: false, applied: 0, errors: ["CMS rejected write"] };
      },
    });
    const result = await deployPatch(AUTOPILOT_PATCH, { connector, autoPilot: true, now: NOW });
    expect(result.status).toBe("rolled_back");
    expect(result.rolledBack).toBe(true);
    expect(connector.restored).toBe(true);
  });

  it("rolls back when live verification fails", async () => {
    const connector = fakeConnector({
      async verify() {
        return { ok: false, status: 500, details: "server error" };
      },
    });
    const result = await deployPatch(AUTOPILOT_PATCH, { connector, autoPilot: true, now: NOW });
    expect(result.status).toBe("rolled_back");
    expect(connector.restored).toBe(true);
  });
});

/* ------------------------------------------------- credentials + factory -- */

describe("Phase 3 — Credential → connector factory", () => {
  const vault = createCredentialVault(Buffer.alloc(32, 3));

  it("builds a WordPress connector from a stored credential", () => {
    const credential = createCmsCredential({
      vault,
      platform: "wordpress",
      label: "Blog",
      meta: { siteUrl: "https://example.com", username: "seo-autofix-bot", seoPlugin: "yoast" },
      secret: { applicationPassword: "abcd efgh" },
      now: NOW,
    });
    const connector = createConnectorForCredential({
      credential,
      vault,
      target: { url: "https://example.com/p", resourceId: "1", resourceType: "posts" },
    });
    expect(connector.platform).toBe("wordpress");
    expect(connector.target.resourceId).toBe("1");
  });

  it("builds a Shopify connector and errors on a missing secret field", () => {
    const credential = createCmsCredential({
      vault,
      platform: "shopify",
      label: "Shop",
      meta: { shop: "example.myshopify.com" },
      secret: { accessToken: "shpat_x" },
      now: NOW,
    });
    const connector = createConnectorForCredential({
      credential,
      vault,
      target: { url: "https://example.com/products/x", resourceId: "gid://shopify/Product/1", resourceType: "product" },
    });
    expect(connector.platform).toBe("shopify");

    const broken = createCmsCredential({
      vault,
      platform: "shopify",
      label: "Broken",
      meta: { shop: "example.myshopify.com" },
      secret: {},
      now: NOW,
    });
    expect(() =>
      createConnectorForCredential({ credential: broken, vault, target: { url: "https://x", resourceId: "1" } })
    ).toThrow(/accessToken/);
  });

  it("builds a custom runtime connector", () => {
    const credential = createCmsCredential({
      vault,
      platform: "custom",
      label: "Wix site",
      meta: { clientId: "cli_9" },
      secret: {},
      now: NOW,
    });
    const connector = createConnectorForCredential({
      credential,
      vault,
      target: { url: "https://wix.example/page", resourceId: "https://wix.example/page" },
      patchRegistry: createMemoryPatchRegistry(),
    });
    expect(connector.platform).toBe("custom");
  });
});
