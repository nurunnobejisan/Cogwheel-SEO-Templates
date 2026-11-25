/**
 * Universal Fallback Connector (Phase 3)
 *
 * For platforms without write APIs (Wix, custom architectures, anything not
 * WordPress/Shopify/Webflow). Instead of mutating the CMS, it registers a
 * runtime patch configuration that the `seo-autofix.js` edge runtime serves and
 * applies in the browser. The connector implements the same CmsConnector
 * contract so the deployment orchestrator treats every platform uniformly.
 */

import type {
  ApplyResult,
  CmsConnector,
  CmsTarget,
  ConnectorMutation,
  FetchLike,
} from "../types.ts";
import type { RuntimePatchConfig } from "../runtime/seo-autofix.ts";

export interface PatchRegistry {
  get(url: string): RuntimePatchConfig | null;
  set(url: string, config: RuntimePatchConfig): void;
  delete(url: string): void;
}

/** In-memory registry; production swaps in Redis / the edge KV store. */
export function createMemoryPatchRegistry(): PatchRegistry {
  const store = new Map<string, RuntimePatchConfig>();
  return {
    get(url) {
      return store.get(url) ?? null;
    },
    set(url, config) {
      store.set(url, config);
    },
    delete(url) {
      store.delete(url);
    },
  };
}

export interface CustomConnectorConfig {
  clientId: string;
  target: CmsTarget;
  registry: PatchRegistry;
  fetchImpl?: FetchLike;
  now?: () => string;
}

/** Fields the universal runtime connector can express. */
export const RUNTIME_SUPPORTED_FIELDS = new Set([
  "title",
  "meta_description",
  "canonical_url",
  "meta_robots",
  "viewport_meta",
  "json_ld_schema",
  "og_title",
  "og_description",
  "og_image",
  "twitter_card",
]);

/** Translate connector mutations into a runtime patch config. */
export function buildRuntimePatch(
  mutations: ConnectorMutation[],
  base: Pick<RuntimePatchConfig, "url" | "clientId" | "updatedAt">
): { config: RuntimePatchConfig; applied: number; errors: string[] } {
  const config: RuntimePatchConfig = { ...base };
  const og: Record<string, string> = {};
  const twitter: Record<string, string> = {};
  const errors: string[] = [];
  let applied = 0;

  for (const mutation of mutations) {
    if (mutation.action === "manual_review") {
      continue;
    }
    switch (mutation.field) {
      case "title":
        config.title = asString(mutation.after);
        applied += 1;
        break;
      case "meta_description":
        config.metaDescription = asString(mutation.after);
        applied += 1;
        break;
      case "canonical_url":
        config.canonical = asString(mutation.after);
        applied += 1;
        break;
      case "meta_robots":
        config.robots = asString(mutation.after);
        applied += 1;
        break;
      case "viewport_meta":
        config.viewport = asString(mutation.after);
        applied += 1;
        break;
      case "json_ld_schema":
        if (typeof mutation.after === "object" && mutation.after !== null) {
          config.jsonLd = mutation.after;
          applied += 1;
        } else {
          errors.push('field "json_ld_schema" requires an object value');
        }
        break;
      case "og_title":
        og["og:title"] = asString(mutation.after);
        applied += 1;
        break;
      case "og_description":
        og["og:description"] = asString(mutation.after);
        applied += 1;
        break;
      case "og_image":
        og["og:image"] = asString(mutation.after);
        applied += 1;
        break;
      case "twitter_card":
        twitter["twitter:card"] = asString(mutation.after);
        applied += 1;
        break;
      default:
        errors.push(`field "${mutation.field}" is not supported by the runtime connector`);
    }
  }

  if (Object.keys(og).length > 0) {
    config.og = og;
  }
  if (Object.keys(twitter).length > 0) {
    config.twitter = twitter;
  }
  return { config, applied, errors };
}

function asString(value: ConnectorMutation["after"]): string {
  return value === null ? "" : typeof value === "string" ? value : JSON.stringify(value);
}

export function createCustomConnector(config: CustomConnectorConfig): CmsConnector {
  const fetchImpl = config.fetchImpl ?? fetch;
  const clock = config.now ?? (() => new Date().toISOString());

  return {
    platform: "custom",
    target: config.target,
    // The runtime patches the DOM client-side; the server HTML is unchanged.
    verificationMode: "connector",
    supportsField(field: string): boolean {
      return RUNTIME_SUPPORTED_FIELDS.has(field);
    },

    async readSnapshot(): Promise<Record<string, unknown>> {
      return { config: config.registry.get(config.target.url) };
    },

    async applyMutations(mutations): Promise<ApplyResult> {
      const { config: patch, applied, errors } = buildRuntimePatch(mutations, {
        url: config.target.url,
        clientId: config.clientId,
        updatedAt: clock(),
      });
      if (applied > 0) {
        config.registry.set(config.target.url, patch);
      }
      return { ok: errors.length === 0, applied, errors };
    },

    async verify() {
      const response = await fetchImpl(config.target.url, { headers: {} });
      const registered = config.registry.get(config.target.url) !== null;
      return {
        ok: response.ok && registered,
        checkedUrl: config.target.url,
        status: response.status,
        details: registered
          ? "runtime patch registered and served by the edge"
          : "no runtime patch registered",
      };
    },

    async restore(snapshot): Promise<void> {
      const previous = snapshot.config as RuntimePatchConfig | null | undefined;
      if (previous) {
        config.registry.set(config.target.url, previous);
      } else {
        config.registry.delete(config.target.url);
      }
    },
  };
}
