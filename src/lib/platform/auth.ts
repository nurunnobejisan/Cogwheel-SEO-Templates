/**
 * Platform Authentication Bridge (Phase 5.1)
 *
 * Maps an inbound Next.js request to a platform `Principal`.
 *
 * Production path: a signed session token in the `cw_session` cookie is
 * verified with HMAC-SHA256 (`session.ts`). There is no trusted-header path —
 * `x-actor-role` is ignored unless the insecure local fallback below is
 * explicitly enabled.
 *
 * Local development: with `PLATFORM_DEV_AUTH=1` (and `NODE_ENV !== production`)
 * the console's role switcher can act via the unsigned `cw_actor_*` cookies.
 * Never enable that on a public deployment.
 */

import type { Principal } from "../../../platform/index.ts";
import { devAuthEnabled, isRole, readCookie, SESSION_COOKIE, verifySessionToken } from "./session.ts";

export { isRole } from "./session.ts";

export interface PrincipalReader {
  header(name: string): string | null;
}

function devPrincipal(reader: PrincipalReader): Principal {
  const pick = (cookieName: string): string | null => readCookie(reader.header("cookie"), cookieName);
  const role = pick("cw_actor_role");
  const organizationId = pick("cw_actor_org") || undefined;
  return {
    id: pick("cw_actor_id") || "",
    role: isRole(role) ? role : "viewer",
    ...(organizationId ? { organizationId } : {}),
  };
}

/**
 * Derive the acting principal from a verified session.
 *
 * Returns an anonymous viewer (`id: ""`) when there is no valid session. Callers
 * that need a real identity must check `principal.id` — see
 * `isAuthenticatedPrincipal`.
 */
export async function principalFromRequest(reader: PrincipalReader): Promise<Principal> {
  const token = readCookie(reader.header("cookie"), SESSION_COOKIE);
  const session = await verifySessionToken(token);
  if (session) {
    return session;
  }

  if (devAuthEnabled()) {
    return devPrincipal(reader);
  }

  return { id: "", role: "viewer" };
}

/** True when the principal came from a verified session (or local dev auth). */
export function isAuthenticatedPrincipal(principal: Principal): boolean {
  return principal.id.trim().length > 0;
}