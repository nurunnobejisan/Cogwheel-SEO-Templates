import { describe, expect, it } from "vitest";
import { OUTCOMES_API_BASE, createPlatformClient } from "../src/lib/platform/client";

function mockFetch(payload: unknown) {
  const calls: Array<{ url: string; method?: string; body?: unknown }> = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({
      url: String(url),
      method: init?.method,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    });
    return { ok: true, status: 200, statusText: "OK", text: async () => JSON.stringify(payload) } as unknown as Response;
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe("outcomes client", () => {
  it("reads the outcome log over GET", async () => {
    const { fetchImpl, calls } = mockFetch({ success: true, changes: [], outcomes: [], counts: {} });
    const client = createPlatformClient({ fetchImpl });
    await client.outcomes();
    expect(calls[0]).toMatchObject({ url: OUTCOMES_API_BASE, method: "GET" });
    expect(calls[0]!.body).toBeUndefined();
  });

  it("records, measures and judges with the right action", async () => {
    const { fetchImpl, calls } = mockFetch({ success: true, report: { kinds: [] } });
    const client = createPlatformClient({ fetchImpl });

    await client.recordOutcome({ pageUrl: "https://example.com/rooms", kind: "deployment" });
    await client.measureOutcomes("chg_1");
    await client.measureOutcomes();
    await client.judge();

    expect(calls[0]).toMatchObject({ url: OUTCOMES_API_BASE, method: "POST" });
    expect(calls[0]!.body).toMatchObject({ action: "record", pageUrl: "https://example.com/rooms", kind: "deployment" });
    expect(calls[1]!.body).toMatchObject({ action: "measure", changeId: "chg_1" });
    expect(calls[2]!.body).toMatchObject({ action: "measure" });
    expect(calls[3]!.body).toMatchObject({ action: "judge" });
  });
});
