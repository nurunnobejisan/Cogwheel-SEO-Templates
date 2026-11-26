/**
 * Webflow CMS Connector (Phase 3)
 *
 * Webflow exposes a REST v2 API for CMS items. SEO title/description live in
 * collection custom fields (typically `meta-title` / `meta-description`), so the
 * connector accepts a field map and PATCHes the item's `fieldData`.
 */

import type {
  ApplyResult,
  CmsConnector,
  CmsTarget,
  ConnectorMutation,
  FetchLike,
} from "../types.ts";

export interface WebflowConnectorConfig {
  accessToken: string;
  collectionId: string;
  target: CmsTarget;
  /** CMS field slug per SEO Studio field. */
  fieldMap?: Partial<Record<string, string>>;
  fetchImpl?: FetchLike;
}

const DEFAULT_FIELD_MAP: Record<string, string> = {
  title: "meta-title",
  meta_description: "meta-description",
  h1: "name",
  og_title: "og-title",
  og_description: "og-description",
  og_image: "og-image",
};

function resolveField(field: string, map: Record<string, string>): string | null {
  return map[field] ?? null;
}

export function buildWebflowFieldData(
  mutations: ConnectorMutation[],
  fieldMap: Record<string, string>
): { fieldData: Record<string, unknown>; applied: number; errors: string[] } {
  const fieldData: Record<string, unknown> = {};
  const errors: string[] = [];
  let applied = 0;

  for (const mutation of mutations) {
    if (mutation.action === "manual_review") {
      continue;
    }
    const key = resolveField(mutation.field, fieldMap);
    if (!key) {
      errors.push(`field "${mutation.field}" has no Webflow field mapping`);
      continue;
    }
    fieldData[key] = mutation.after;
    applied += 1;
  }
  return { fieldData, applied, errors };
}

export function createWebflowConnector(config: WebflowConnectorConfig): CmsConnector {
  const fetchImpl = config.fetchImpl ?? fetch;
  const fieldMap: Record<string, string> = { ...DEFAULT_FIELD_MAP };
  for (const [key, value] of Object.entries(config.fieldMap ?? {})) {
    if (value) {
      fieldMap[key] = value;
    }
  }
  const base = `https://api.webflow.com/v2/collections/${config.collectionId}/items/${config.target.resourceId}`;
  const headers = {
    Authorization: `Bearer ${config.accessToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  return {
    platform: "webflow",
    target: config.target,

    async readSnapshot(): Promise<Record<string, unknown>> {
      const response = await fetchImpl(base, { headers });
      if (!response.ok) {
        throw new Error(`Webflow read failed with HTTP ${response.status}`);
      }
      const raw = (await response.json()) as { fieldData?: Record<string, unknown> };
      return { fieldData: raw.fieldData ?? {} };
    },

    async applyMutations(mutations): Promise<ApplyResult> {
      const { fieldData, applied, errors } = buildWebflowFieldData(mutations, fieldMap);
      if (Object.keys(fieldData).length === 0) {
        return { ok: errors.length === 0, applied: 0, errors };
      }
      const response = await fetchImpl(base, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ fieldData }),
      });
      if (!response.ok) {
        errors.push(`Webflow update failed with HTTP ${response.status}`);
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
      await fetchImpl(base, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ fieldData: snapshot.fieldData ?? {} }),
      });
    },
  };
}
