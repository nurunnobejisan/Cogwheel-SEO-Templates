/**
 * Buyer-prompt generator.
 *
 * Prompts are hypothetical buyer questions, not keyword-volume claims. Hotel
 * mode mirrors how travellers ask AI assistants; universal mode covers any
 * product/service category. Every prompt is deterministic and deduplicated.
 */

import type { BuyerPrompt, PromptIntent, PromptSet, VisibilityMode } from "./types.ts";

export interface PromptSetInput {
  targetUrl: string;
  brand?: string;
  mode?: VisibilityMode;
  city?: string;
  category?: string;
  audience?: string;
  features?: string[];
  competitorDomains?: string[];
  maxPrompts?: number;
}

/**
 * Adds only neutral answering instructions. The buyer prompt text is never
 * rewritten and the brand is never injected — that would fabricate mentions.
 */
export function buildVisibilityPrompt(text: string, grounded: boolean): string {
  const suffix = grounded
    ? "Answer concisely. Include source links only for statements supported by the web sources you actually used; say when a source was not available."
    : "Answer concisely. If a name comes from model memory rather than a live source, say so. Do not invent URLs.";
  return `${text}\n\n${suffix}`;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "prompt";
}

function domainBrand(targetUrl: string): string {
  try {
    const host = new URL(targetUrl).hostname.replace(/^www\./, "");
    const token = host.split(".")[0] ?? "brand";
    return token.charAt(0).toUpperCase() + token.slice(1);
  } catch {
    return "brand";
  }
}

function add(
  prompts: BuyerPrompt[],
  text: string,
  intent: PromptIntent,
  brand: string
): void {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return;
  if (prompts.some((prompt) => prompt.text.toLowerCase() === normalized.toLowerCase())) return;
  prompts.push({
    id: `p${prompts.length + 1}-${slug(normalized)}`,
    text: normalized,
    intent,
    branded: brand.length > 1 && normalized.toLowerCase().includes(brand.toLowerCase()),
  });
}

export function generatePromptSet(input: PromptSetInput): PromptSet {
  const targetUrl = input.targetUrl.trim();
  const mode: VisibilityMode = input.mode === "universal" ? "universal" : "hotel";
  const brand = (input.brand?.trim() || domainBrand(targetUrl)).trim();
  const domain = (() => {
    try {
      return new URL(targetUrl).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();
  const city = input.city?.trim() || null;
  const category = input.category?.trim() || (mode === "hotel" ? "hotel" : "provider");
  const audience = input.audience?.trim() || null;
  const features = (input.features ?? []).map((feature) => feature.trim()).filter(Boolean).slice(0, 3);
  const maxPrompts = Math.min(Math.max(input.maxPrompts ?? 12, 4), 20);
  const prompts: BuyerPrompt[] = [];

  if (mode === "hotel") {
    add(prompts, `Is ${brand} a good hotel?`, "branded", brand);
    add(prompts, `${brand} reviews and guest experiences`, "branded", brand);
    add(prompts, `alternatives to ${brand}`, "comparison", brand);

    if (city) {
      add(prompts, `best boutique hotel in ${city}`, "local", brand);
      add(prompts, `best hotels in ${city} for a weekend`, "local", brand);
      add(prompts, `where to stay in ${city} for a first visit`, "local", brand);
      add(prompts, `hotel in ${city} with ${features[0] ?? "a rooftop pool"}`, "local", brand);
      add(prompts, `pet friendly hotel in ${city}`, "local", brand);
      if (audience) add(prompts, `best hotel in ${city} for ${audience}`, "local", brand);
      add(prompts, `how much does a hotel room in ${city} cost per night?`, "informational", brand);
    } else {
      add(prompts, "best boutique hotels for a weekend", "comparison", brand);
      add(prompts, "hotel with a rooftop pool", "informational", brand);
      add(prompts, "pet friendly hotels with free breakfast", "informational", brand);
      add(prompts, "how much does a hotel room cost per night?", "informational", brand);
    }

    for (const feature of features.slice(1)) {
      add(prompts, `hotel with ${feature}${city ? ` in ${city}` : ""}`, "informational", brand);
    }
    add(prompts, "what should I look for when choosing a hotel?", "informational", brand);
    add(prompts, "best hotels for a romantic weekend", "comparison", brand);
  } else {
    add(prompts, `Is ${brand} legit?`, "branded", brand);
    add(prompts, `${brand} reviews`, "branded", brand);
    add(prompts, `alternatives to ${brand}`, "comparison", brand);

    if (city) {
      add(prompts, `best ${category} in ${city}`, "local", brand);
      add(prompts, `top rated ${category} near ${city}`, "local", brand);
      add(prompts, `how much does ${category} cost in ${city}?`, "informational", brand);
    } else {
      add(prompts, `best ${category}`, "comparison", brand);
      add(prompts, `top rated ${category} near me`, "local", brand);
      add(prompts, `how much does ${category} cost?`, "informational", brand);
    }

    if (audience) add(prompts, `best ${category} for ${audience}`, "comparison", brand);
    for (const feature of features.slice(0, 2)) {
      add(prompts, `${category} with ${feature}`, "informational", brand);
    }
    add(prompts, `what should I look for when choosing ${category}?`, "informational", brand);
    add(prompts, `is ${brand} worth it?`, "branded", brand);
  }

  return {
    targetUrl,
    brand,
    domain,
    mode,
    city,
    category,
    competitorDomains: (input.competitorDomains ?? [])
      .map((value) => value.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").trim())
      .filter(Boolean),
    prompts: prompts.slice(0, maxPrompts),
    generatedAt: new Date().toISOString(),
  };
}
