/** Typed API & fetch helpers with operator bearer token injection for internal Next.js routes. */

export const OPERATOR_TOKEN_STORAGE_KEY = "seo_studio_api_bearer_token";
const EXTENSION_SYNC_CONFIG_KEY = "seo_studio_api_sync_config";

/** Reads the operator bearer token saved in client config storage, if any. */
export function getOperatorToken(): string {
  if (typeof window === "undefined") return "";
  try {
    const sessionToken = window.sessionStorage?.getItem(OPERATOR_TOKEN_STORAGE_KEY)?.trim();
    if (sessionToken) return sessionToken;
  } catch {
    // Ignore storage restriction errors
  }
  try {
    const localToken = window.localStorage?.getItem(OPERATOR_TOKEN_STORAGE_KEY)?.trim();
    if (localToken) return localToken;
    const syncRaw = window.localStorage?.getItem(EXTENSION_SYNC_CONFIG_KEY);
    if (syncRaw) {
      const parsed = JSON.parse(syncRaw) as { bearerToken?: unknown };
      if (typeof parsed.bearerToken === "string" && parsed.bearerToken.trim()) {
        return parsed.bearerToken.trim();
      }
    }
  } catch {
    // Ignore storage restriction errors
  }
  return "";
}

/** Saves (or clears when empty) the operator bearer token in client storage. */
export function setOperatorToken(token: string): void {
  if (typeof window === "undefined") return;
  const trimmed = token.trim();
  for (const store of [window.sessionStorage, window.localStorage]) {
    try {
      if (!store) continue;
      if (trimmed) store.setItem(OPERATOR_TOKEN_STORAGE_KEY, trimmed);
      else store.removeItem(OPERATOR_TOKEN_STORAGE_KEY);
    } catch {
      // Ignore storage restriction errors
    }
  }
}

/** Returns Headers merging `Authorization: Bearer <token>` when configured. */
export function operatorAuthHeaders(initHeaders?: HeadersInit): Headers {
  const headers = new Headers(initHeaders);
  if (!headers.has("Authorization")) {
    const token = getOperatorToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }
  return headers;
}

/** Authenticated wrapper around `fetch` for internal `/api/*` requests. */
export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: operatorAuthHeaders(init.headers),
  });
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const headers = operatorAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `${url} failed (${res.status})`);
  }
  return data as T;
}

export async function postFormData<T>(url: string, form: FormData): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: operatorAuthHeaders(),
    body: form,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `${url} failed (${res.status})`);
  }
  return data as T;
}
