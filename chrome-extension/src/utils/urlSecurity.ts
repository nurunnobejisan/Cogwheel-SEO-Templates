/**
 * URL Security & Restricted Origin Validator
 * Prevents unauthorized or impossible script injection / messaging on browser internal pages.
 */

export const RESTRICTED_URL_PREFIXES = [
  "chrome://",
  "chrome-extension://",
  "edge://",
  "about:",
  "view-source:",
  "https://chromewebstore.google.com",
  "chrome-search://",
  "devtools://",
];

export function isRestrictedUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return true;
  const trimmed = url.trim().toLowerCase();
  return RESTRICTED_URL_PREFIXES.some((prefix) => trimmed.startsWith(prefix.toLowerCase()));
}
