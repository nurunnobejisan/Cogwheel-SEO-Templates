import { afterEach, describe, expect, it } from "vitest";
import { getActiveAiProviderLabel, isClaudeConfigured, isFreeOnlineAiEnabled } from "@/core/claude";
import { GET as aiTrainingGet } from "@/app/api/ai-training/route";

const MANAGED_KEYS = [
  "ENABLE_FREE_ONLINE_AI",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_AI_API_KEY",
  "GROQ_API_KEY",
  "OPENROUTER_API_KEY",
  "CUSTOM_MODEL_ENDPOINT",
  "CUSTOM_MODEL_ID",
  "CUSTOM_MODEL_API_KEY",
  "NODE_ENV",
] as const;

let savedEnv: Record<string, string | undefined> = {};

function setEnv(entries: Record<string, string | undefined>): void {
  for (const key of MANAGED_KEYS) {
    if (!(key in entries)) delete process.env[key];
  }
  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function snapshotEnv(): void {
  savedEnv = Object.fromEntries(MANAGED_KEYS.map((key) => [key, process.env[key]]));
}

afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  savedEnv = {};
});

describe("ENABLE_FREE_ONLINE_AI is opt-in", () => {
  it("is off unless the value is the literal string true", () => {
    snapshotEnv();
    setEnv({});
    expect(isFreeOnlineAiEnabled()).toBe(false);

    setEnv({ ENABLE_FREE_ONLINE_AI: "true" });
    expect(isFreeOnlineAiEnabled()).toBe(true);

    // Legacy values that used to enable the keyless endpoint must not.
    for (const legacy of ["1", "0", "false", "TRUE", "yes", ""]) {
      setEnv({ ENABLE_FREE_ONLINE_AI: legacy });
      expect(isFreeOnlineAiEnabled()).toBe(false);
    }
  });

  it("labels the active provider only when the fallback is really on", () => {
    snapshotEnv();
    setEnv({});
    expect(getActiveAiProviderLabel()).toBe("Not Configured");

    setEnv({ ENABLE_FREE_ONLINE_AI: "1" });
    expect(getActiveAiProviderLabel()).toBe("Not Configured");

    setEnv({ ENABLE_FREE_ONLINE_AI: "true" });
    expect(getActiveAiProviderLabel()).toBe("Free Online AI (Pollinations, keyless)");

    // A real key still wins over the keyless fallback.
    setEnv({ ENABLE_FREE_ONLINE_AI: "true", GROQ_API_KEY: "k" });
    expect(getActiveAiProviderLabel()).toContain("Groq");
  });

  it("reports configured only for real keys or an explicit opt-in outside tests", () => {
    snapshotEnv();
    setEnv({});
    expect(isClaudeConfigured()).toBe(false);

    setEnv({ ENABLE_FREE_ONLINE_AI: "true", NODE_ENV: "production" });
    expect(isClaudeConfigured()).toBe(true);

    setEnv({ ENABLE_FREE_ONLINE_AI: "1", NODE_ENV: "production" });
    expect(isClaudeConfigured()).toBe(false);

    setEnv({ ANTHROPIC_API_KEY: "k", NODE_ENV: "production" });
    expect(isClaudeConfigured()).toBe(true);
  });
});

describe("GET /api/ai-training exposes the free-online flag for the UI warning", () => {
  it("reports providerIsFreeOnline=false when the fallback is off", async () => {
    snapshotEnv();
    setEnv({});
    const res = await aiTrainingGet(new Request("http://localhost/api/ai-training"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { provider: string; providerIsFreeOnline: boolean };
    expect(body.providerIsFreeOnline).toBe(false);
    expect(body.provider).toBe("Not Configured");
  });

  it("reports providerIsFreeOnline=true only after an explicit opt-in", async () => {
    snapshotEnv();
    setEnv({ ENABLE_FREE_ONLINE_AI: "true" });
    const res = await aiTrainingGet(new Request("http://localhost/api/ai-training"));
    const body = (await res.json()) as { provider: string; providerIsFreeOnline: boolean };
    expect(body.providerIsFreeOnline).toBe(true);
    expect(body.provider).toBe("Free Online AI (Pollinations, keyless)");
  });
});
