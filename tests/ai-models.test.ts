import { describe, expect, it } from "vitest";
import {
  freeProviderOrder,
  isFreeProvider,
  modelFor,
  resolveProviderModels,
} from "../src/core/ai/models";

describe("resolveProviderModels", () => {
  it("defaults to current model ids and marks the free providers", () => {
    const providers = resolveProviderModels({} as NodeJS.ProcessEnv);
    const byId = Object.fromEntries(providers.map((p) => [p.id, p]));
    expect(byId.gemini!.model).toBe("gemini-3.8-flash");
    expect(byId.gemini!.free).toBe(true);
    expect(byId.groq!.free).toBe(true);
    expect(byId.openrouter!.free).toBe(true);
    expect(byId.pollinations!.free).toBe(true);
    expect(byId.pollinations!.requires).toEqual([]);
    expect(byId.anthropic!.free).toBe(false);
  });

  it("honours env overrides without a code change", () => {
    const providers = resolveProviderModels({
      GEMINI_MODEL: "gemini-experimental",
      ANTHROPIC_MODEL: "claude-opus-5-5",
    } as unknown as NodeJS.ProcessEnv);
    const byId = Object.fromEntries(providers.map((p) => [p.id, p]));
    expect(byId.gemini!.model).toBe("gemini-experimental");
    expect(byId.anthropic!.model).toBe("claude-opus-5-5");
  });
});

describe("free-first helpers", () => {
  it("never requires a paid provider to be present", () => {
    const free = freeProviderOrder({} as NodeJS.ProcessEnv);
    expect(free).toEqual(["gemini", "groq", "openrouter", "pollinations"]);
    expect(free).not.toContain("anthropic");
  });

  it("reports provider freeness and resolves a single model", () => {
    expect(isFreeProvider("pollinations")).toBe(true);
    expect(isFreeProvider("anthropic")).toBe(false);
    expect(modelFor("pollinations", {} as NodeJS.ProcessEnv)).toBe("openai");
  });
});
