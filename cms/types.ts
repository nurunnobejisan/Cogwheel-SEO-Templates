/**
 * Cogwheel CMS Integration Layer — Shared Types (Phase 3)
 *
 * Contracts for the encrypted credential vault, the OAuth 2.0 state handlers,
 * the platform connectors (WordPress / Shopify / Webflow / custom runtime) and
 * the guarded deployment orchestrator.
 *
 * Consumes the Phase 2 FixPatch and produces a DeploymentResult.
 *
 * See docs/ROADMAP_UNIVERSAL_AUDIT_AND_CMS_AUTOFIX.md (Phase 3).
 */

export type CmsPlatform = "wordpress" | "shopify" | "webflow" | "custom";

/** Supported WordPress SEO plugins and their meta-key conventions. */
export type CmsSeoPlugin = "yoast" | "rank_math" | "aioseo" | "none";

export type MutationAction = "replace" | "inject" | "remove" | "manual_review";

export type PatchRisk = "low" | "medium" | "high";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * A stored credential. The secret payload is always vault-encrypted; only
 * non-sensitive routing metadata sits in the clear.
 */
export interface CmsCredential {
  id: string;
  platform: CmsPlatform;
  /** Human label, e.g. "example.com WordPress". */
  label: string;
  /** Non-secret metadata: shop domain, site URL, username, scopes, plugin. */
  meta: Record<string, string>;
  /** AES-256-GCM sealed secret payload produced by the vault. */
  secret: string;
  createdAt: string;
  updatedAt: string;
}

/** The plaintext secret shape the connectors expect after decryption. */
export interface CmsSecretPayload {
  applicationPassword?: string;
  accessToken?: string;
  apiKey?: string;
  refreshToken?: string;
  expiresAt?: string;
  [key: string]: unknown;
}

export interface CmsTarget {
  /** Canonical page URL being fixed. */
  url: string;
  /** Platform-specific resource id (post id, product gid, item id). */
  resourceId: string;
  /** Resource kind, e.g. "posts", "pages", "product", "collection". */
  resourceType?: string;
}

/** Platform-agnostic mutation the connectors translate into API calls. */
export interface ConnectorMutation {
  field: string;
  action: MutationAction;
  before: string | Record<string, unknown> | null;
  after: string | Record<string, unknown> | null;
}

export interface ApplyResult {
  ok: boolean;
  applied: number;
  errors: string[];
}

export interface VerifyResult {
  ok: boolean;
  checkedUrl?: string;
  status?: number;
  details?: string;
}

/**
 * A bound connector: created for a specific credential + target and able to
 * read, mutate, verify and restore that one resource.
 */
export interface CmsConnector {
  readonly platform: CmsPlatform;
  readonly target: CmsTarget;
  readSnapshot(): Promise<Record<string, unknown>>;
  applyMutations(mutations: ConnectorMutation[]): Promise<ApplyResult>;
  /** Optional live verification after applying. */
  verify?(): Promise<VerifyResult>;
  restore(snapshot: Record<string, unknown>): Promise<void>;
  /**
   * How the healing pipeline should verify a deploy:
   *   "live-dom"  — fetch the public URL and compare the rendered DOM (default).
   *   "connector" — trust `verify()`; used when the fix is applied client-side
   *                 (e.g. the universal runtime connector) so the server HTML
   *                 is intentionally unchanged.
   */
  readonly verificationMode?: "live-dom" | "connector";
  /** Whether this connector can express a field. Defaults to true. */
  supportsField?(field: string): boolean;
}

export interface PatchDiffEntry {
  field: string;
  action: MutationAction;
  before: string;
  after: string;
  risk: PatchRisk;
  autoApply: boolean;
}

export type DeploymentStatus =
  | "deployed"
  | "queued"
  | "dry_run"
  | "failed"
  | "rolled_back";

export interface DeploymentResult {
  patchId: string;
  targetUrl: string;
  platform: CmsPlatform;
  status: DeploymentStatus;
  applied: number;
  queued: number;
  rolledBack: boolean;
  reason?: string;
  errors: string[];
  diff: PatchDiffEntry[];
  timestamp: string;
}
