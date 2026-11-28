/**
 * Platform API Gateway (Phase 5)
 *
 * The authenticated, rate-limited, fully-audited control plane that ties
 * Phases 1–4 together. It is HTTP-framework-agnostic: `handle()` takes a
 * normalized `PlatformRequest` and returns a `PlatformResponse`, so the same
 * gateway backs Next.js route handlers, the `node:http` adapter and unit tests.
 *
 *   principal ─▶ RBAC ─▶ rate limit ─▶ handler ─▶ audit log
 *                                          └─▶ history ─▶ rollback store
 *
 * See docs/ROADMAP_UNIVERSAL_AUDIT_AND_CMS_AUTOFIX.md (§7 Safeguards).
 */

import { z } from "zod";
import type { AuditReport } from "../rules/types.ts";
import { buildSnapshotFromHtml, runAudit } from "../rules/index.ts";
import type { FixPatch } from "../ai/types.ts";
import type { CmsConnector, CmsSeoPlugin, CmsSecretPayload, CmsTarget, FetchLike } from "../cms/types.ts";
import { createCmsCredential, redactCmsCredential } from "../cms/credentials.ts";
import type { CredentialVault } from "../cms/vault.ts";
import { createConnectorForCredential } from "../cms/factory.ts";
import {
  createCustomConnector,
  createMemoryPatchRegistry,
  type PatchRegistry,
} from "../cms/custom/connector.ts";
import { deployPatch, previewPatchDiff } from "../cms/deploy.ts";
import {
  createApprovalQueue,
  type ApprovalQueue,
} from "../healing/approval.ts";
import { createHealingEventBus, type HealingEventBus } from "../healing/events.ts";
import { runHealingPipeline } from "../healing/pipeline.ts";
import { createRollbackStore, type RollbackStore } from "../healing/rollback-store.ts";
import { createScanScheduler, type ScanScheduler } from "../healing/scheduler.ts";
import { triagePatch } from "../healing/triage.ts";
import type { AutoPilotPolicy } from "../healing/types.ts";
import { createAuditLog, type AuditLog } from "./audit-log.ts";
import { createConnectorRegistry, type ConnectorRegistry } from "./connector-registry.ts";
import { createCredentialStore, type CredentialStore } from "./credential-store.ts";
import { badRequest, conflict, notFound, PlatformError } from "./errors.ts";
import {
  createDeploymentHistory,
  undoDeployment,
  type DeploymentHistory,
} from "./history.ts";
import { createPatchStore, type PatchStore } from "./patch-store.ts";
import { createRateLimiter, type RateLimiter } from "./rate-limit.ts";
import { authorize, requireRiskApproval } from "./rbac.ts";
import type {
  BucketConfig,
  ConnectorRegisterRequest,
  CredentialCreateRequest,
  HttpMethod,
  PatchPreviewResponse,
  Permission,
  PlatformRequest,
  PlatformResponse,
  Principal,
  ScheduleCreateRequest,
} from "./types.ts";

const VERSION = "phase-5.1.0";

/* ----------------------------------------------------------- validation --- */

const mutationValue = z.union([z.string(), z.record(z.unknown()), z.null()]);

const fixPatchSchema = z.object({
  patchId: z.string().min(1),
  auditId: z.string().min(1),
  targetUrl: z.string().min(1),
  mode: z.enum(["universal", "hotel"]),
  createdAt: z.string().min(1),
  mutations: z.array(
    z.object({
      field: z.string().min(1),
      action: z.enum(["replace", "inject", "remove", "manual_review"]),
      before: mutationValue,
      after: mutationValue,
      risk: z.enum(["low", "medium", "high"]),
      autoApply: z.boolean(),
    })
  ),
});

const credentialCreateSchema = z.object({
  platform: z.enum(["wordpress", "shopify", "webflow", "custom"]),
  label: z.string().min(1),
  meta: z.record(z.string()),
  secret: z.record(z.unknown()),
});

const scheduleCreateSchema = z.object({
  targetUrl: z.string().min(1),
  cron: z.string().min(1),
  enabled: z.boolean().optional(),
});

const connectorRegisterSchema = z.object({
  targetUrl: z.string().min(1),
  credentialId: z.string().min(1).optional(),
  resourceId: z.string().min(1).optional(),
  resourceType: z.string().min(1).optional(),
});

const auditRequestSchema = z.object({
  url: z.string().min(1),
});

const deploySchema = z.object({
  patch: fixPatchSchema,
  dryRun: z.boolean().optional(),
  approveAll: z.boolean().optional(),
  autoPilot: z.boolean().optional(),
  settleMs: z.number().nonnegative().optional(),
});

const healSchema = z.object({
  report: z
    .object({
      auditId: z.string().min(1),
      domain: z.string().min(1),
      pageUrl: z.string().min(1),
      mode: z.enum(["universal", "hotel"]),
      issues: z.array(z.unknown()),
    })
    .passthrough(),
  autoPilot: z.boolean().optional(),
  maxRisk: z.enum(["low", "medium", "high"]).optional(),
  approveAll: z.boolean().optional(),
});

const decisionSchema = z.object({ note: z.string().optional() });

function parse<T>(schema: z.ZodType<T>, input: unknown, what: string): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw badRequest(
      `invalid ${what}`,
      result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
    );
  }
  return result.data;
}

/* -------------------------------------------------------------- routing --- */

interface RouteContext {
  req: PlatformRequest;
  principal: Principal;
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
}

interface Route {
  method: HttpMethod;
  segments: string[];
  permission?: Permission;
  /** Extra permission also required. */
  alsoPermission?: Permission;
  handler: (ctx: RouteContext) => Promise<PlatformResponse> | PlatformResponse;
}

function splitPath(path: string): { segments: string[]; query: URLSearchParams } {
  const [rawPath = "", rawQuery = ""] = path.split("?");
  return {
    segments: rawPath.split("/").filter(Boolean),
    query: new URLSearchParams(rawQuery),
  };
}

function matchSegments(route: string[], actual: string[]): Record<string, string> | null {
  if (route.length !== actual.length) {
    return null;
  }
  const params: Record<string, string> = {};
  for (let index = 0; index < route.length; index += 1) {
    const expected = route[index]!;
    const value = actual[index]!;
    if (expected.startsWith(":")) {
      params[expected.slice(1)] = decodeURIComponent(value);
    } else if (expected !== value) {
      return null;
    }
  }
  return params;
}

/* --------------------------------------------------------------- gateway --- */

export interface GatewayOptions {
  vault: CredentialVault;
  auditLog?: AuditLog;
  history?: DeploymentHistory;
  rollbackStore?: RollbackStore;
  events?: HealingEventBus;
  approvals?: ApprovalQueue;
  patches?: PatchStore;
  connectors?: ConnectorRegistry;
  credentials?: CredentialStore;
  scheduler?: ScanScheduler;
  rateLimiter?: RateLimiter;
  /** Per-principal request budget; defaults to a generous 120 burst / 10 per s. */
  rateConfig?: BucketConfig;
  /** Injected into the healing micro-crawler (defaults to global fetch). */
  fetchImpl?: FetchLike;
  /** Runtime patch registry backing the universal `custom` connector. */
  patchRegistry?: PatchRegistry;
  /**
   * Awaited after each request so durable stores can flush their write-through
   * queue before the response is returned.
   */
  onRequestComplete?: () => Promise<void> | void;
  now?: () => string;
  version?: string;
}

export interface PlatformGateway {
  handle(request: PlatformRequest): Promise<PlatformResponse>;
  readonly auditLog: AuditLog;
  readonly history: DeploymentHistory;
  readonly approvals: ApprovalQueue;
  readonly patches: PatchStore;
  readonly rollbackStore: RollbackStore;
  readonly events: HealingEventBus;
  readonly connectors: ConnectorRegistry;
  readonly credentials: CredentialStore;
  readonly scheduler: ScanScheduler;
  readonly vault: CredentialVault;
  readonly rateLimiter: RateLimiter;
}

export function createPlatformGateway(options: GatewayOptions): PlatformGateway {
  const now = options.now ?? (() => new Date().toISOString());
  const version = options.version ?? VERSION;
  const startedAt = Date.now();
  const fetchImpl = options.fetchImpl ?? fetch;

  const vault = options.vault;
  const auditLog = options.auditLog ?? createAuditLog({ now });
  const history = options.history ?? createDeploymentHistory(now);
  const approvals = options.approvals ?? createApprovalQueue();
  const patches = options.patches ?? createPatchStore();
  const rollbackStore = options.rollbackStore ?? createRollbackStore();
  const events = options.events ?? createHealingEventBus(now);
  const connectors = options.connectors ?? createConnectorRegistry();
  const patchRegistry = options.patchRegistry ?? createMemoryPatchRegistry();
  const credentials = options.credentials ?? createCredentialStore();
  const scheduler = options.scheduler ?? createScanScheduler();
  const rateLimiter =
    options.rateLimiter ??
    createRateLimiter({
      defaultConfig: options.rateConfig ?? { capacity: 120, refillPerSecond: 10 },
    });

  /* ------------------------------------------------------------ handlers -- */

  function requireConnector(targetUrl: string) {
    const connector = connectors.resolve(targetUrl);
    if (!connector) {
      throw notFound(`no connector registered for ${targetUrl}`);
    }
    return connector;
  }

  /**
   * Bind a target URL to a connector: either a stored credential (WordPress /
   * Shopify / Webflow) or the universal runtime connector that works for any
   * platform without a write API.
   */
  function registerConnector(input: ConnectorRegisterRequest, principal: Principal): CmsConnector {
    const target: CmsTarget = {
      url: input.targetUrl,
      // Fall back to the page URL when the platform resource id is unknown.
      resourceId: input.resourceId ?? input.targetUrl,
      resourceType: input.resourceType,
    };

    let connector: CmsConnector;
    if (input.credentialId) {
      const credential = credentials.get(input.credentialId);
      if (!credential) {
        throw notFound(`credential "${input.credentialId}" not found`);
      }
      connector = createConnectorForCredential({
        credential,
        vault,
        target,
        fetchImpl,
        patchRegistry,
      });
    } else {
      connector = createCustomConnector({
        clientId: principal.organizationId ?? "platform",
        target,
        registry: patchRegistry,
        fetchImpl,
      });
    }

    connectors.register(input.targetUrl, connector);
    return connector;
  }

  function limit(key: string, cost = 1): void {
    const decision = rateLimiter.tryAcquire(key, cost);
    if (!decision.allowed) {
      throw new PlatformError({
        status: 429,
        code: "rate_limited",
        message: `rate limit exceeded for ${key}`,
        retryAfterMs: decision.retryAfterMs,
      });
    }
  }

  async function deployThrough(
    patch: FixPatch,
    principal: Principal,
    mode: { autoPilot?: boolean; approveAll?: boolean; settleMs?: number; dryRun?: boolean }
  ): Promise<PlatformResponse> {
    const connector = requireConnector(patch.targetUrl);
    limit(`cms:${new URL(patch.targetUrl).host}`, 1);

    if (mode.dryRun) {
      const result = await deployPatch(patch, { connector, dryRun: true, now: now() });
      return { status: 200, body: { deployment: result, historyId: null, snapshotId: null } };
    }

    let preSnapshot: Record<string, unknown> | null = null;
    try {
      preSnapshot = await connector.readSnapshot();
    } catch {
      preSnapshot = null;
    }

    const result = await deployPatch(patch, {
      connector,
      autoPilot: mode.autoPilot,
      approveAll: mode.approveAll,
      settleMs: mode.settleMs,
      now: now(),
    });

    let snapshotId: string | null = null;
    if (preSnapshot && result.status === "deployed") {
      snapshotId = rollbackStore.record({
        patchId: patch.patchId,
        targetUrl: patch.targetUrl,
        platform: connector.platform,
        snapshot: preSnapshot,
        reason: `pre-deploy snapshot for ${patch.patchId}`,
        now: now(),
      }).id;
    }

    const entry = history.record({
      runId: `deploy:${patch.patchId}`,
      patchId: patch.patchId,
      targetUrl: patch.targetUrl,
      platform: connector.platform,
      status: result.status === "dry_run" ? "failed" : result.status,
      actor: principal.id,
      snapshotId,
      diff: result.diff,
      applied: result.applied,
      rolledBack: result.rolledBack,
      at: now(),
    });

    auditLog.append({
      principal,
      action: result.status === "rolled_back" ? "patch.rollback" : "patch.deploy",
      targetUrl: patch.targetUrl,
      patchId: patch.patchId,
      before: { mode: mode.autoPilot ? "auto_pilot" : mode.approveAll ? "approved" : "manual" },
      after: { status: result.status, applied: result.applied },
      metadata: { deploymentId: entry.id, snapshotId, errors: result.errors },
      at: now(),
    });

    return { status: 200, body: { deployment: result, historyId: entry.id, snapshotId } };
  }

  const routes: Route[] = [
    {
      method: "GET",
      segments: ["v1", "health"],
      handler: () => ({
        status: 200,
        body: { ok: true, version, uptimeMs: Date.now() - startedAt },
      }),
    },

    /* -------- credentials -------- */
    {
      method: "GET",
      segments: ["v1", "credentials"],
      permission: "credential:read",
      handler: ({ principal }) => ({
        status: 200,
        body: {
          credentials: credentials
            .list()
            .map((credential) => redactCmsCredential(vault, credential)),
          requestedBy: principal.id,
        },
      }),
    },
    {
      method: "POST",
      segments: ["v1", "credentials"],
      permission: "credential:write",
      handler: ({ principal, body }) => {
        const input = parse(credentialCreateSchema, body, "credential") as CredentialCreateRequest;
        const credential = createCmsCredential({
          vault,
          platform: input.platform,
          label: input.label,
          meta: input.meta,
          secret: input.secret as CmsSecretPayload,
          now: now(),
        });
        credentials.put(credential);
        auditLog.append({
          principal,
          action: "credential.create",
          metadata: { credentialId: credential.id, platform: credential.platform, label: credential.label },
          at: now(),
        });
        return { status: 201, body: redactCmsCredential(vault, credential) };
      },
    },

    /* -------- connectors -------- */
    {
      method: "GET",
      segments: ["v1", "connectors"],
      permission: "connector:read",
      handler: () => ({
        status: 200,
        body: { targets: connectors.targets() },
      }),
    },
    {
      method: "POST",
      segments: ["v1", "connectors"],
      permission: "connector:write",
      handler: ({ principal, body }) => {
        const input = parse(connectorRegisterSchema, body, "connector") as ConnectorRegisterRequest;
        const connector = registerConnector(input, principal);
        auditLog.append({
          principal,
          action: "connector.register",
          targetUrl: input.targetUrl,
          after: { platform: connector.platform, credentialId: input.credentialId ?? null },
          at: now(),
        });
        return {
          status: 201,
          body: {
            targetUrl: input.targetUrl,
            platform: connector.platform,
            targets: connectors.targets(),
          },
        };
      },
    },

    /* -------- audits -------- */
    {
      method: "POST",
      segments: ["v1", "audits"],
      permission: "audit:run",
      handler: async ({ principal, body }) => {
        const input = parse(auditRequestSchema, body, "audit request") as { url: string };
        let host: string;
        try {
          host = new URL(input.url).host;
        } catch {
          throw badRequest(`"${input.url}" is not a valid URL`);
        }
        limit(`cms:${host}`);

        const response = await fetchImpl(input.url, {
          headers: { "user-agent": "SeoStudioAuditor/1.0 (+https://seo-studio-one.vercel.app)" },
        });
        if (!response.ok) {
          throw badRequest(`failed to fetch ${input.url} (HTTP ${response.status})`);
        }
        const html = await response.text();
        const report = runAudit(buildSnapshotFromHtml(html, input.url), { now: now() });

        auditLog.append({
          principal,
          action: "audit.run",
          targetUrl: input.url,
          metadata: {
            auditId: report.auditId,
            mode: report.mode,
            issues: report.summary.totalIssues,
          },
          at: now(),
        });
        return { status: 200, body: report };
      },
    },

    /* -------- patches -------- */
    {
      method: "POST",
      segments: ["v1", "patches", "preview"],
      permission: "patch:read",
      handler: ({ body }) => {
        const patch = parse(fixPatchSchema, body, "fix patch") as FixPatch;
        const triage = triagePatch(patch);
        const view: PatchPreviewResponse = {
          patchId: patch.patchId,
          triage,
          diff: previewPatchDiff(patch),
          requiresApproval: triage.requiresApproval,
        };
        return { status: 200, body: view };
      },
    },
    {
      method: "POST",
      segments: ["v1", "deployments"],
      permission: "patch:deploy",
      handler: async ({ principal, body }) => {
        const input = parse(deploySchema, body, "deployment") as {
          patch: FixPatch;
          dryRun?: boolean;
          approveAll?: boolean;
          autoPilot?: boolean;
          settleMs?: number;
        };
        const patch = input.patch;
        const triage = triagePatch(patch);

        if (input.dryRun) {
          return deployThrough(patch, principal, { dryRun: true });
        }
        if (input.autoPilot && triage.autoDeployable) {
          return deployThrough(patch, principal, { autoPilot: true, settleMs: input.settleMs });
        }
        if (input.approveAll) {
          requireRiskApproval(principal, triage.overallRisk);
          return deployThrough(patch, principal, { approveAll: true, settleMs: input.settleMs });
        }

        // Route to the operator approval queue.
        patches.put(patch);
        const approval = approvals.submit({
          patch,
          triage,
          policy: { enabled: false, maxRisk: "low" },
          now: now(),
        });
        auditLog.append({
          principal,
          action: "patch.queue",
          targetUrl: patch.targetUrl,
          patchId: patch.patchId,
          after: { approvalId: approval.id, status: approval.status },
          at: now(),
        });
        return { status: 202, body: { approval, triage } };
      },
    },

    /* -------- approvals -------- */
    {
      method: "GET",
      segments: ["v1", "approvals"],
      permission: "patch:read",
      handler: () => ({
        status: 200,
        body: { approvals: approvals.pending().map((approval) => ({ approval })) },
      }),
    },
    {
      method: "POST",
      segments: ["v1", "approvals", ":id", "approve"],
      permission: "patch:approve",
      handler: async ({ principal, params, body }) => {
        const input = parse(decisionSchema, body ?? {}, "decision") as { note?: string };
        const approval = approvals.get(params.id!);
        if (!approval) {
          throw notFound(`approval "${params.id}" not found`);
        }
        if (approval.status !== "pending") {
          throw conflict(`approval "${approval.id}" is already ${approval.status}`);
        }
        requireRiskApproval(principal, approval.triage.overallRisk);
        const patch = patches.get(approval.patchId);
        if (!patch) {
          throw notFound(`patch "${approval.patchId}" is no longer available`);
        }
        requireConnector(patch.targetUrl);

        approvals.decide(approval.id, "approved", input.note, now());
        auditLog.append({
          principal,
          action: "patch.approve",
          targetUrl: approval.targetUrl,
          patchId: approval.patchId,
          after: { approvalId: approval.id, risk: approval.triage.overallRisk, note: input.note },
          at: now(),
        });
        const deployed = await deployThrough(patch, principal, { approveAll: true });
        return deployed;
      },
    },
    {
      method: "POST",
      segments: ["v1", "approvals", ":id", "reject"],
      permission: "patch:approve",
      handler: ({ principal, params, body }) => {
        const input = parse(decisionSchema, body ?? {}, "decision") as { note?: string };
        const approval = approvals.get(params.id!);
        if (!approval) {
          throw notFound(`approval "${params.id}" not found`);
        }
        if (approval.status !== "pending") {
          throw conflict(`approval "${approval.id}" is already ${approval.status}`);
        }
        const updated = approvals.decide(approval.id, "rejected", input.note, now());
        auditLog.append({
          principal,
          action: "patch.reject",
          targetUrl: approval.targetUrl,
          patchId: approval.patchId,
          after: { approvalId: approval.id, note: input.note },
          at: now(),
        });
        return { status: 200, body: { approval: updated } };
      },
    },

    /* -------- self-healing run -------- */
    {
      method: "POST",
      segments: ["v1", "heal"],
      permission: "audit:run",
      alsoPermission: "patch:deploy",
      handler: async ({ principal, body }) => {
        const input = parse(healSchema, body, "healing request") as unknown as {
          report: AuditReport;
          autoPilot?: boolean;
          maxRisk?: AutoPilotPolicy["maxRisk"];
          approveAll?: boolean;
        };
        if (input.approveAll) {
          requireRiskApproval(principal, "high");
        }
        const connector = requireConnector(input.report.pageUrl);
        limit(`cms:${new URL(input.report.pageUrl).host}`);

        const policy: AutoPilotPolicy = {
          enabled: input.autoPilot ?? false,
          maxRisk: input.maxRisk ?? "low",
        };

        const result = await runHealingPipeline({
          report: input.report,
          connector,
          policy,
          approveAll: input.approveAll,
          events,
          queue: approvals,
          rollbackStore,
          onPatch: (patch) => void patches.put(patch),
          fetchImpl,
          now,
        });

        history.record({
          runId: result.runId,
          patchId: result.patchId,
          targetUrl: result.targetUrl,
          platform: connector.platform,
          status: result.status,
          actor: principal.id,
          snapshotId: result.snapshotId,
          diff: result.deployment?.diff ?? [],
          applied: result.deployment?.applied ?? 0,
          rolledBack: result.deployment?.rolledBack ?? false,
          at: result.startedAt,
        });

        auditLog.append({
          principal,
          action: "healing.run",
          targetUrl: result.targetUrl,
          patchId: result.patchId,
          after: { status: result.status, approval: result.approval.status },
          metadata: { runId: result.runId, maxRisk: policy.maxRisk, autoPilot: policy.enabled },
          at: now(),
        });

        return { status: result.status === "queued" ? 202 : 200, body: result };
      },
    },

    /* -------- history + undo -------- */
    {
      method: "GET",
      segments: ["v1", "history"],
      permission: "history:read",
      handler: ({ query }) => {
        const targetUrl = query.get("targetUrl");
        const entries = targetUrl ? history.forTarget(targetUrl) : history.all();
        return { status: 200, body: { entries, undoable: history.undoable().length } };
      },
    },
    {
      method: "POST",
      segments: ["v1", "history", ":id", "undo"],
      permission: "history:undo",
      handler: async ({ principal, params }) => {
        const result = await undoDeployment(params.id!, {
          history,
          rollbackStore,
          resolveConnector: (targetUrl) => connectors.resolve(targetUrl),
          auditLog,
          principal,
          now,
        });
        return { status: 200, body: result };
      },
    },

    /* -------- audit log + events -------- */
    {
      method: "GET",
      segments: ["v1", "audit-log"],
      permission: "audit-log:read",
      handler: ({ query }) => {
        if (query.get("verify") === "1") {
          return { status: 200, body: { verification: auditLog.verify() } };
        }
        return { status: 200, body: { entries: auditLog.all(), verification: auditLog.verify() } };
      },
    },
    {
      method: "GET",
      segments: ["v1", "events"],
      permission: "audit:read",
      handler: () => ({ status: 200, body: { events: events.all(), alerts: events.alerts() } }),
    },

    /* -------- schedules -------- */
    {
      method: "GET",
      segments: ["v1", "schedules"],
      permission: "schedule:read",
      handler: () => ({ status: 200, body: { schedules: scheduler.list() } }),
    },
    {
      method: "POST",
      segments: ["v1", "schedules"],
      permission: "schedule:write",
      handler: ({ principal, body }) => {
        const input = parse(scheduleCreateSchema, body, "schedule") as ScheduleCreateRequest;
        let schedule;
        try {
          schedule = scheduler.register({
            targetUrl: input.targetUrl,
            cron: input.cron,
            enabled: input.enabled,
          });
        } catch (error) {
          throw badRequest(error instanceof Error ? error.message : "invalid cron expression");
        }
        auditLog.append({
          principal,
          action: "schedule.create",
          targetUrl: input.targetUrl,
          after: { scheduleId: schedule.id, cron: schedule.cron },
          at: now(),
        });
        return { status: 201, body: { schedule } };
      },
    },
  ];

  async function handle(request: PlatformRequest): Promise<PlatformResponse> {
    try {
      const { segments, query } = splitPath(request.path);
      const matched = routes
        .filter((route) => route.method === request.method)
        .map((route) => ({ route, params: matchSegments(route.segments, segments) }))
        .find((candidate) => candidate.params !== null);

      if (!matched || !matched.params) {
        return {
          status: 404,
          body: { error: { code: "not_found", message: `no route for ${request.method} ${request.path}` } },
        };
      }

      const { route, params } = matched;
      // The health check is the only unauthenticated route.
      const needsAuth = route.segments.join("/") !== "v1/health";
      const principal = needsAuth ? authorize(request.principal, route.permission ?? "audit:read") : request.principal;
      if (route.alsoPermission) {
        authorize(request.principal, route.alsoPermission);
      }

      limit(`principal:${principal.id}`, 1);

      const response = await route.handler({
        req: request,
        principal,
        params,
        query,
        body: request.body,
      });
      await options.onRequestComplete?.();
      return response;
    } catch (error) {
      // Persist anything written before the failure, but never mask the error.
      try {
        await options.onRequestComplete?.();
      } catch {
        /* best-effort flush */
      }
      if (error instanceof PlatformError) {
        const headers: Record<string, string> = {};
        if (error.retryAfterMs !== undefined) {
          headers["Retry-After"] = String(Math.ceil(error.retryAfterMs / 1000));
        }
        return {
          status: error.status,
          headers,
          body: {
            error: {
              code: error.code,
              message: error.message,
              retryAfterMs: error.retryAfterMs,
              details: error.details,
            },
          },
        };
      }
      return {
        status: 500,
        body: {
          error: {
            code: "internal_error",
            message: error instanceof Error ? error.message : String(error),
          },
        },
      };
    }
  }

  return {
    handle,
    auditLog,
    history,
    approvals,
    patches,
    rollbackStore,
    events,
    connectors,
    credentials,
    scheduler,
    vault,
    rateLimiter,
  };
}

export { VERSION as PLATFORM_VERSION };
export type { CmsSeoPlugin };