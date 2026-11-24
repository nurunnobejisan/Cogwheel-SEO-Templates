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
  "https://chrome.google.com/webstore",
  "chrome-search://",
  "devtools://",
];

export type PageRestrictionStatus = "RESTRICTED_PAGE" | "ALLOWED";

export interface PageRestrictionCheck {
  status: PageRestrictionStatus;
  isRestricted: boolean;
  reason?: string;
}

/**
 * Returns a typed status check for any URL without throwing exceptions.
 */
export function checkPageRestriction(url?: string | null): PageRestrictionCheck {
  if (!url || typeof url !== "string") {
    return {
      status: "RESTRICTED_PAGE",
      isRestricted: true,
      reason: "Missing or non-string URL",
    };
  }

  const trimmed = url.trim().toLowerCase();
  const isRestricted = RESTRICTED_URL_PREFIXES.some((prefix) =>
    trimmed.startsWith(prefix.toLowerCase())
  );

  if (isRestricted) {
    return {
      status: "RESTRICTED_PAGE",
      isRestricted: true,
      reason: "Internal browser page or extension store origin",
    };
  }

  return {
    status: "ALLOWED",
    isRestricted: false,
  };
}

export function isRestrictedUrl(url?: string | null): boolean {
  return checkPageRestriction(url).isRestricted;
}

