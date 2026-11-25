/**
 * Platform Authentication Bridge (Phase 5.1)
 *
 * Maps an inbound Next.js request to a platform `Principal`.
 *
 * In production this is where JWT/session verification lives: replace
 * `principalFromRequest()` with a call to your auth provider and read the
 * subject + role claims. The development implementation reads the actor from
 * headers (or the `cw_actor_*` cookies the operator console sets) so the API is
 * usable locally before auth is wired.
 */

import type { Principal, Role } from "../../../platform/index.ts";

const ROLES: readonly Role[] = ["viewer", "specialist", "admin"];

export function isRole(value: string | undefined | null): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export interface PrincipalReader {
  header(name: string): string | null;
}

function cookie(reader: PrincipalReader, name: string): string | null {
  const raw = reader.header("cookie");
  if (!raw) {
    return null;
  }
  for (const part of raw.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

function pick(reader: PrincipalReader, headerName: string, cookieName: string): string | null {
  return reader.header(headerName) ?? cookie(reader, cookieName);
}

/** Derive the acting principal. Returns an empty id when unauthenticated. */
export function principalFromRequest(reader: PrincipalReader): Principal {
  const role = pick(reader, "x-actor-role", "cw_actor_role");
  const organizationId = pick(reader, "x-organization-id", "cw_actor_org") ?? undefined;
  return {
    id: pick(reader, "x-actor-id", "cw_actor_id") ?? "",
    role: isRole(role) ? role : "viewer",
    ...(organizationId ? { organizationId } : {}),
  };
}
