import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { formatTrainingContext } from "@/core/training";
import { modelFor } from "@/core/ai/models";
import {
  callCustomModel,
  getCustomModelSettings,
  isCustomModelConfigured,
} from "@/core/ai/custom-model";
import {
  computeCanaryBucket,
  getAdapterCanaryPct,
  getAdapterMode,
  shouldRouteCanary,
  type AdapterMode,
} from "@/core/ai/adapter-mode";
import { gateOutput } from "@/core/ai/output-gates";
import { classifyTask, V1_ADAPTER_TASKS } from "../../ai/router";
import type { TaskKind } from "../../ai/types";

export {
  V1_ADAPTER_TASKS,
  computeCanaryBucket,
  getAdapterCanaryPct,
  getAdapterMode,
  shouldRouteCanary,
  type AdapterMode,
};

export interface AdapterLatencySummary {
  count: number;
  totalMs: number;
  lastMs: number;
}

const gateCounters = new Map<string, number>();
const adapterLatencies = new Map<string, AdapterLatencySummary>();

function incrementGateCounter(key: string): void {
  gateCounters.set(key, (gateCounters.get(key) ?? 0) + 1);
}

function recordLatencyMetric(key: string, durationMs: number): void {
  const safeMs = Math.max(0, Math.round(durationMs));
  const prev = adapterLatencies.get(key) ?? { count: 0, totalMs: 0, lastMs: 0 };
  adapterLatencies.set(key, {
    count: prev.count + 1,
    totalMs: prev.totalMs + safeMs,
    lastMs: safeMs,
  });
}

export function getAdapterGateCounters(): Record<string, number> {
  return Object.fromEntries(gateCounters.entries());
}

export function getAdapterLatencyStats(): Record<string, AdapterLatencySummary> {
  return Object.fromEntries(
    Array.from(adapterLatencies.entries(), ([k, v]) => [k, { ...v }]),
  );
}

export function resetAdapterGateCounters(): void {
  gateCounters.clear();
  adapterLatencies.clear();
}

function recordGateCounters(
  task: TaskKind,
  provider: string,
  failures: readonly string[],
): void {
  if (failures.length === 0) {
    incrementGateCounter(`${task}|${provider}|pass`);
    return;
  }
  incrementGateCounter(`${task}|${provider}|fail`);
  for (const code of failures) {
    incrementGateCounter(`${task}|${provider}|code:${code}`);
  }
}

/** Pinned temperature for all grounded SEO/GEO drafting calls. */
export const CLAUDE_TEMPERATURE = 0.2 as const;

/**
 * Default model for the paid Anthropic path. Only reached when
 * ANTHROPIC_API_KEY is set; otherwise the client walks the configured free
 * providers, and the keyless online fallback only when
 * ENABLE_FREE_ONLINE_AI=true. See `src/core/ai/models.ts` — override with
 * ANTHROPIC_MODEL.
 */
export const DEFAULT_CLAUDE_MODEL = modelFor("anthropic");

let client: Anthropic | null = null;

/**
 * Keyless Pollinations fallback is strictly opt-in. Anything other than the
 * literal string "true" (including `1`, `0`, `false` or unset) leaves it off,
 * so an accidental value can never route SEO Studio traffic to an unvetted
 * free endpoint.
 */
export function isFreeOnlineAiEnabled(): boolean {
  return process.env.ENABLE_FREE_ONLINE_AI === "true";
}

export function getActiveAiProviderLabel(): string {
  if (isCustomModelConfigured()) {
    const mode = getAdapterMode();
    const { model } = getCustomModelSettings();
    if (mode === "on") {
      return `SEO Studio fine-tuned (${model})`;
    }
    if (mode === "canary") {
      const pct = getAdapterCanaryPct();
      if (pct > 0) {
        return `SEO Studio fine-tuned (${model}, canary ${pct}%)`;
      }
    }
  }
  if (process.env.ANTHROPIC_API_KEY) return `Claude (${DEFAULT_CLAUDE_MODEL})`;
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY) return `Gemini (${modelFor("gemini")}) — free tier`;
  if (process.env.GROQ_API_KEY) return `Groq (${modelFor("groq")}) — free`;
  if (process.env.OPENROUTER_API_KEY) return `OpenRouter (${modelFor("openrouter")}) — free`;
  if (isFreeOnlineAiEnabled()) return `Free Online AI (Pollinations, keyless)`;
  return "Not Configured";
}

export function isClaudeConfigured(): boolean {
  const mode = getAdapterMode();
  const adapterServing =
    isCustomModelConfigured() &&
    (mode === "on" || (mode === "canary" && getAdapterCanaryPct() > 0));
  if (
    adapterServing ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GROQ_API_KEY ||
    process.env.OPENROUTER_API_KEY
  ) {
    return true;
  }
  return isFreeOnlineAiEnabled() && process.env.NODE_ENV !== "test";
}

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

async function callGeminiFree(system: string, prompt: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const model = modelFor("gemini");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: CLAUDE_TEMPERATURE,
          maxOutputTokens: maxTokens,
        },
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Gemini HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error("Gemini returned empty response");
  return text;
}

async function callOpenAiCompatible(opts: {
  endpoint: string;
  apiKey?: string;
  model: string;
  system: string;
  prompt: string;
  maxTokens: number;
}): Promise<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.apiKey) headers.Authorization = `Bearer ${opts.apiKey}`;

  const res = await fetch(opts.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: opts.model,
      temperature: CLAUDE_TEMPERATURE,
      max_tokens: opts.maxTokens,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.prompt },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`AI endpoint HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("AI endpoint returned empty response");
  return text;
}

interface StandardChainParams {
  fullSystem: string;
  prompt: string;
  maxTokens: number;
  errors: string[];
}

async function callStandardProviderChain(params: StandardChainParams): Promise<string> {
  const { fullSystem, prompt, maxTokens, errors } = params;

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const res = await getClient().messages.create({
        model: DEFAULT_CLAUDE_MODEL,
        max_tokens: maxTokens,
        temperature: CLAUDE_TEMPERATURE,
        system: fullSystem,
        messages: [{ role: "user", content: prompt }],
      });
      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      if (text) return text;
    } catch (err) {
      errors.push(`Anthropic: ${(err as Error).message}`);
    }
  }

  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY) {
    try {
      return await callGeminiFree(fullSystem, prompt, maxTokens);
    } catch (err) {
      errors.push(`Gemini: ${(err as Error).message}`);
    }
  }

  if (process.env.GROQ_API_KEY) {
    try {
      return await callOpenAiCompatible({
        endpoint: "https://api.groq.com/openai/v1/chat/completions",
        apiKey: process.env.GROQ_API_KEY,
        model: modelFor("groq"),
        system: fullSystem,
        prompt,
        maxTokens,
      });
    } catch (err) {
      errors.push(`Groq: ${(err as Error).message}`);
    }
  }

  if (process.env.OPENROUTER_API_KEY) {
    try {
      return await callOpenAiCompatible({
        endpoint: "https://openrouter.ai/api/v1/chat/completions",
        apiKey: process.env.OPENROUTER_API_KEY,
        model: modelFor("openrouter"),
        system: fullSystem,
        prompt,
        maxTokens,
      });
    } catch (err) {
      errors.push(`OpenRouter: ${(err as Error).message}`);
    }
  }

  if (isFreeOnlineAiEnabled()) {
    try {
      return await callOpenAiCompatible({
        endpoint: "https://text.pollinations.ai/openai",
        model: modelFor("pollinations"),
        system: fullSystem,
        prompt,
        maxTokens,
      });
    } catch (err) {
      errors.push(`FreeOnlineAI: ${(err as Error).message}`);
    }
  }

  throw new Error(`All online AI providers failed: ${errors.join(" | ") || "none configured"}`);
}

async function tryAdapterForV1Task(opts: {
  task: TaskKind;
  modeLabel: AdapterMode;
  fullSystem: string;
  prompt: string;
  maxTokens: number;
  brand?: string;
  errors: string[];
}): Promise<string | null> {
  const { model } = getCustomModelSettings();
  const providerName = `seo-studio-tuned:${model}`;
  const startMs = Date.now();
  try {
    const adapterText = await callCustomModel({
      system: opts.fullSystem,
      prompt: opts.prompt,
      maxTokens: opts.maxTokens,
    });
    recordLatencyMetric(`${opts.task}|${opts.modeLabel}|adapter`, Date.now() - startMs);
    const gate = gateOutput(opts.task, adapterText, {
      prompt: opts.prompt,
      brand: opts.brand,
    });
    recordGateCounters(opts.task, providerName, gate.failures);
    if (opts.modeLabel === "shadow") {
      incrementGateCounter(`${opts.task}|shadow|adapter:${gate.ok ? "pass" : "fail"}`);
    }
    if (gate.ok) {
      return adapterText;
    }
    opts.errors.push(`Fine-tuned (${model}) gate failed: ${gate.failures.join(", ")}`);
    return null;
  } catch (err) {
    recordLatencyMetric(`${opts.task}|${opts.modeLabel}|adapter`, Date.now() - startMs);
    recordGateCounters(opts.task, providerName, ["transport_error"]);
    if (opts.modeLabel === "shadow") {
      incrementGateCounter(`${opts.task}|shadow|adapter:transport_error`);
    }
    opts.errors.push(`Fine-tuned (${model}): ${(err as Error).message}`);
    return null;
  }
}

/**
 * Shared multi-provider AI drafting client. The keyless online fallback only
 * runs when ENABLE_FREE_ONLINE_AI=true (opt-in). Temperature is pinned to 0.2
 * and active AI training rules are always injected.
 */
export async function generateClaudeText(opts: {
  system: string;
  prompt: string;
  maxTokens?: number;
  taskId?: string;
  task?: TaskKind;
  brand?: string;
  propertyId?: string;
  requestId?: string;
}): Promise<string> {
  const trainingAppendix = await formatTrainingContext(opts.taskId);
  const fullSystem = `${opts.system}${trainingAppendix}`;
  const maxTokens = opts.maxTokens ?? 2048;
  const errors: string[] = [];

  // WP2, WP3 & WP5 — the v1 adapter only handles allow-listed Tier 1 tasks
  // (`schema_generation`, `metadata_generation`) when `AI_ADAPTER_MODE` enables it
  // (`off | shadow | canary | on`, default `off`).
  const mode = getAdapterMode();
  const isV1Eligible =
    opts.task !== undefined &&
    V1_ADAPTER_TASKS.includes(opts.task) &&
    classifyTask(opts.task) === "tier1";
  const adapterAvailable =
    isV1Eligible && mode !== "off" && isCustomModelConfigured();

  if (!adapterAvailable || !opts.task) {
    return callStandardProviderChain({ fullSystem, prompt: opts.prompt, maxTokens, errors });
  }

  const task = opts.task;
  if (mode === "shadow") {
    const stdErrors: string[] = [];
    const stdStart = Date.now();
    const [, stdResult] = await Promise.allSettled([
      tryAdapterForV1Task({
        task,
        modeLabel: "shadow",
        fullSystem,
        prompt: opts.prompt,
        maxTokens,
        brand: opts.brand,
        errors: [],
      }),
      callStandardProviderChain({
        fullSystem,
        prompt: opts.prompt,
        maxTokens,
        errors: stdErrors,
      }),
    ]);
    recordLatencyMetric(`${task}|shadow|standard`, Date.now() - stdStart);
    if (stdResult.status === "rejected") {
      incrementGateCounter(`${task}|shadow|standard:error`);
      throw stdResult.reason;
    }
    const stdGate = gateOutput(task, stdResult.value, {
      prompt: opts.prompt,
      brand: opts.brand,
    });
    incrementGateCounter(`${task}|shadow|standard:${stdGate.ok ? "pass" : "fail"}`);
    return stdResult.value;
  }

  if (mode === "canary") {
    const canaryPct = getAdapterCanaryPct();
    const seed = opts.propertyId || opts.requestId || "anonymous";
    const selected = shouldRouteCanary(seed, canaryPct);
    incrementGateCounter(`${task}|canary|routed:${selected ? "adapter" : "standard"}`);
    if (!selected) {
      return callStandardProviderChain({ fullSystem, prompt: opts.prompt, maxTokens, errors });
    }
  }

  const adapterText = await tryAdapterForV1Task({
    task,
    modeLabel: mode,
    fullSystem,
    prompt: opts.prompt,
    maxTokens,
    brand: opts.brand,
    errors,
  });
  if (adapterText !== null) {
    return adapterText;
  }

  return callStandardProviderChain({ fullSystem, prompt: opts.prompt, maxTokens, errors });
}
