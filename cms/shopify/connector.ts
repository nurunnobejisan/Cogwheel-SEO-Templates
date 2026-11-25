/**
 * Shopify Admin GraphQL Connector (Phase 3)
 *
 * Executes targeted Admin GraphQL mutations for SEO parameters
 * (`productUpdate` / `collectionUpdate` / `pageUpdate` with the `seo` input),
 * and injects dynamic JSON-LD schemas via a namespace metafield consumed by an
 * App Embed Block — no Liquid file modifications.
 */

import type {
  ApplyResult,
  CmsConnector,
  CmsTarget,
  ConnectorMutation,
  FetchLike,
} from "../types.ts";

export const DEFAULT_SHOPIFY_API_VERSION = "2024-10";

export interface ShopifyConnectorConfig {
  /** Shop domain, e.g. "example.myshopify.com". */
  shop: string;
  accessToken: string;
  target: CmsTarget;
  apiVersion?: string;
  fetchImpl?: FetchLike;
  /** Metafield namespace/key for the App Embed schema injection. */
  schemaNamespace?: string;
  schemaKey?: string;
}

interface ShopifyUserError {
  field?: string[] | null;
  message: string;
}

interface GraphQLResponse {
  data?: Record<string, unknown>;
  errors?: Array<{ message: string }>;
}

function normalizeShop(shop: string): string {
  const trimmed = shop.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return trimmed.includes(".") ? trimmed : `${trimmed}.myshopify.com`;
}

/** Map a resource type to the matching Admin GraphQL update mutation. */
export function shopifyUpdateMutation(resourceType: string): string {
  switch (resourceType) {
    case "collection":
      return "collectionUpdate";
    case "page":
      return "pageUpdate";
    case "product":
    default:
      return "productUpdate";
  }
}

/**
 * Split mutations into the GraphQL `input` fields and schema metafields.
 * Unsupported fields are returned so the caller can queue them.
 */
export function buildShopifyInput(mutations: ConnectorMutation[]): {
  input: Record<string, unknown>;
  seo: Record<string, string>;
  schema: Record<string, unknown> | null;
  errors: string[];
} {
  const input: Record<string, unknown> = {};
  const seo: Record<string, string> = {};
  const errors: string[] = [];
  let schema: Record<string, unknown> | null = null;

  for (const mutation of mutations) {
    if (mutation.action === "manual_review") {
      continue;
    }
    switch (mutation.field) {
      case "title":
        seo.title = asString(mutation.after);
        break;
      case "meta_description":
        seo.description = asString(mutation.after);
        break;
      case "h1":
        input.title = asString(mutation.after);
        break;
      case "json_ld_schema":
        schema = typeof mutation.after === "object" && mutation.after !== null ? mutation.after : null;
        break;
      default:
        errors.push(`field "${mutation.field}" has no Shopify Admin API mapping`);
    }
  }

  if (Object.keys(seo).length > 0) {
    input.seo = seo;
  }
  return { input, seo, schema, errors };
}

function asString(value: ConnectorMutation["after"]): string {
  return value === null ? "" : typeof value === "string" ? value : JSON.stringify(value);
}

const PRODUCT_SEO_QUERY = `query CogwheelProductSeo($id: ID!) {
  product(id: $id) {
    id
    title
    seo { title description }
    metafield(namespace: "cogwheel", key: "schema_json") { value }
  }
}`;

export function createShopifyConnector(config: ShopifyConnectorConfig): CmsConnector {
  const fetchImpl = config.fetchImpl ?? fetch;
  const shop = normalizeShop(config.shop);
  const version = config.apiVersion ?? DEFAULT_SHOPIFY_API_VERSION;
  const endpoint = `https://${shop}/admin/api/${version}/graphql.json`;
  const namespace = config.schemaNamespace ?? "cogwheel";
  const key = config.schemaKey ?? "schema_json";
  const resourceType = config.target.resourceType ?? "product";

  async function graphql(
    query: string,
    variables: Record<string, unknown>
  ): Promise<GraphQLResponse> {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": config.accessToken,
        Accept: "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) {
      throw new Error(`Shopify GraphQL request failed with HTTP ${response.status}`);
    }
    return (await response.json()) as GraphQLResponse;
  }

  function collectUserErrors(payload: GraphQLResponse, mutationRoot: string): string[] {
    const errors: string[] = [];
    for (const error of payload.errors ?? []) {
      errors.push(error.message);
    }
    const data = payload.data ?? {};
    // Mutation payloads nest userErrors under the mutation root key.
    const root = data[mutationRoot] as { userErrors?: ShopifyUserError[] } | undefined;
    for (const userError of root?.userErrors ?? []) {
      errors.push(`${userError.field?.join(".") ?? "input"}: ${userError.message}`);
    }
    return errors;
  }

  return {
    platform: "shopify",
    target: config.target,

    async readSnapshot(): Promise<Record<string, unknown>> {
      const payload = await graphql(PRODUCT_SEO_QUERY, { id: config.target.resourceId });
      const product = (payload.data?.product ?? {}) as Record<string, unknown>;
      return {
        id: config.target.resourceId,
        title: product.title ?? "",
        seo: product.seo ?? { title: "", description: "" },
      };
    },

    async applyMutations(mutations): Promise<ApplyResult> {
      const { input, schema, errors } = buildShopifyInput(mutations);
      let applied = 0;

      if (Object.keys(input).length > 1 || Object.keys(input).some((field) => field !== "id")) {
        const mutationName = shopifyUpdateMutation(resourceType);
        const response = await graphql(
          `mutation CogwheelUpdateSeo($input: ${mutationRootInput(mutationName)}!) {
            ${mutationName}(input: $input) {
              userErrors { field message }
            }
          }`,
          { input: { id: config.target.resourceId, ...input } }
        );
        const userErrors = collectUserErrors(response, mutationName);
        if (userErrors.length > 0) {
          errors.push(...userErrors);
        } else {
          applied += Object.keys(input).length;
        }
      }

      if (schema) {
        const response = await graphql(
          `mutation CogwheelSchemaMetafield($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) {
              userErrors { field message }
            }
          }`,
          {
            metafields: [
              {
                ownerId: config.target.resourceId,
                namespace,
                key,
                type: "json",
                value: JSON.stringify(schema),
              },
            ],
          }
        );
        const userErrors = collectUserErrors(response, "metafieldsSet");
        if (userErrors.length > 0) {
          errors.push(...userErrors);
        } else {
          applied += 1;
        }
      }

      return { ok: errors.length === 0, applied, errors };
    },

    async verify() {
      const response = await fetchImpl(config.target.url, { headers: {} });
      return {
        ok: response.ok,
        checkedUrl: config.target.url,
        status: response.status,
        details: response.ok ? "storefront page reachable" : "storefront page unreachable",
      };
    },

    async restore(snapshot): Promise<void> {
      const seo = (snapshot.seo as Record<string, string>) ?? {};
      const mutationName = shopifyUpdateMutation(resourceType);
      await graphql(
        `mutation CogwheelRestoreSeo($input: ${mutationRootInput(mutationName)}!) {
          ${mutationName}(input: $input) {
            userErrors { field message }
          }
        }`,
        { input: { id: config.target.resourceId, title: snapshot.title ?? "", seo } }
      );
    },
  };
}

function mutationRootInput(mutationName: string): string {
  switch (mutationName) {
    case "collectionUpdate":
      return "CollectionInput";
    case "pageUpdate":
      return "PageUpdateInput";
    case "productUpdate":
    default:
      return "ProductInput";
  }
}
