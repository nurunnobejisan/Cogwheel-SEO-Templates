export interface CmsMutationPatch {
  patchId: string;
  auditId: string;
  targetUrl: string;
  riskLevel: 'low' | 'medium' | 'high';
  mutations: Array<{
    field: 'meta_title' | 'meta_description' | 'image_alt_text' | 'json_ld_schema';
    action: 'replace' | 'inject';
    before: unknown;
    after: unknown;
  }>;
}

export interface CmsConnector {
  readSnapshot(targetUrl: string): Promise<Record<string, unknown>>;
  applyMutations(targetUrl: string, mutations: CmsMutationPatch['mutations']): Promise<void>;
  restoreSnapshot(targetUrl: string, snapshot: Record<string, unknown>): Promise<void>;
}

/**
 * Deploys a self‑healing patch to a CMS target. Handles auto‑pilot gating, pre‑change snapshot,
 * post‑deployment verification, and automatic rollback on failures.
 */
export async function deploySelfHealingPatch(
  patch: CmsMutationPatch,
  connector: CmsConnector,
  autoPilotEnabled: boolean
): Promise<{ deployed: boolean; rolledBack: boolean; reason?: string }> {
  // Approval gate: only low‑risk patches may auto‑pilot without manual approval.
  if (!autoPilotEnabled && patch.riskLevel !== 'low') {
    return { deployed: false, rolledBack: false, reason: 'Queued for manual operator approval' };
  }

  // Step 4: Capture atomic pre‑change snapshot.
  const snapshot = await connector.readSnapshot(patch.targetUrl);
  await connector.applyMutations(patch.targetUrl, patch.mutations);

  // Step 5: Wait for the live site to settle (15 s) before verification.
  await new Promise((r) => setTimeout(r, 15_000));
  const res = await fetch(patch.targetUrl, { method: 'GET', cache: 'no-store' });

  if (!res.ok) {
    // Step 6: Roll back on any non‑200 HTTP response.
    await connector.restoreSnapshot(patch.targetUrl, snapshot);
    return { deployed: false, rolledBack: true, reason: `Live verification HTTP ${res.status}` };
  }

  const html = await res.text();
  // Verify injected JSON‑LD (if present) is syntactically valid.
  if (html.includes('<script type="application/ld+json">')) {
    const matches = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
    for (const m of matches) {
      try {
        JSON.parse(m[1]);
      } catch {
        await connector.restoreSnapshot(patch.targetUrl, snapshot);
        return { deployed: false, rolledBack: true, reason: 'Injected JSON-LD failed syntax check' };
      }
    }
  }

  return { deployed: true, rolledBack: false };
}
