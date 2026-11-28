import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import knownSchemaTypesJson from "../schemas/known-schema-types.json";
import { gateOutput, KNOWN_SCHEMA_TYPES } from "../src/core/ai/output-gates";
import {
  generateClaudeText,
  getAdapterGateCounters,
  resetAdapterGateCounters,
} from "../src/core/claude";

const SAFE_ENDPOINT = "https://example.com/v1/chat/completions";

const ENV_KEYS = [
  "CUSTOM_MODEL_ENDPOINT",
  "CUSTOM_MODEL_ID",
  "CUSTOM_MODEL_API_KEY",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_AI_API_KEY",
  "GROQ_API_KEY",
  "OPENROUTER_API_KEY",
  "ENABLE_FREE_ONLINE_AI",
] as const;

let saved: Record<string, string | undefined> = {};

function snapshotEnv() {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
}

function setEnv(next: Record<string, string | undefined>) {
  for (const k of ENV_KEYS) delete process.env[k];
  for (const [k, v] of Object.entries(next)) {
    if (v !== undefined) process.env[k] = v;
  }
}

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as unknown as Response;
}

afterEach(() => {
  resetAdapterGateCounters();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  saved = {};
});

describe("WP3 — shared schema types and output gates", () => {
  it("loads the exact canonical schema type list shared with ml/eval/run_eval.py", () => {
    const pySource = readFileSync(path.resolve(__dirname, "../ml/eval/run_eval.py"), "utf8");
    expect(pySource).toContain("known-schema-types.json");
    expect(KNOWN_SCHEMA_TYPES.size).toBe(knownSchemaTypesJson.length);
    expect(KNOWN_SCHEMA_TYPES.has("Hotel")).toBe(true);
    expect(KNOWN_SCHEMA_TYPES.has("FAQPage")).toBe(true);
  });

  it("validates schema_generation outputs and rejects bad types or invented contact/price details", () => {
    const input = "Property: The Curtis Denver. City: Denver, CO. Address: 1405 Curtis St. Phone: 303-571-0300. Price: $199.";
    const valid = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Hotel",
      name: "The Curtis Denver",
      telephone: "303-571-0300",
      address: {
        "@type": "PostalAddress",
        streetAddress: "1405 Curtis St",
        addressLocality: "Denver",
      },
      priceRange: "$199",
    });
    expect(gateOutput("schema_generation", valid, input)).toEqual({ ok: true, failures: [] });

    expect(gateOutput("schema_generation", "not json {{{", input)).toEqual({
      ok: false,
      failures: ["invalid_json"],
    });

    const badType = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "MagicHotel",
      name: "The Curtis Denver",
    });
    const typeRes = gateOutput("schema_generation", badType, input);
    expect(typeRes.ok).toBe(false);
    expect(typeRes.failures).toContain("unknown_schema_type:MagicHotel");

    const inventedDetails = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Hotel",
      name: "The Curtis Denver",
      telephone: "555-867-5309",
      address: {
        "@type": "PostalAddress",
        streetAddress: "999 Invented Blvd",
      },
      priceRange: "$999",
    });
    const invRes = gateOutput("schema_generation", inventedDetails, input);
    expect(invRes.ok).toBe(false);
    expect(invRes.failures).toContain("invented_phone");
    expect(invRes.failures).toContain("invented_address:streetAddress");
    expect(invRes.failures).toContain("invented_price");
  });

  it("validates metadata_generation SERP budgets and brand requirements", () => {
    const input = { prompt: 'Property JSON: {"brand":"Hilton"}', brand: "Hilton" };
    const good = JSON.stringify({
      rows: [
        {
          url: "https://example.com/",
          proposedTitle: "Hilton Downtown Suites — Book Direct",
          proposedMeta: "Enjoy suites and dining at Hilton Downtown. Book direct today for member rates.",
        },
      ],
    });
    expect(gateOutput("metadata_generation", good, input)).toEqual({ ok: true, failures: [] });

    const tooWideAndNoBrand = JSON.stringify({
      title: "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
      metaDescription: "Too long ".repeat(30),
    });
    const badRes = gateOutput("metadata_generation", tooWideAndNoBrand, input);
    expect(badRes.ok).toBe(false);
    expect(badRes.failures).toContain("title_budget_exceeded");
    expect(badRes.failures).toContain("description_budget_exceeded");
    expect(badRes.failures).toContain("missing_brand");
  });

  it("retries once on the free chain when adapter fails its gate and never logs prompts or outputs", async () => {
    snapshotEnv();
    setEnv({
      CUSTOM_MODEL_ENDPOINT: SAFE_ENDPOINT,
      CUSTOM_MODEL_ID: "seo-studio-tuned-v1",
      GROQ_API_KEY: "groq-test-key",
    });

    const secretPrompt = "SECRET_PROMPT_MARKER_DO_NOT_LOG";
    const secretAdapterBad = '{"@context":"https://schema.org","@type":"InvalidHallucinatedType","note":"SECRET_ADAPTER_OUT"}';
    const goodFallback = '{"@context":"https://schema.org","@type":"Hotel","name":"Grand Hotel"}';

    const fetchMock = vi.fn(async (url: unknown) => {
      if (String(url) === SAFE_ENDPOINT) {
        return jsonResponse({ choices: [{ message: { content: secretAdapterBad } }] });
      }
      return jsonResponse({ choices: [{ message: { content: goodFallback } }] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const out = await generateClaudeText({
      system: "SYS",
      prompt: secretPrompt,
      task: "schema_generation",
    });

    expect(out).toBe(goodFallback);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(SAFE_ENDPOINT);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("api.groq.com");

    const counters = getAdapterGateCounters();
    expect(counters["schema_generation|seo-studio-tuned:seo-studio-tuned-v1|fail"]).toBe(1);
    expect(
      counters["schema_generation|seo-studio-tuned:seo-studio-tuned-v1|code:unknown_schema_type:InvalidHallucinatedType"],
    ).toBe(1);

    const allLogs = [
      ...logSpy.mock.calls.flat(),
      ...warnSpy.mock.calls.flat(),
      ...errSpy.mock.calls.flat(),
    ].join(" ");
    expect(allLogs).not.toContain(secretPrompt);
    expect(allLogs).not.toContain("SECRET_ADAPTER_OUT");
  });

  it("passes adapter output directly when gate succeeds", async () => {
    snapshotEnv();
    setEnv({
      CUSTOM_MODEL_ENDPOINT: SAFE_ENDPOINT,
      CUSTOM_MODEL_ID: "seo-studio-tuned-v1",
      GROQ_API_KEY: "groq-test-key",
    });

    const validSchema = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Hotel",
      name: "Ocean Resort",
    });

    const fetchMock = vi.fn(async () =>
      jsonResponse({ choices: [{ message: { content: validSchema } }] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const out = await generateClaudeText({
      system: "SYS",
      prompt: "Property: Ocean Resort",
      task: "schema_generation",
    });
    expect(out).toBe(validSchema);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const counters = getAdapterGateCounters();
    expect(counters["schema_generation|seo-studio-tuned:seo-studio-tuned-v1|pass"]).toBe(1);
  });
});
