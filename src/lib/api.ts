/** Typed POST helpers for internal Next.js API routes. */

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
    body: form,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `${url} failed (${res.status})`);
  }
  return data as T;
}

