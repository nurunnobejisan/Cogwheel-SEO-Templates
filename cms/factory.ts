/**
 * Connector Factory (Phase 3)
 *
 * Turns a stored `CmsCredential` into a bound, ready-to-use connector by
 * decrypting its secret and dispatching on the platform. This is the single
 * entry point the API gateway uses after resolving a credential.
 */

import type { CmsConnector, CmsCredential, CmsPlatform, CmsSeoPlugin, CmsTarget, FetchLike } from "./types.ts";
import { openCmsCredential } from "./credentials.ts";
import type { CredentialVault } from "./vault.ts";
import { createWordPressConnector } from "./wordpress/connector.ts";
import { createShopifyConnector } from "./shopify/connector.ts";
import { createWebflowConnector } from "./webflow/connector.ts";
import { createCustomConnector, createMemoryPatchRegistry, type PatchRegistry } from "./custom/connector.ts";

export interface ConnectorFactoryOptions {
  credential: CmsCredential;
  vault: CredentialVault;
  target: CmsTarget;
  fetchImpl?: FetchLike;
  /** Required for the `custom` platform; a memory registry is used otherwise. */
  patchRegistry?: PatchRegistry;
}

export function createConnectorForCredential(options: ConnectorFactoryOptions): CmsConnector {
  const { credential, vault, target } = options;
  const secret = openCmsCredential(vault, credential);
  const meta = credential.meta;

  return buildConnector(credential.platform, {
    target,
    meta,
    secret,
    fetchImpl: options.fetchImpl,
    patchRegistry: options.patchRegistry,
  });
}

interface BuildContext {
  target: CmsTarget;
  meta: Record<string, string>;
  secret: Record<string, unknown>;
  fetchImpl?: FetchLike;
  patchRegistry?: PatchRegistry;
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`missing required credential field "${name}"`);
  }
  return value;
}

function buildConnector(platform: CmsPlatform, ctx: BuildContext): CmsConnector {
  switch (platform) {
    case "wordpress":
      return createWordPressConnector({
        baseUrl: requireString(ctx.meta.siteUrl, "meta.siteUrl"),
        username: requireString(ctx.meta.username, "meta.username"),
        applicationPassword: requireString(ctx.secret.applicationPassword, "secret.applicationPassword"),
        seoPlugin: (ctx.meta.seoPlugin as CmsSeoPlugin) ?? "none",
        target: ctx.target,
        fetchImpl: ctx.fetchImpl,
      });

    case "shopify":
      return createShopifyConnector({
        shop: requireString(ctx.meta.shop, "meta.shop"),
        accessToken: requireString(ctx.secret.accessToken, "secret.accessToken"),
        apiVersion: ctx.meta.apiVersion,
        target: ctx.target,
        fetchImpl: ctx.fetchImpl,
      });

    case "webflow":
      return createWebflowConnector({
        accessToken: requireString(ctx.secret.accessToken, "secret.accessToken"),
        collectionId: requireString(ctx.meta.collectionId, "meta.collectionId"),
        target: ctx.target,
        fetchImpl: ctx.fetchImpl,
      });

    case "custom":
    default:
      return createCustomConnector({
        clientId: requireString(ctx.meta.clientId, "meta.clientId"),
        target: ctx.target,
        registry: ctx.patchRegistry ?? createMemoryPatchRegistry(),
        fetchImpl: ctx.fetchImpl,
      });
  }
}
