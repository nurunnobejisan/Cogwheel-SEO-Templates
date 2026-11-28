/**
 * SEO & GEO Studio - Custom Fine-Tuned Model Inference Client
 *
 * Provides a unified inference client routing Auto-Fix and GEO Summary requests
 * to user-configured fine-tuned models (e.g., Google Vertex AI / tuned Gemini models,
 * custom REST endpoints, or open-weight LoRA servers) with seamless, zero-latency
 * automatic fallback to SEO Studio's deterministic rules engine.
 */

import { encryptSecret, decryptSecret } from "../../shared/ts/secureStorage.ts";

export interface CustomModelConfig {
  enabled: boolean;
  provider: "tuned_gemini" | "custom_rest" | "open_weight";
  endpointId: string; // e.g. "tunedModels/hotel-seo-v1" or "https://api.myhotelapp.com/v1/generate"
  apiKey: string; // Google AI Studio / Gemini API Key or Bearer Token
  temperature: number;
  maxTokens: number;
  fallbackToDefault: boolean;
  lastTestedAt?: string;
  lastTestStatus?: "success" | "failed";
  lastTestLatencyMs?: number;
}

export const DEFAULT_CUSTOM_MODEL_CONFIG: CustomModelConfig = {
  enabled: false,
  provider: "tuned_gemini",
  endpointId: "",
  apiKey: "",
  temperature: 0.2,
  maxTokens: 1024,
  fallbackToDefault: true,
};

export const STORAGE_KEY_CUSTOM_MODEL = "cogwheel_custom_model_config";

// In-memory fallback for headless or test environments
let inMemoryConfig: CustomModelConfig = { ...DEFAULT_CUSTOM_MODEL_CONFIG };

/**
 * Loads the active custom model inference configuration.
 */
export async function getCustomModelConfig(): Promise<CustomModelConfig> {
  // 1. Chrome extension storage
  if (typeof chrome !== "undefined" && chrome.storage?.local?.get) {
    try {
      const res = await new Promise<Record<string, unknown>>((resolve) => {
        chrome.storage.local.get([STORAGE_KEY_CUSTOM_MODEL], (items) => {
          resolve(items || {});
        });
      });
      if (res[STORAGE_KEY_CUSTOM_MODEL]) {
        const stored = { ...DEFAULT_CUSTOM_MODEL_CONFIG, ...(res[STORAGE_KEY_CUSTOM_MODEL] as Partial<CustomModelConfig>) };
        if (stored.apiKey) stored.apiKey = await decryptSecret(stored.apiKey);
        return stored;
      }
    } catch {
      // Fall through to localStorage
    }
  }

  // 2. Browser localStorage
  if (typeof localStorage !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CUSTOM_MODEL);
      if (stored) {
        const parsed = { ...DEFAULT_CUSTOM_MODEL_CONFIG, ...JSON.parse(stored) };
        if (parsed.apiKey) parsed.apiKey = await decryptSecret(parsed.apiKey);
        return parsed;
      }
    } catch {
      // Fall through to in-memory
    }
  }

  // 3. In-memory
  return { ...inMemoryConfig };
}

/**
 * Persists the custom model inference configuration.
 */
export async function saveCustomModelConfig(config: CustomModelConfig): Promise<void> {
  inMemoryConfig = { ...config };

  if (typeof chrome !== "undefined" && chrome.storage?.local?.set) {
    try {
      const toStore = { ...config, apiKey: await encryptSecret(config.apiKey) };
      await new Promise<void>((resolve) => {
        chrome.storage.local.set({ [STORAGE_KEY_CUSTOM_MODEL]: toStore }, () => {
          resolve();
        });
      });
    } catch {
      // Fall through to localStorage
    }
  }

  if (typeof localStorage !== "undefined") {
    try {
      const toStore = { ...config, apiKey: await encryptSecret(config.apiKey) };
      localStorage.setItem(STORAGE_KEY_CUSTOM_MODEL, JSON.stringify(toStore));
    } catch {
      // Storage quota or disabled
    }
  }
}

/**
 * Test response structure for connection verification.
 */
export interface ModelConnectionTestResult {
  success: boolean;
  latencyMs: number;
  message: string;
  endpoint: string;
  provider: string;
  sampleOutput?: string;
  error?: string;
}

/**
 * Tests connection to the configured custom model endpoint.
 */
export async function testCustomModelConnection(
  config: CustomModelConfig,
  fetchFn: typeof fetch = fetch
): Promise<ModelConnectionTestResult> {
  const start = Date.now();
  const endpoint = (config.endpointId || "").trim();

  if (!endpoint) {
    return {
      success: false,
      latencyMs: 0,
      message: "Endpoint ID or URL is required.",
      endpoint: "",
      provider: config.provider,
      error: "Missing endpointId",
    };
  }

  try {
    let url = endpoint;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    let requestBody: Record<string, unknown>;

    if (config.provider === "tuned_gemini") {
      // If endpoint is a model name (e.g. tunedModels/hospitality-v1 or models/gemini-1.5-flash)
      if (!endpoint.startsWith("http://") && !endpoint.startsWith("https://")) {
        url = `https://generativelanguage.googleapis.com/v1beta/${endpoint}:generateContent`;
      }
      if (config.apiKey) {
        headers["x-goog-api-key"] = config.apiKey.trim();
      }

      requestBody = {
        contents: [
          {
            role: "user",
            parts: [
              {
                text: "Ping test: Verify hospitality SEO model operational readiness.",
              },
            ],
          },
        ],
        generationConfig: {
          temperature: config.temperature ?? 0.1,
          maxOutputTokens: 64,
        },
      };
    } else {
      // Custom REST / LoRA endpoint
      if (config.apiKey) {
        headers["Authorization"] = `Bearer ${config.apiKey.trim()}`;
      }
      requestBody = {
        prompt: "Ping test: Verify hospitality SEO model operational readiness.",
        model: endpoint,
        max_tokens: 64,
        temperature: config.temperature ?? 0.1,
      };
    }

    const response = await fetchFn(url, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });

    const latencyMs = Date.now() - start;

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      let sampleOutput = "Operational";
      if (data && typeof data === "object") {
        if ("candidates" in data && Array.isArray(data.candidates)) {
          sampleOutput =
            data.candidates[0]?.content?.parts?.[0]?.text?.trim() || "Operational";
        } else if ("text" in data && typeof data.text === "string") {
          sampleOutput = data.text.trim();
        } else if ("choices" in data && Array.isArray(data.choices)) {
          sampleOutput =
            data.choices[0]?.message?.content?.trim() || "Operational";
        }
      }

      const updatedConfig: CustomModelConfig = {
        ...config,
        lastTestedAt: new Date().toISOString(),
        lastTestStatus: "success",
        lastTestLatencyMs: latencyMs,
      };
      await saveCustomModelConfig(updatedConfig);

      return {
        success: true,
        latencyMs,
        message: `Successfully connected to ${config.provider} model in ${latencyMs}ms.`,
        endpoint,
        provider: config.provider,
        sampleOutput: sampleOutput.slice(0, 150),
      };
    } else {
      const errText = await response.text().catch(() => "");
      return {
        success: false,
        latencyMs,
        message: `Endpoint returned HTTP ${response.status}: ${errText.slice(0, 150)}`,
        endpoint,
        provider: config.provider,
        error: errText,
      };
    }
  } catch (err) {
    const latencyMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      latencyMs,
      message: `Network failure connecting to model: ${msg}`,
      endpoint,
      provider: config.provider,
      error: msg,
    };
  }
}

// ==============================================================================
// INFERENCE INTERFACES & AUTO-FIX ROUTING
// ==============================================================================

export interface AutoFixInferenceResult {
  source: "custom_tuned_model" | "default_rules_engine";
  issueId: string;
  issueTitle: string;
  issueCategory: string;
  description: string;
  codeSnippet: string;
  language: "html" | "json";
  optimalTitle?: string;
  optimalMeta?: string;
  optimalH1?: string;
  canonicalUrl?: string;
  latencyMs?: number;
  modelIdentifier?: string;
}

export interface GeoSummaryInferenceResult {
  source: "custom_tuned_model" | "default_rules_engine";
  geoSummary: string;
  faqSchema?: Record<string, unknown>;
  latencyMs?: number;
  modelIdentifier?: string;
}

/**
 * Standard deterministic rules fallback for Auto-Fix actions.
 */
function getDefaultAutoFix(
  issueId: string,
  hotelName: string,
  brand: string,
  canonicalUrl: string
): AutoFixInferenceResult {
  // Sourced values only: every suggestion below is composed from the caller's
  // property name / brand / canonical URL. When a value has no source the
  // result stays blank and the caller reports it ("no suggestion was
  // produced") — amenity, policy, rating, price or location claims are never
  // drafted here.
  const brandSuffix =
    brand === "Marriott"
      ? " | Marriott Bonvoy"
      : brand === "Hilton"
      ? " | Hilton Honors"
      : brand === "IHG"
      ? " - IHG Hotel"
      : brand === "Hyatt"
      ? " | World of Hyatt"
      : "";

  const noSuggestion = (issueTitle: string, issueCategory: string, why: string): AutoFixInferenceResult => ({
    source: "default_rules_engine",
    issueId,
    issueTitle,
    issueCategory,
    description: why,
    codeSnippet: "",
    language: "html",
  });

  if (issueId === "title-len") {
    if (!hotelName) {
      return noSuggestion(
        "Title Length Optimization",
        "Title length",
        "No property name source — no title suggestion was produced, the page title was left unchanged."
      );
    }
    const optimalTitle = `${hotelName.slice(0, 58 - brandSuffix.length)}${brandSuffix}`;
    return {
      source: "default_rules_engine",
      issueId,
      issueTitle: "Title Length Optimization Applied",
      issueCategory: "Title length",
      description:
        "Consolidated the property name within the 580px Google SERP ceiling using the profile brand suffix.",
      codeSnippet: `<title>${optimalTitle}</title>`,
      language: "html",
      optimalTitle,
    };
  }

  if (issueId === "meta-len") {
    // A meta description is descriptive copy — the rules engine has no
    // verified source for it, so it never drafts one.
    return noSuggestion(
      "Meta Description Optimization",
      "Meta description",
      "No verified descriptive copy source — no meta description suggestion was produced, the page meta description was left unchanged. Connect an AI provider to draft one."
    );
  }

  if (issueId === "canonical-h1") {
    if (!canonicalUrl && !hotelName) {
      return noSuggestion(
        "Canonical URL & H1 Hierarchy",
        "Canonical/H1",
        "No canonical URL or property name source — the page canonical and headings were left unchanged."
      );
    }
    const snippetParts: string[] = [];
    if (canonicalUrl) {
      snippetParts.push(
        `<!-- Self-Referencing Canonical Tag -->\n<link rel="canonical" href="${canonicalUrl}" />`
      );
    }
    if (hotelName) {
      snippetParts.push(
        `<!-- Single Primary H1 Heading Tag -->\n<h1 class="hotel-primary-headline">${hotelName}</h1>`
      );
    }
    return {
      source: "default_rules_engine",
      issueId,
      issueTitle: "Canonical URL & H1 Hierarchy Applied",
      issueCategory: "Canonical/H1",
      description:
        "Enforced self-referencing canonical URL and single primary H1 heading from the page's own URL and property name.",
      codeSnippet: snippetParts.join("\n\n"),
      language: "html",
      ...(canonicalUrl ? { canonicalUrl } : {}),
      ...(hotelName ? { optimalH1: hotelName } : {}),
    };
  }

  if (issueId === "hotel-schema") {
    if (!hotelName) {
      return noSuggestion(
        "Hotel Schema Markup",
        "Missing JSON-LD Schema",
        "No property name source — no schema was drafted, the page markup was left unchanged."
      );
    }
    const schema = {
      "@context": "https://schema.org",
      "@type": "Hotel",
      name: hotelName,
      ...(canonicalUrl ? { url: canonicalUrl } : {}),
    };
    return {
      source: "default_rules_engine",
      issueId,
      issueTitle: "Hotel Schema Markup Drafted",
      issueCategory: "Missing JSON-LD Schema",
      description: "Drafted Schema.org/Hotel structured data from the property name and canonical URL only.",
      codeSnippet: `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`,
      language: "json",
    };
  }

  if (issueId === "og-missing") {
    if (!hotelName && !canonicalUrl) {
      return noSuggestion(
        "Social Open Graph Tags",
        "Open Graph tags",
        "No property name or canonical URL source — no Open Graph tags were drafted."
      );
    }
    const ogTitle = hotelName ? `${hotelName}${brandSuffix}` : "";
    const ogLines = [
      "<!-- Open Graph & Twitter Social Metadata -->",
      '<meta property="og:type" content="hotel" />',
      ...(ogTitle ? [`<meta property="og:title" content="${ogTitle}" />`] : []),
      ...(canonicalUrl ? [`<meta property="og:url" content="${canonicalUrl}" />`] : []),
      '<meta name="twitter:card" content="summary_large_image" />',
    ];
    return {
      source: "default_rules_engine",
      issueId,
      issueTitle: "Social Open Graph Tags Drafted",
      issueCategory: "Open Graph tags",
      description:
        "Drafted Open Graph tags from the property name and canonical URL; og:description needs a verified meta description.",
      codeSnippet: ogLines.join("\n"),
      language: "html",
      ...(ogTitle ? { optimalTitle: ogTitle } : {}),
    };
  }

  // Default: GEO AI readiness — FAQ answers are never invented.
  return {
    source: "default_rules_engine",
    issueId,
    issueTitle: "GEO AI Knowledge & FAQ Needs Verified Answers",
    issueCategory: "GEO AI Readiness",
    description:
      "No verified FAQ answers exist for this page — no FAQ schema was injected. Add your own Q&A (or connect an AI provider) before publishing FAQPage markup.",
    codeSnippet:
      "<!-- No FAQ schema generated — verified answers are required before publishing FAQPage markup. -->",
    language: "html",
  };
}

/**
 * Routes Auto-Fix requests to the fine-tuned model with automatic fallback to default engine.
 */
export async function generateSeoAutoFix(
  params: {
    issueId: string;
    hotelName?: string;
    brand?: string;
    canonicalUrl?: string;
    pageTitle?: string;
    pageMeta?: string;
  },
  fetchFn: typeof fetch = fetch
): Promise<AutoFixInferenceResult> {
  const hotelName = params.hotelName || "";
  const brand = params.brand || "";
  const canonicalUrl = params.canonicalUrl || "";

  const config = await getCustomModelConfig();

  // If the custom model is disabled or unconfigured — or there is no property
  // to fix — route to the default rules engine, which never drafts unsourced copy.
  if (!config.enabled || !config.endpointId.trim() || !hotelName) {
    return getDefaultAutoFix(params.issueId, hotelName, brand, canonicalUrl);
  }

  const start = Date.now();

  try {
    let url = config.endpointId.trim();
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (config.provider === "tuned_gemini") {
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = `https://generativelanguage.googleapis.com/v1beta/${url}:generateContent`;
      }
      if (config.apiKey) {
        headers["x-goog-api-key"] = config.apiKey.trim();
      }
    } else if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey.trim()}`;
    }

    const promptText = `Execute high-precision hospitality SEO auto-fix for issue '${params.issueId}':\nHotel: ${hotelName}\nBrand: ${brand}\nCanonical: ${canonicalUrl}\nTitle: ${params.pageTitle || ""}\nMeta: ${params.pageMeta || ""}\nOutput strict JSON matching TargetSeoGeoOutput schema.`;

    const requestBody =
      config.provider === "tuned_gemini"
        ? {
            contents: [{ role: "user", parts: [{ text: promptText }] }],
            generationConfig: { temperature: config.temperature, maxOutputTokens: config.maxTokens },
          }
        : {
            prompt: promptText,
            temperature: config.temperature,
            max_tokens: config.maxTokens,
          };

    const res = await fetchFn(url, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const latencyMs = Date.now() - start;

      let rawContent = "";
      if (data && typeof data === "object") {
        if ("candidates" in data && Array.isArray(data.candidates)) {
          rawContent = data.candidates[0]?.content?.parts?.[0]?.text || "";
        } else if ("choices" in data && Array.isArray(data.choices)) {
          rawContent = data.choices[0]?.message?.content || "";
        } else if ("text" in data && typeof data.text === "string") {
          rawContent = data.text;
        }
      }

      // Extract JSON payload from model response
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const optTitle = parsed.optimizedTitle || undefined;
        const optMeta = parsed.optimizedMetaDesc || undefined;
        const optH1 = parsed.optimizedH1 || undefined;

        let snippet = "";
        let lang: "html" | "json" = "html";

        if (params.issueId === "title-len" && optTitle) {
          snippet = `<title>${optTitle}</title>`;
        } else if (params.issueId === "meta-len" && optMeta) {
          snippet = `<meta name="description" content="${optMeta}" />`;
        } else if (params.issueId === "hotel-schema" && parsed.jsonLdSchema) {
          snippet = `<script type="application/ld+json">\n${JSON.stringify(parsed.jsonLdSchema, null, 2)}\n</script>`;
          lang = "json";
        } else {
          snippet = `<title>${optTitle || hotelName}</title>\n<meta name="description" content="${optMeta || ""}" />`;
        }

        return {
          source: "custom_tuned_model",
          issueId: params.issueId,
          issueTitle: `Tuned Model Fix Applied (${config.endpointId})`,
          issueCategory: "AI Auto-Fix",
          description: `Generated by fine-tuned model ${config.endpointId} in ${latencyMs}ms.`,
          codeSnippet: snippet,
          language: lang,
          optimalTitle: optTitle,
          optimalMeta: optMeta,
          optimalH1: optH1,
          latencyMs,
          modelIdentifier: config.endpointId,
        };
      }
    }
  } catch (err) {
    console.warn("[CustomModelClient] Remote inference error, falling back to default rules:", err);
  }

  // Automatic fallback on failure
  return getDefaultAutoFix(params.issueId, hotelName, brand, canonicalUrl);
}

/**
 * Standard deterministic rules fallback for GEO Knowledge Summary generation.
 */
function getDefaultGeoSummary(
  hotelName: string,
  brand: string,
  amenities: string[] = []
): GeoSummaryInferenceResult {
  // Facts only: the property name/brand plus amenities the page actually
  // lists. There is deliberately no default FAQ schema — answers are never
  // invented here.
  const parts: string[] = [];
  if (hotelName) parts.push(`${brand ? `${hotelName} (${brand})` : hotelName}.`);
  const listed = amenities.map((a) => a.trim()).filter(Boolean);
  if (listed.length > 0) parts.push(`Amenities listed on the page: ${listed.join(", ")}.`);
  return {
    source: "default_rules_engine",
    geoSummary: parts.join(" "),
  };
}

/**
 * Routes GEO Knowledge Summary generation to fine-tuned model with automatic fallback.
 */
export async function generateGeoSummary(
  params: {
    hotelName?: string;
    brand?: string;
    location?: string;
    amenities?: string[];
    pageContent?: string;
  },
  fetchFn: typeof fetch = fetch
): Promise<GeoSummaryInferenceResult> {
  const hotelName = params.hotelName || "";
  const brand = params.brand || "";

  if (!hotelName) {
    // Nothing to summarize — never ask a model (or a template) to invent a property.
    return { source: "default_rules_engine", geoSummary: "" };
  }

  const config = await getCustomModelConfig();

  if (!config.enabled || !config.endpointId.trim()) {
    return getDefaultGeoSummary(hotelName, brand, params.amenities);
  }

  const start = Date.now();

  try {
    let url = config.endpointId.trim();
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (config.provider === "tuned_gemini") {
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = `https://generativelanguage.googleapis.com/v1beta/${url}:generateContent`;
      }
      if (config.apiKey) {
        headers["x-goog-api-key"] = config.apiKey.trim();
      }
    } else if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey.trim()}`;
    }

    const amenityList = (params.amenities || []).map((a) => a.trim()).filter(Boolean);
    const amenityClause = amenityList.length > 0 ? ` Amenities: ${amenityList.join(", ")}.` : "";
    const promptText = `Generate a dense, factual GEO (Generative Engine Optimization) knowledge block and FAQ schema for ${hotelName} under ${brand} brand standards.${amenityClause} Output clean JSON with 'geoEntityBlock' and 'faqSchema'.`;

    const requestBody =
      config.provider === "tuned_gemini"
        ? {
            contents: [{ role: "user", parts: [{ text: promptText }] }],
            generationConfig: { temperature: config.temperature, maxOutputTokens: config.maxTokens },
          }
        : {
            prompt: promptText,
            temperature: config.temperature,
            max_tokens: config.maxTokens,
          };

    const res = await fetchFn(url, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const latencyMs = Date.now() - start;

      let rawContent = "";
      if (data && typeof data === "object") {
        if ("candidates" in data && Array.isArray(data.candidates)) {
          rawContent = data.candidates[0]?.content?.parts?.[0]?.text || "";
        } else if ("choices" in data && Array.isArray(data.choices)) {
          rawContent = data.choices[0]?.message?.content || "";
        } else if ("text" in data && typeof data.text === "string") {
          rawContent = data.text;
        }
      }

      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.geoEntityBlock) {
          return {
            source: "custom_tuned_model",
            geoSummary: parsed.geoEntityBlock,
            faqSchema: parsed.faqSchema || parsed.jsonLdSchema,
            latencyMs,
            modelIdentifier: config.endpointId,
          };
        }
      } else if (rawContent.trim().length > 50) {
        return {
          source: "custom_tuned_model",
          geoSummary: rawContent.trim(),
          latencyMs,
          modelIdentifier: config.endpointId,
        };
      }
    }
  } catch (err) {
    console.warn("[CustomModelClient] Remote GEO generation failed, falling back to default rules:", err);
  }

  // Automatic fallback
  return getDefaultGeoSummary(hotelName, brand);
}
