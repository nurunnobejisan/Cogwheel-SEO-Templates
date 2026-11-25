/**
 * Role-Based Access Control (Phase 5)
 *
 * Tiered organization roles from the roadmap safeguard list. The permission
 * matrix is declarative and additive, so a role's capabilities are auditable at
 * a glance:
 *
 *   Viewer     — read audits, patches, history and the audit log.
 *   Specialist — everything a Viewer can do, plus run audits, approve/deploy
 *                low/medium-risk patches, manage credentials and schedules,
 *                and one-click undo.
 *   Admin      — everything, plus approving high-risk changes.
 */

import { forbidden, unauthorized } from "./errors.ts";
import type { Permission, Principal, Role } from "./types.ts";
import type { RiskTier } from "../healing/types.ts";

const VIEWER: Permission[] = [
  "audit:read",
  "patch:read",
  "schedule:read",
  "history:read",
  "audit-log:read",
  "connector:read",
];

const SPECIALIST: Permission[] = [
  ...VIEWER,
  "audit:run",
  "patch:approve",
  "patch:deploy",
  "credential:read",
  "schedule:write",
  "history:undo",
];

const ADMIN: Permission[] = [
  ...SPECIALIST,
  "credential:write",
  "connector:write",
];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  viewer: VIEWER,
  specialist: SPECIALIST,
  admin: ADMIN,
};

/** Highest patch risk a role may approve on its own. */
const ROLE_RISK_CEILING: Record<Role, RiskTier | null> = {
  viewer: null,
  specialist: "medium",
  admin: "high",
};

const RISK_ORDER: RiskTier[] = ["low", "medium", "high"];

export function permissionsFor(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function can(principal: Principal, permission: Permission): boolean {
  return permissionsFor(principal.role).includes(permission);
}

/** Throw 401/403 unless the principal holds the permission. */
export function authorize(principal: Principal | undefined, permission: Permission): Principal {
  if (!principal || !principal.id) {
    throw unauthorized();
  }
  if (!can(principal, permission)) {
    throw forbidden(`role "${principal.role}" lacks permission "${permission}"`);
  }
  return principal;
}

/** True when the role may approve a patch at the given risk tier. */
export function canApproveRisk(principal: Principal, risk: RiskTier): boolean {
  const ceiling = ROLE_RISK_CEILING[principal.role] ?? null;
  if (!ceiling) {
    return false;
  }
  return RISK_ORDER.indexOf(risk) <= RISK_ORDER.indexOf(ceiling);
}

export function requireRiskApproval(principal: Principal, risk: RiskTier): void {
  if (!canApproveRisk(principal, risk)) {
    throw forbidden(
      `role "${principal.role}" cannot approve ${risk}-risk changes; an admin is required`
    );
  }
}

/** The risk ceiling for a role, or null when it cannot approve anything. */
export function riskCeilingFor(role: Role): RiskTier | null {
  return ROLE_RISK_CEILING[role] ?? null;
}