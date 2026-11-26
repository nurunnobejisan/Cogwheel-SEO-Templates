/**
 * WordPress REST Connector (Phase 3)
 *
 * Writes SEO metadata through the native WordPress REST API
 * (`/wp-json/wp/v2/{posts|pages}/{id}`) using an isolated application password
 * (`seo-autofix-bot`). Maps the SEO Studio CMS fields onto the leading SEO
 * plugins' meta keys (Yoast, Rank Math, All in One SEO).
 */

import type {
  ApplyResult,
  CmsConnector,
  CmsSeoPlugin,
  CmsTarget,
  ConnectorMutation,
  FetchLike,
} from "../types.ts";

/** Plugin-specific meta-key conventions (roadmap Phase 3). */
export const WORDPRESS_META_KEYS: Record<
  Exclude<CmsSeoPlugin, "none">,
  Record<string, string>
> = {
  yoast: {
    title: "_yoast_wpseo_title",
    meta_description: "_yoast_wpseo_metadesc",
    canonical_url: "_yoast_wpseo_canonical",
    og_title: "_yoast_wpseo_opengraph-title",
    og_description: "_yoast_wpseo_opengraph-description",
    twitter_card: "_yoast_wpseo_twitter-card",
    json_ld_schema: "_cogwheel_schema_json",
  },
  rank_math: {
    title: "rank_math_title",
    meta_description: "rank_math_description",
    canonical_url: "rank_math_canonical_url",
    og_title: "rank_math_facebook_title",
    og_description: "rank_math_facebook_description",
    twitter_card: "rank_math_twitter_card_type",
    json_ld_schema: "_cogwheel_schema_json",
  },
  aioseo: {
    title: "_aioseo_title",
    meta_description: "_aioseo_description",
    canonical_url: "_aioseo_canonical_url",
    og_title: "_aioseo_og_title",
    og_description: "_aioseo_og_description",
    twitter_card: "_aioseo_twitter_card",
    json_ld_schema: "_cogwheel_schema_json",
  },
};

/** Fallback meta keys used when no SEO plugin is configured. */
export const WORDPRESS_GENERIC_META_KEYS: Record<string, string> = {
  title: "_cogwheel_seo_title",
  meta_description: "_cogwheel_meta_description",
  canonical_url: "_cogwheel_canonical_url",
  og_title: "_cogwheel_og_title",
  og_description: "_cogwheel_og_description",
  twitter_card: "_cogwheel_twitter_card",
  json_ld_schema: "_cogwheel_schema_json",
};

export interface WordPressConnectorConfig {
  /** Site origin, e.g. "https://example.com". */
  baseUrl: string;
  /** Application-password user (e.g. `seo-autofix-bot`). */
  username: string;
  applicationPassword: string;
  /** Target post/page resource. */
  target: CmsTarget;
  seoPlugin?: CmsSeoPlugin;
  fetchImpl?: FetchLike;
  /** Extra / overriding field → meta-key map. */
  metaOverrides?: Record<string, string>;
}

function restBase(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/wp-json/wp/v2`;
}

function authHeader(username: string, applicationPassword: string): string {
  return `Basic ${Buffer.from(`${username}:${applicationPassword}`, "utf8").toString("base64")}`;
}

/** Resolve the meta key for a CMS field, or null when the field is unsupported. */
export function resolveWordPressMetaKey(
  field: string,
  plugin: CmsSeoPlugin = "none",
  overrides: Record<string, string> = {}
): string | null {
  if (overrides[field]) {
    return overrides[field]!;
  }
  if (plugin !== "none" && WORDPRESS_META_KEYS[plugin][field]) {
    return WORDPRESS_META_KEYS[plugin][field]!;
  }
  return WORDPRESS_GENERIC_META_KEYS[field] ?? null;
}

function encodeValue(value: ConnectorMutation["after"]): string {
  if (value === null) {
    return "";
  }
  return typeof value === "string" ? value : JSON.stringify(value);
}

/**
 * Build the WordPress REST PATCH body for a set of mutations. Unsupported
 * fields are reported back so the caller can queue them for review.
 */
export function buildWordPressPayload(
  mutations: ConnectorMutation[],
  plugin: CmsSeoPlugin = "none",
  overrides: Record<string, string> = {}
): { body: Record<string, unknown>; applied: number; errors: string[] } {
  const body: Record<string, unknown> = {};
  const meta: Record<string, string> = {};
  const errors: string[] = [];
  let applied = 0;

  for (const mutation of mutations) {
    if (mutation.action === "manual_review") {
      continue;
    }
    // h1 / heading text map onto the native post title.
    if (mutation.field === "h1") {
      body.title = encodeValue(mutation.after);
      applied += 1;
      continue;
    }
    const metaKey = resolveWordPressMetaKey(mutation.field, plugin, overrides);
    if (!metaKey) {
      errors.push(`field "${mutation.field}" has no WordPress mapping`);
      continue;
    }
    meta[metaKey] = encodeValue(mutation.after);
    applied += 1;
  }

  if (Object.keys(meta).length > 0) {
    body.meta = meta;
  }
  return { body, applied, errors };
}

export function createWordPressConnector(config: WordPressConnectorConfig): CmsConnector {
  const fetchImpl = config.fetchImpl ?? fetch;
  const plugin = config.seoPlugin ?? "none";
  const resourceType = config.target.resourceType ?? "posts";
  const resourceUrl = `${restBase(config.baseUrl)}/${resourceType}/${config.target.resourceId}`;
  const headers = {
    Authorization: authHeader(config.username, config.applicationPassword),
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  return {
    platform: "wordpress",
    target: config.target,

    async readSnapshot(): Promise<Record<string, unknown>> {
      const response = await fetchImpl(`${resourceUrl}?context=edit`, { headers });
      if (!response.ok) {
        throw new Error(`WordPress read failed with HTTP ${response.status}`);
      }
      const raw = (await response.json()) as {
        title?: { raw?: string; rendered?: string };
        meta?: Record<string, unknown>;
        status?: string;
      };
      return {
        title: raw.title?.raw ?? raw.title?.rendered ?? "",
        meta: raw.meta ?? {},
        status: raw.status ?? "publish",
      };
    },

    async applyMutations(mutations): Promise<ApplyResult> {
      const { body, applied, errors } = buildWordPressPayload(
        mutations,
        plugin,
        config.metaOverrides ?? {}
      );
      if (Object.keys(body).length === 0) {
        return { ok: errors.length === 0, applied: 0, errors };
      }
      const response = await fetchImpl(resourceUrl, {
        method: "POST", // WP accepts POST for updates; X-HTTP-Method-Override not required
        headers,
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        errors.push(`WordPress update failed with HTTP ${response.status}`);
        return { ok: false, applied: 0, errors };
      }
      return { ok: true, applied, errors };
    },

    async verify() {
      const response = await fetchImpl(config.target.url, { headers: {} });
      return {
        ok: response.ok,
        checkedUrl: config.target.url,
        status: response.status,
        details: response.ok ? "live page reachable" : "live page unreachable",
      };
    },

    async restore(snapshot): Promise<void> {
      const title = typeof snapshot.title === "string" ? snapshot.title : undefined;
      const meta = (snapshot.meta as Record<string, string>) ?? {};
      const body: Record<string, unknown> = { meta };
      if (title !== undefined) {
        body.title = title;
      }
      await fetchImpl(resourceUrl, { method: "POST", headers, body: JSON.stringify(body) });
    },
  };
}
