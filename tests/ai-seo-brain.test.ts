import { describe, it, expect } from "vitest";
import { createSnapshot, runAudit, type AuditReport } from "../rules/index.ts";
import {
  assertJsonOnly,
  buildPatchPrompt,
  buildRagQuery,
  chunkDocument,
  classifyIssueTask,
  classifyTask,
  createHashingEmbedder,
  createRagPipeline,
  generateFixPatch,
  generatePatchId,
  isAutoApplyEligible,
  isValidFixPatch,
  loadProviders,
  parseFixPatch,
  riskForField,
  routeTask,
  SEED_KNOWLEDGE,
  synthesizeMutation,
  validateFixPatch,
  validateMutation,
  type BuiltPrompt,
  type FixPatch,
  type ModelInvoker,
  type PatchMutation,
  type ProviderDescriptor,
} from "../ai/index.ts";

const NOW = "2026-01-15T10:30:00.000Z";

function buildReport(): AuditReport {
  const snapshot = createSnapshot({
    url: "https://example.com/products/widgets",
    title: "",
    metaDescription: "",
    canonical: null,
    headings: [{ level: 1, text: "Industrial Widgets" }],
    images: [
      {
        src: "https://example.com/images/industrial-widget-hero.jpg",
        alt: null,
        width: null,
        height: null,
      },
    ],
    links: [],
    wordCount: 120,
    textContent: "Short page copy.",
    jsonLd: [],
    scriptSrcs: [],
    openGraph: {},
    twitter: {},
    hasViewport: false,
    reservationWidgets: false,
  });
  return runAudit(snapshot, { auditId: "aud_test_univ", now: NOW });
}

describe("Phase 2 — Multi-model router", () => {
  it("classifies structural tasks as tier1 and semantic tasks as tier2", () => {
    expect(classifyTask("metadata_generation")).toBe("tier1");
    expect(classifyTask("alt_text_generation")).toBe("tier1");
    expect(classifyTask("schema_generation")).toBe("tier1");
    expect(classifyTask("rag_synthesis")).toBe("tier2");
    expect(classifyTask("intent_mapping")).toBe("tier2");
    expect(classifyTask("entity_gap_analysis")).toBe("tier2");
  });

  it("degrades to the deterministic synthesizer when no provider is configured", () => {
    const decision = routeTask("metadata_generation", []);
    expect(decision.tier).toBe("tier1");
    expect(decision.provider).toBeNull();
    expect(decision.rationale).toMatch(/deterministic synthesizer/);
  });

  it("prefers a configured provider on the task's tier", () => {
    const providers: ProviderDescriptor[] = [
      { id: "claude", label: "Claude", tier: "tier2", model: "claude-sonnet-4-5", configured: true },
      { id: "gemini", label: "Gemini", tier: "tier1", model: "gemini-2.0-flash", configured: true },
    ];
    expect(routeTask("metadata_generation", providers).provider?.id).toBe("gemini");
    expect(routeTask("rag_synthesis", providers).provider?.id).toBe("claude");
  });

  it("loads a provider registry from environment credentials", () => {
    const env: NodeJS.ProcessEnv = { NODE_ENV: "test", ANTHROPIC_API_KEY: "x" };
    const providers = loadProviders(env);
    const claude = providers.find((provider) => provider.id === "claude");
    expect(claude?.configured).toBe(true);
    const gemini = providers.find((provider) => provider.id === "gemini");
    expect(gemini?.configured).toBe(false);
  });
});

describe("Phase 2 — RAG knowledge base", () => {
  it("produces deterministic, unit-normalised embeddings", () => {
    const embedder = createHashingEmbedder(128);
    const a = embedder.embed("core web vitals thresholds");
    const b = embedder.embed("core web vitals thresholds");
    const c = embedder.embed("lodging business schema");
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    const norm = Math.sqrt(a.reduce((total, value) => total + value * value, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it("loads the curated corpus and retrieves relevant, ordered chunks", () => {
    const pipeline = createRagPipeline();
    expect(pipeline.size()).toBe(SEED_KNOWLEDGE.length);

    const results = pipeline.knowledgeBase.search("title tag characters truncation", {
      topK: 3,
      tags: ["title"],
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.id).toBe("kc-title-tag");
    expect(results[0]!.score).toBeGreaterThanOrEqual(results[results.length - 1]!.score);
  });

  it("filters strictly by tag", () => {
    const pipeline = createRagPipeline();
    const results = pipeline.knowledgeBase.search("anything", { topK: 10, tags: ["hospitality"] });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((chunk) => chunk.tags.includes("hospitality"))).toBe(true);
  });

  it("splits a long document into ordered, overlapping chunks", () => {
    const text = Array.from({ length: 6 }, (_, i) => `Paragraph ${i} `.repeat(40)).join("\n\n");
    const chunks = chunkDocument({ id: "doc", title: "Guide", text, source: "Test", maxChars: 400 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]!.id).toBe("doc#1");
    expect(chunks[1]!.id).toBe("doc#2");
    expect(chunks.every((chunk) => chunk.text.length <= 400)).toBe(true);
  });
});

describe("Phase 2 — Prompt construction", () => {
  it("maps issue categories to task kinds", () => {
    const report = buildReport();
    const altIssue = report.issues.find((issue) => issue.issueId === "iss_img_alt_missing")!;
    const schemaIssue = report.issues.find((issue) => issue.issueId === "iss_structured_data_missing")!;
    const metaIssue = report.issues.find((issue) => issue.issueId === "iss_meta_desc_missing")!;
    expect(classifyIssueTask(altIssue)).toBe("alt_text_generation");
    expect(classifyIssueTask(schemaIssue)).toBe("schema_generation");
    expect(classifyIssueTask(metaIssue)).toBe("metadata_generation");
  });

  it("builds a grounded prompt embedding the JSON contract and retrieved context", () => {
    const report = buildReport();
    const issue = report.issues.find((entry) => entry.issueId === "iss_meta_desc_missing")!;
    const pipeline = createRagPipeline();
    const retrieved = pipeline.knowledgeBase.search(buildRagQuery(issue, report), { topK: 2 });

    const prompt: BuiltPrompt = buildPatchPrompt({
      issue,
      report,
      retrieved,
      tier: "tier1",
      task: "metadata_generation",
    });

    expect(prompt.system).toContain("Output ONE JSON object");
    expect(prompt.user).toContain(issue.issueId);
    expect(prompt.user).toContain("meta_description");
    expect(prompt.contextIds.length).toBe(retrieved.length);
  });
});

describe("Phase 2 — Strict JSON patch validation", () => {
  const valid = (overrides: Partial<PatchMutation> = {}): PatchMutation => ({
    field: "meta_description",
    action: "replace",
    before: "",
    after: "A concise description within budget.",
    risk: "low",
    autoApply: false,
    ...overrides,
  });

  it("accepts a conformant mutation", () => {
    expect(validateMutation(valid())).toEqual([]);
  });

  it("rejects disallowed CMS fields", () => {
    expect(validateMutation(valid({ field: "password" })).join(" ")).toMatch(/not an allowed CMS target/);
  });

  it("rejects a risk tier that disagrees with the field policy", () => {
    expect(validateMutation(valid({ risk: "high" })).join(" ")).toMatch(/does not match/);
  });

  it("rejects freeform prose in values", () => {
    const prose =
      "Sure, here is the change you asked for. As an AI, I have rewritten the description for you and it reads much better now.";
    expect(validateMutation(valid({ after: prose })).join(" ")).toMatch(/freeform prose/);
  });

  it("enforces action/value consistency", () => {
    expect(validateMutation(valid({ action: "replace", after: "   " })).join(" ")).toMatch(/non-empty/);
    expect(validateMutation(valid({ action: "remove", after: "x" })).join(" ")).toMatch(/must set "after" to null/);
    expect(
      validateMutation(valid({ action: "manual_review", after: null, autoApply: true })).join(" ")
    ).toMatch(/never be auto-applied/);
  });

  it("enforces SERP length budgets", () => {
    expect(validateMutation(valid({ after: "a".repeat(200) })).join(" ")).toMatch(/SERP budget/);
  });

  it("validates a whole patch, including auditId cross-checks and risk ceiling", () => {
    const report = buildReport();
    const patch: FixPatch = {
      patchId: "ptch_test",
      auditId: report.auditId,
      targetUrl: report.pageUrl,
      mode: report.mode,
      createdAt: NOW,
      mutations: [valid()],
    };
    expect(validateFixPatch(patch, { report }).valid).toBe(true);
    expect(isValidFixPatch(patch)).toBe(true);

    const mismatched = { ...patch, auditId: "aud_other" };
    expect(validateFixPatch(mismatched, { report }).errors.join(" ")).toMatch(/does not match/);

    const risky: FixPatch = { ...patch, mutations: [valid({ field: "json_ld_schema", action: "inject", after: { "@type": "Organization" }, risk: "medium" })] };
    expect(validateFixPatch(risky, { maxRisk: "low" }).errors.join(" ")).toMatch(/above the allowed ceiling/);
  });

  it("rejects non-JSON model output at the boundary", () => {
    expect(() => assertJsonOnly("Here is your patch: {}")).toThrow(/non-JSON/);
    expect(() => assertJsonOnly("```json\n{}\n```")).toThrow(/fenced code block/);
    expect(assertJsonOnly('  {"field":"title"}  ')).toBe('{"field":"title"}');
  });

  it("exposes the operational risk tier per field", () => {
    expect(riskForField("meta_description")).toBe("low");
    expect(riskForField("json_ld_schema")).toBe("medium");
    expect(riskForField("meta_robots")).toBe("high");
    expect(riskForField("unknown_field")).toBe("high");
  });

  it("gates auto-application on low risk and auto-pilot", () => {
    expect(isAutoApplyEligible({ risk: "low", action: "replace" }, true)).toBe(true);
    expect(isAutoApplyEligible({ risk: "medium", action: "replace" }, true)).toBe(false);
    expect(isAutoApplyEligible({ risk: "low", action: "replace" }, false)).toBe(false);
  });
});

describe("Phase 2 — Deterministic synthesizer", () => {
  it("synthesizes metadata and technical fixes with correct fields", () => {
    const report = buildReport();
    const find = (id: string) => report.issues.find((issue) => issue.issueId === id)!;

    const title = synthesizeMutation({ issue: find("iss_title_missing"), report })!;
    expect(title.field).toBe("title");
    expect(title.action).toBe("replace");
    expect(String(title.after).length).toBeLessThanOrEqual(60);

    const canonical = synthesizeMutation({ issue: find("iss_canonical_missing"), report })!;
    expect(canonical.action).toBe("inject");
    expect(canonical.after).toBe(report.pageUrl);

    const viewport = synthesizeMutation({ issue: find("iss_viewport_missing"), report })!;
    expect(viewport.after).toContain("width=device-width");

    const alt = synthesizeMutation({ issue: find("iss_img_alt_missing"), report })!;
    expect(alt.field).toBe("image_alt_text");
    expect(String(alt.after)).toMatch(/Industrial Widget/i);

    const schema = synthesizeMutation({ issue: find("iss_structured_data_missing"), report })!;
    expect(schema.after).toMatchObject({ "@type": "Organization" });
  });

  it("routes unsafe issues to manual review instead of guessing", () => {
    const report = buildReport();
    const thin = report.issues.find((issue) => issue.issueId === "iss_thin_content")!;
    expect(thin.fixable).toBe(false);
    expect(synthesizeMutation({ issue: thin, report })).toBeNull();

    const noindex = synthesizeMutation({
      issue: { ...thin, issueId: "iss_noindex", fixable: true, cmsTargetField: "meta_robots" },
      report,
    })!;
    expect(noindex.action).toBe("manual_review");
    expect(noindex.after).toBeNull();
  });

  it("emits LodgingBusiness schema in Hotel Mode", () => {
    const report = buildReport();
    const hotelReport = { ...report, mode: "hotel" as const };
    const hotelSchemaIssue = {
      ...report.issues.find((issue) => issue.issueId === "iss_structured_data_missing")!,
      issueId: "iss_hotel_schema_missing",
      cmsTargetField: "json_ld_schema",
    };
    const mutation = synthesizeMutation({ issue: hotelSchemaIssue, report: hotelReport })!;
    expect(mutation.after).toMatchObject({ "@type": "LodgingBusiness" });
  });
});

describe("Phase 2 — Orchestrator", () => {
  it("generates a validated patch, deferring non-fixable issues", async () => {
    const report = buildReport();
    const result = await generateFixPatch(report, { now: NOW, autoPilot: true });

    expect(result.validation.valid).toBe(true);
    expect(result.patch.auditId).toBe(report.auditId);
    expect(result.patch.mutations.length).toBeGreaterThan(0);
    expect(isValidFixPatch(result.patch)).toBe(true);

    // Thin content is non-fixable → deferred.
    expect(result.deferred.map((entry) => entry.issue.issueId)).toContain("iss_thin_content");

    // Auto-pilot deploys low-risk mutations and queues medium/high risk.
    const meta = result.patch.mutations.find((mutation) => mutation.field === "meta_description")!;
    expect(meta.autoApply).toBe(true);
    const canonical = result.patch.mutations.find((mutation) => mutation.field === "canonical_url")!;
    expect(canonical.autoApply).toBe(false);

    // Routing decisions are recorded per task kind.
    expect(result.routeSummary.metadata_generation?.tier).toBe("tier1");
  });

  it("never auto-applies when auto-pilot is off", async () => {
    const report = buildReport();
    const result = await generateFixPatch(report, { now: NOW });
    expect(result.patch.mutations.every((mutation) => !mutation.autoApply)).toBe(true);
  });

  it("uses the configured model when available and falls back when it fails", async () => {
    const report = buildReport();

    const modelInvoker: ModelInvoker = {
      id: "test-model",
      async invoke(prompt: BuiltPrompt) {
        if (prompt.user.includes("iss_meta_desc_missing")) {
          return JSON.stringify({
            field: "meta_description",
            action: "replace",
            before: "",
            after: "Model-authored description grounded in retrieved guidance.",
            risk: "low",
          });
        }
        return "Sure! Here is your patch as prose.";
      },
    };

    const result = await generateFixPatch(report, { now: NOW, invoker: modelInvoker, autoPilot: true });
    const meta = result.patch.mutations.find((mutation) => mutation.field === "meta_description")!;
    expect(meta.after).toBe("Model-authored description grounded in retrieved guidance.");

    // Other issues fell back to the deterministic synthesizer.
    const canonical = result.patch.mutations.find((mutation) => mutation.field === "canonical_url")!;
    expect(canonical.after).toBe(report.pageUrl);
    expect(result.validation.valid).toBe(true);
  });

  it("creates deterministic patch ids", () => {
    const report = buildReport();
    expect(generatePatchId(report, NOW)).toBe(generatePatchId(report, NOW));
    expect(generatePatchId(report, NOW)).toMatch(/^ptch_/);
  });

  it("round-trips a generated patch through the strict parser", async () => {
    const report = buildReport();
    const result = await generateFixPatch(report, { now: NOW });
    const parsed = parseFixPatch(result.patch);
    expect(parsed.patchId).toBe(result.patch.patchId);
    expect(parsed.mutations.length).toBe(result.patch.mutations.length);
  });
});
