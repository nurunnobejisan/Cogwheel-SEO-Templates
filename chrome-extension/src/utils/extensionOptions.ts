/**
 * SEO & GEO Studio - Extension Options & Training Guardrails
 */

export interface ExtensionOptions {
  consent: boolean;
  captureMode: "manual" | "auto";
  allowlistDomains: string[];
  blocklistDomains: string[];
  blocklistPaths: string[];
  apiUrl: string;
  apiToken: string;
}

export const DEFAULT_BLOCKLIST_DOMAINS = [
  "mail.google.com",
  "outlook.live.com",
  "mail.yahoo.com",
  "chase.com",
  "bankofamerica.com",
  "wellsfargo.com",
  "paypal.com",
  "stripe.com",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "tiktok.com",
  "admin.shopify.com",
];

export const DEFAULT_BLOCKLIST_PATHS = [
  "/admin",
  "/login",
  "/signin",
  "/signup",
  "/account",
  "/checkout",
  "/cart",
  "/billing",
  "/auth",
  "/password",
];

export const DEFAULT_OPTIONS: ExtensionOptions = {
  consent: false,
  captureMode: "manual",
  allowlistDomains: ["marriott.com", "hilton.com", "ihg.com", "hyatt.com"],
  blocklistDomains: DEFAULT_BLOCKLIST_DOMAINS,
  blocklistPaths: DEFAULT_BLOCKLIST_PATHS,
  apiUrl: "https://seo-studio-one.vercel.app/api/ai-training",
  apiToken: "",
};

import { encryptSecret, decryptSecret } from "./secureStorage";

const STORAGE_KEY = "cogwheel_extension_options_v1";

export async function loadExtensionOptions(): Promise<ExtensionOptions> {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
    return new Promise((resolve) => {
      chrome.storage.sync.get(STORAGE_KEY, async (res) => {
        if (!chrome.runtime.lastError && res && res[STORAGE_KEY]) {
          const merged = { ...DEFAULT_OPTIONS, ...res[STORAGE_KEY] };
          if (merged.apiToken) merged.apiToken = await decryptSecret(merged.apiToken);
          resolve(merged);
        } else {
          resolve(DEFAULT_OPTIONS);
        }
      });
    });
  }

  if (typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const merged = { ...DEFAULT_OPTIONS, ...JSON.parse(raw) };
        if (merged.apiToken) merged.apiToken = await decryptSecret(merged.apiToken);
        return merged;
      }
    } catch {}
  }

  return DEFAULT_OPTIONS;
}

export async function saveExtensionOptions(options: ExtensionOptions): Promise<void> {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
    const toStore = { ...options, apiToken: await encryptSecret(options.apiToken) };
    return new Promise((resolve, reject) => {
      chrome.storage.sync.set({ [STORAGE_KEY]: toStore }, () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve();
      });
    });
  }

  if (typeof localStorage !== "undefined") {
    const toStore = { ...options, apiToken: await encryptSecret(options.apiToken) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  }
}

export function shouldCaptureUrl(
  url: string,
  options: ExtensionOptions,
  hasPasswordField = false
): { canCapture: boolean; reason?: string } {
  if (!url || typeof url !== "string") {
    return { canCapture: false, reason: "Invalid or empty URL" };
  }

  if (hasPasswordField) {
    return { canCapture: false, reason: "Sensitive page contains password field" };
  }

  let domain = "";
  let path = "";
  try {
    const u = new URL(url);
    domain = u.hostname.toLowerCase();
    path = u.pathname.toLowerCase();
  } catch {
    return { canCapture: false, reason: "Malformed URL" };
  }

  // 1. Check Blocklist Domains
  for (const bDomain of options.blocklistDomains) {
    if (domain === bDomain.toLowerCase() || domain.endsWith("." + bDomain.toLowerCase())) {
      return { canCapture: false, reason: `Domain ${domain} is on the security blocklist` };
    }
  }

  // 2. Check Blocklist Paths
  for (const bPath of options.blocklistPaths) {
    if (path.includes(bPath.toLowerCase())) {
      return { canCapture: false, reason: `Path contains sensitive keyword (${bPath})` };
    }
  }

  // 3. Check Consent
  if (!options.consent) {
    return { canCapture: false, reason: "User training data consent not enabled" };
  }

  // 4. Check Capture Mode
  if (options.captureMode === "auto") {
    const isAllowlisted = options.allowlistDomains.some(
      (aDomain) => domain === aDomain.toLowerCase() || domain.endsWith("." + aDomain.toLowerCase())
    );
    if (!isAllowlisted) {
      return { canCapture: false, reason: `Domain ${domain} is not in allowlist for auto-capture` };
    }
  }

  return { canCapture: true };
}
