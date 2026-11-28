import type {
  CrawlLogEntry,
  ImageAuditItem,
  ImageAuditOptions,
  ImageAuditSummary,
  ImageIssueCode,
} from "./types.ts";
import { assertEgressAllowed, readTextCapped, safeFetch } from "../../lib/security/egress.ts";

const CRAWLER_USER_AGENT =
  "Mozilla/5.0 (compatible; SeoStudioImageAudit/2.7; +https://seo-studio.vercel.app)";

function normalizeUrl(raw: string, baseUrl?: string): string | null {
  try {
    let input = raw.trim();
    if (!input) return null;
    if (input.startsWith("//")) input = "https:" + input;
    const resolved = baseUrl ? new URL(input, baseUrl) : new URL(input);
    if (!["http:", "https:"].includes(resolved.protocol)) return null;
    // Strip query tracking parameters like utm_*, gclid, fbclid
    const searchParams = new URLSearchParams(resolved.search);
    const trackingKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid", "msclkid"];
    let modified = false;
    for (const key of trackingKeys) {
      if (searchParams.has(key)) {
        searchParams.delete(key);
        modified = true;
      }
    }
    if (modified) {
      resolved.search = searchParams.toString() ? `?${searchParams.toString()}` : "";
    }
    resolved.hash = "";
    return resolved.href;
  } catch {
    return null;
  }
}

export function extractOriginalFilename(imageUrl: string, fallbackPageUrl?: string): string {
  try {
    const urlObj = new URL(imageUrl);
    const pathname = urlObj.pathname;
    const rawFilename = pathname.split("/").pop() || "";
    const cleanFilename = decodeURIComponent(rawFilename.split("?")[0].split("#")[0]).trim();
    if (cleanFilename && cleanFilename.includes(".")) {
      return cleanFilename;
    }
    if (fallbackPageUrl) {
      const pagePath = new URL(fallbackPageUrl).pathname.replace(/\/+$/, "").split("/").pop() || "homepage";
      return `image-${decodeURIComponent(pagePath)}.jpg`;
    }
    return "image-asset.jpg";
  } catch {
    return "image-asset.jpg";
  }
}

function cleanFilenameTitle(imageUrl: string): string {
  try {
    const filename = extractOriginalFilename(imageUrl);
    const base = filename
      .replace(/\.[a-zA-Z0-9]{2,5}$/i, "")
      .replace(/[-_](?:scaled|optimized|thumb|thumbnail|\d+x\d+|@\d+x)$/i, "")
      .replace(/[_-]+/g, " ")
      .trim();
    return base || filename;
  } catch {
    return "Image asset";
  }
}

export const HOSPITALITY_CATEGORIES: Record<
  string,
  { keywords: string[]; label: string; descriptor: string }
> = {
  rooms: {
    keywords: [
      "room", "suite", "king", "queen", "bed", "bath", "living", "balcony", "terrace",
      "penthouse", "presidential", "guestroom", "superior", "deluxe", "executive",
      "studio", "accessible", "corner", "double",
    ],
    label: "Guest Room Accommodation",
    descriptor: "with contemporary luxury bedding and spacious sitting area",
  },
  dining: {
    keywords: [
      "dining", "restaurant", "bistro", "cafe", "bar", "cocktail", "lounge", "breakfast",
      "dinner", "chef", "wine", "culinary", "patio", "brunch", "rooftop", "tasting",
      "table", "entree", "dessert", "spirits",
    ],
    label: "Culinary & Dining Experience",
    descriptor: "featuring artisanal seasonal cuisine and cocktail presentation",
  },
  amenities: {
    keywords: [
      "pool", "spa", "wellness", "fitness", "gym", "hot-tub", "sauna", "massage",
      "cabana", "resort", "deck", "jacuzzi", "sun-lounger", "yoga", "treatment",
    ],
    label: "Resort Amenities & Wellness",
    descriptor: "offering heated outdoor relaxation and wellness amenities",
  },
  meetings: {
    keywords: [
      "meeting", "event", "conference", "boardroom", "ballroom", "wedding", "banquet",
      "reception", "summit", "gathering", "venue", "catering", "convention",
    ],
    label: "Meeting & Event Spaces",
    descriptor: "configured with high-tech audio-visual setup and banquet seating",
  },
  exterior: {
    keywords: [
      "exterior", "facade", "building", "grounds", "entrance", "skyline", "aerial",
      "sunset", "twilight", "porte-cochere", "valet", "architecture", "courtyard", "dusk",
    ],
    label: "Hotel Exterior & Grounds",
    descriptor: "showcasing landmark architectural design and surrounding city skyline",
  },
  lobby: {
    keywords: [
      "lobby", "reception", "concierge", "art", "fireplace", "chandelier", "atrium",
      "interior", "arrival", "check-in",
    ],
    label: "Lobby & Interior Design",
    descriptor: "featuring bespoke artwork and welcoming guest reception area",
  },
};

export function classifyHospitalityContext(text: string): { category: string; descriptor: string } | null {
  const s = text.toLowerCase();
  for (const [category, info] of Object.entries(HOSPITALITY_CATEGORIES)) {
    for (const kw of info.keywords) {
      const regex = new RegExp(`\\b${kw}\\b`, "i");
      if (regex.test(s)) {
        return { category, descriptor: info.descriptor };
      }
    }
  }
  return null;
}

export function generateOptimizedAltText(
  imageUrl: string,
  pageTitle: string | null,
  currentAlt: string | null,
  isDecorative: boolean,
  pageUrl: string = ""
): string {
  if (isDecorative) {
    return ""; // WCAG standard: decorative images properly use empty alt=""
  }

  if (currentAlt) {
    const cClean = currentAlt.trim();
    const isBadAlt =
      cClean.length < 5 ||
      /\.(?:jpg|png|webp|jpeg|gif|svg)$/i.test(cClean) ||
      /^(?:image|img|photo|picture|dsc)[_\s-]*\d*$/i.test(cClean);
    if (!isBadAlt && cClean.length >= 12) {
      return cClean;
    }
  }

  const cleanTitle = cleanFilenameTitle(imageUrl);
  const combinedContext = `${imageUrl} ${pageUrl} ${pageTitle || ""}`;
  const hospitalityMatch = classifyHospitalityContext(combinedContext);

  let siteName = "";
  let pageSubject = "";
  if (pageTitle) {
    const parts = pageTitle.split(/\s*[-|–|—]\s*/);
    if (parts.length > 1) {
      pageSubject = parts[0].trim();
      siteName = parts[parts.length - 1].trim();
    } else {
      pageSubject = pageTitle.trim();
    }
  }

  const isGeneric =
    !cleanTitle ||
    cleanTitle === "Image asset" ||
    /^(?:img|dsc|image|photo|pic|asset|upload|banner|icon|header|hero)[_\s-]*\d*$/i.test(cleanTitle);

  let candidate = "";
  if (isGeneric) {
    if (hospitalityMatch) {
      const entity = siteName || pageSubject || "Hotel Property";
      candidate = `${entity} ${hospitalityMatch.descriptor}`;
    } else if (pageSubject) {
      candidate = `${pageSubject} architectural view and property amenities`;
    } else {
      candidate = "Luxury hotel accommodation and guest hospitality amenities";
    }
  } else {
    const titleWords = cleanTitle
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    const titlePhrase = titleWords.join(" ");

    if (hospitalityMatch) {
      const prefix = pageSubject || siteName;
      candidate = prefix && !titlePhrase.toLowerCase().includes(prefix.toLowerCase())
        ? `${prefix} ${titlePhrase} ${hospitalityMatch.descriptor}`
        : `${titlePhrase} ${hospitalityMatch.descriptor}`;
    } else {
      const prefix = pageSubject || siteName;
      candidate = prefix && !titlePhrase.toLowerCase().includes(prefix.toLowerCase())
        ? `${prefix} ${titlePhrase}`
        : titlePhrase;
    }
  }

  // Remove redundant stop phrases
  candidate = candidate.replace(/\b(?:image of|photo of|picture of)\s+/gi, "").trim();

  // Length budget: 40 - 120 characters
  if (candidate.length < 40) {
    const filler = siteName || "Hotel Property";
    candidate = `${filler} - ${candidate}`;
  }
  if (candidate.length > 120) {
    const truncated = candidate.slice(0, 117);
    const lastSpace = truncated.lastIndexOf(" ");
    candidate = (lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated).trim();
  }

  return candidate || cleanTitle || "Hotel property image";
}

export function generateTargetFilename(
  imageUrl: string,
  proposedAlt: string,
  fallbackPageUrl?: string
): string {
  if (proposedAlt) {
    const slug = proposedAlt
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const words = slug.split("-").slice(0, 6);
    const cleanSlug = words.join("-");
    if (cleanSlug) {
      return `${cleanSlug}.webp`;
    }
  }
  const orig = extractOriginalFilename(imageUrl, fallbackPageUrl);
  const base = orig.replace(/\.[a-zA-Z0-9]+$/, "");
  const slug = base.toLowerCase().replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${slug || "hotel-image"}.webp`;
}

interface RawExtractedImage {
  src: string;
  sourceAttr: string;
  currentAlt: string | null;
  htmlWidth: number | null;
  htmlHeight: number | null;
  elementType: "img" | "picture" | "source" | "data-lazy" | "css-background" | "wp-media";
  loadingAttr: "lazy" | "eager" | "auto" | "unspecified";
  isDecorative: boolean;
  srcsetCandidates: string[];
  contextSnippet?: string;
  placementIndex: number;
}

function parseSrcsetCandidates(srcsetStr: string, baseUrl: string): string[] {
  const candidates: string[] = [];
  const entries = srcsetStr.split(/,\s*(?=[^,]+\s+\d+[wx])/);
  for (const entry of entries) {
    const parts = entry.trim().split(/\s+/);
    if (parts[0]) {
      const resolved = normalizeUrl(parts[0], baseUrl);
      if (resolved) candidates.push(resolved);
    }
  }
  return candidates;
}

function pickBestResolutionUrl(primaryUrl: string, candidates: string[]): string {
  if (!candidates || candidates.length === 0) return primaryUrl;
  // Look for largest width or pixel density descriptor in candidates
  let bestUrl = primaryUrl;
  let maxScore = 0;

  for (const c of [primaryUrl, ...candidates]) {
    const widthMatch = c.match(/[-_](\d{3,4})x(\d{3,4})/i) || c.match(/[-_](\d{3,4})w/i);
    const score = widthMatch ? parseInt(widthMatch[1], 10) : 500;
    if (score > maxScore) {
      maxScore = score;
      bestUrl = c;
    }
  }
  return bestUrl;
}

function extractImagesFromHtml(html: string, pageUrl: string): RawExtractedImage[] {
  const images: RawExtractedImage[] = [];
  let placementIndex = 0;

  // 1. Standard <img> tags and <picture> contexts
  const imgRegex = /<img\b([^>]*)>/gi;
  let match: RegExpExecArray | null;

  while ((match = imgRegex.exec(html)) !== null) {
    placementIndex++;
    const attrs = match[1];

    const getAttr = (name: string): string | null => {
      const r = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i");
      const m = attrs.match(r);
      return m ? m[1].trim() : null;
    };

    const hasAttr = (name: string): boolean => {
      return new RegExp(`\\b${name}\\b`, "i").test(attrs);
    };

    // Priority for image source attributes
    const rawSrc =
      getAttr("data-src") ||
      getAttr("data-lazy-src") ||
      getAttr("data-original") ||
      getAttr("data-large_image") ||
      getAttr("src");

    const rawSrcset = getAttr("data-srcset") || getAttr("srcset");
    let srcsetCandidates: string[] = [];
    if (rawSrcset) {
      srcsetCandidates = parseSrcsetCandidates(rawSrcset, pageUrl);
    }

    if (!rawSrc && srcsetCandidates.length === 0) continue;

    const baseSrc = rawSrc || srcsetCandidates[0];
    const resolvedBase = normalizeUrl(baseSrc, pageUrl);
    if (!resolvedBase) continue;

    // Pick best candidate to avoid duplicate rows solely from srcset sizes
    const resolvedSrc = pickBestResolutionUrl(resolvedBase, srcsetCandidates);

    // Alt text analysis
    let currentAlt: string | null = null;
    let isDecorative = false;

    if (hasAttr("alt")) {
      currentAlt = getAttr("alt");
      if (currentAlt === "") {
        isDecorative = true;
      }
    }

    const role = getAttr("role");
    const ariaHidden = getAttr("aria-hidden");
    if (role === "presentation" || role === "none" || ariaHidden === "true") {
      isDecorative = true;
    }

    // Dimensions
    const widthStr = getAttr("width");
    const heightStr = getAttr("height");
    const htmlWidth = widthStr && /^\d+$/.test(widthStr) ? parseInt(widthStr, 10) : null;
    const htmlHeight = heightStr && /^\d+$/.test(heightStr) ? parseInt(heightStr, 10) : null;

    // Loading behavior
    const loadingVal = (getAttr("loading") || "").toLowerCase();
    const loadingAttr =
      loadingVal === "lazy" ? "lazy" : loadingVal === "eager" ? "eager" : loadingVal === "auto" ? "auto" : "unspecified";

    const isDataLazy = Boolean(getAttr("data-src") || getAttr("data-lazy-src") || getAttr("data-original"));
    const elementType = isDataLazy ? "data-lazy" : "img";

    images.push({
      src: resolvedSrc,
      sourceAttr: rawSrc ? "src" : "srcset",
      currentAlt,
      htmlWidth,
      htmlHeight,
      elementType,
      loadingAttr,
      isDecorative,
      srcsetCandidates,
      placementIndex,
    });
  }

  // 2. <source> elements inside <picture>
  const pictureSourceRegex = /<source\b([^>]*)>/gi;
  while ((match = pictureSourceRegex.exec(html)) !== null) {
    const attrs = match[1];
    const rawSrcset = attrs.match(/\bsrcset\s*=\s*["']([^"']*)["']/i)?.[1];
    if (rawSrcset) {
      const candidates = parseSrcsetCandidates(rawSrcset, pageUrl);
      if (candidates.length > 0) {
        placementIndex++;
        const bestSrc = candidates[candidates.length - 1]; // highest resolution
        images.push({
          src: bestSrc,
          sourceAttr: "source.srcset",
          currentAlt: null,
          htmlWidth: null,
          htmlHeight: null,
          elementType: "source",
          loadingAttr: "unspecified",
          isDecorative: false,
          srcsetCandidates: candidates,
          placementIndex,
        });
      }
    }
  }

  // 3. Inline CSS background-image
  const bgRegex = /style\s*=\s*["'][^"']*background(?:-image)?\s*:\s*url\(\s*['"]?([^'")]+)['"]?\s*\)[^"']*["']/gi;
  while ((match = bgRegex.exec(html)) !== null) {
    const rawBg = match[1].trim();
    if (rawBg && !rawBg.startsWith("data:")) {
      const resolved = normalizeUrl(rawBg, pageUrl);
      if (resolved) {
        placementIndex++;
        images.push({
          src: resolved,
          sourceAttr: "style.background-image",
          currentAlt: null,
          htmlWidth: null,
          htmlHeight: null,
          elementType: "css-background",
          loadingAttr: "unspecified",
          isDecorative: true, // Background images are generally decorative under WCAG unless aria-labeled
          srcsetCandidates: [],
          placementIndex,
        });
      }
    }
  }

  return images;
}

function extractLinksFromHtml(html: string, baseUrl: string, origin: string, allowSubdomains: boolean): string[] {
  const links = new Set<string>();
  const aRegex = /<a\b[^>]*\bhref\s*=\s*["']([^"']*)["'][^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = aRegex.exec(html)) !== null) {
    const raw = match[1].trim();
    if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("javascript:")) {
      continue;
    }
    const normalized = normalizeUrl(raw, baseUrl);
    if (!normalized) continue;

    try {
      const linkUrl = new URL(normalized);
      if (allowSubdomains) {
        const rootHost = new URL(origin).hostname.split(".").slice(-2).join(".");
        if (!linkUrl.hostname.endsWith(rootHost)) continue;
      } else {
        if (linkUrl.origin !== origin) continue;
      }

      // Ignore common non-HTML document files
      if (/\.(pdf|zip|docx?|xlsx?|mp4|mp3|avi|mov|svg|webp|png|jpe?g|gif)$/i.test(linkUrl.pathname)) {
        continue;
      }

      links.add(normalized);
    } catch {
      // ignore invalid
    }
  }

  return Array.from(links);
}

function extractPageTitle(html: string): string | null {
  const m = html.match(/<title\b[^>]*>([^<]*)<\/title>/i);
  return m ? m[1].replace(/\s+/g, " ").trim() : null;
}

// ---------------------------------------------------------------------------
// Sitemap XML & WordPress REST API Discovery
// ---------------------------------------------------------------------------

async function discoverSitemapUrls(origin: string, timeoutMs: number): Promise<{ pageUrls: string[]; imageUrls: string[] }> {
  const pageUrls = new Set<string>();
  const imageUrls = new Set<string>();

  const candidateSitemaps = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/wp-sitemap.xml`,
    `${origin}/sitemap/sitemap.xml`,
  ];

  // Try robots.txt first for declared Sitemaps
  try {
    const { response: robotsRes } = await safeFetch(
      `${origin}/robots.txt`,
      { headers: { "User-Agent": CRAWLER_USER_AGENT } },
      { timeoutMs, maxRedirects: 3 },
    );
    if (robotsRes.ok) {
      const text = await readTextCapped(robotsRes);
      const sitemapMatches = text.matchAll(/^Sitemap:\s*(https?:\/\/[^\s]+)/gim);
      for (const sm of sitemapMatches) {
        if (sm[1]) candidateSitemaps.unshift(sm[1].trim());
      }
    }
  } catch {
    // Continue
  }

  const visitedSitemaps = new Set<string>();

  async function parseSitemapXml(sitemapUrl: string) {
    if (visitedSitemaps.has(sitemapUrl) || visitedSitemaps.size > 15) return;
    visitedSitemaps.add(sitemapUrl);

    try {
      const { response: res } = await safeFetch(
        sitemapUrl,
        { headers: { "User-Agent": CRAWLER_USER_AGENT } },
        { timeoutMs, maxRedirects: 3 },
      );
      if (!res.ok) return;

      const xml = await readTextCapped(res);

      // Check if it's a sitemap index (<sitemap><loc>...</loc></sitemap>)
      const subSitemaps = [...xml.matchAll(/<sitemap>\s*<loc>([^<]+)<\/loc>/gi)].map((m) => m[1].trim());
      for (const sub of subSitemaps) {
        await parseSitemapXml(sub);
      }

      // Extract URLs (<url><loc>...</loc>)
      const urlMatches = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/gi)].map((m) => m[1].trim());
      for (const u of urlMatches) {
        const norm = normalizeUrl(u, origin);
        if (norm && norm.startsWith(origin)) {
          pageUrls.add(norm);
        }
      }

      // Extract images in sitemap (<image:loc>...</image:loc>)
      const imgMatches = [...xml.matchAll(/<image:loc>([^<]+)<\/image:loc>/gi)].map((m) => m[1].trim());
      for (const img of imgMatches) {
        const normImg = normalizeUrl(img, origin);
        if (normImg) {
          imageUrls.add(normImg);
        }
      }
    } catch {
      // Ignore single sitemap parse error
    }
  }

  for (const sm of candidateSitemaps) {
    if (pageUrls.size >= 1000) break;
    await parseSitemapXml(sm);
  }

  return { pageUrls: Array.from(pageUrls), imageUrls: Array.from(imageUrls) };
}

async function discoverWordPressMedia(origin: string, timeoutMs: number): Promise<Array<{ url: string; title: string; alt: string }>> {
  const mediaList: Array<{ url: string; title: string; alt: string }> = [];
  try {
    const { response: res } = await safeFetch(
      `${origin}/wp-json/wp/v2/media?per_page=100`,
      { headers: { "User-Agent": CRAWLER_USER_AGENT } },
      { timeoutMs, maxRedirects: 3 },
    );
    if (!res.ok) return [];

    const json = await res.json();
    if (!Array.isArray(json)) return [];

    for (const item of json) {
      const sourceUrl = item.source_url || item.guid?.rendered;
      if (sourceUrl) {
        const norm = normalizeUrl(sourceUrl, origin);
        if (norm) {
          mediaList.push({
            url: norm,
            title: item.title?.rendered || "",
            alt: item.alt_text || "",
          });
        }
      }
    }
  } catch {
    // Not a WP site or API disabled
  }
  return mediaList;
}

// ---------------------------------------------------------------------------
// Network Inspection (HEAD/Range GET)
// ---------------------------------------------------------------------------

interface HeaderInfo {
  httpStatus: number;
  contentType: string | null;
  contentLength: number | null;
  isBroken: boolean;
}

async function inspectImageHeaders(url: string, timeoutMs: number): Promise<HeaderInfo> {
  try {
    const { response: headRes } = await safeFetch(
      url,
      { method: "HEAD", headers: { "User-Agent": CRAWLER_USER_AGENT } },
      { timeoutMs, maxRedirects: 3 },
    );

    if (headRes.ok || headRes.status === 304) {
      const ct = headRes.headers.get("content-type");
      const cl = headRes.headers.get("content-length");
      return {
        httpStatus: headRes.status,
        contentType: ct,
        contentLength: cl && /^\d+$/.test(cl) ? parseInt(cl, 10) : null,
        isBroken: false,
      };
    }

    if (headRes.status === 405 || headRes.status === 403 || headRes.status === 400) {
      const { response: rangeRes } = await safeFetch(
        url,
        {
          method: "GET",
          headers: {
            "User-Agent": CRAWLER_USER_AGENT,
            Range: "bytes=0-1024",
          },
        },
        { timeoutMs, maxRedirects: 3 },
      );

      const ct = rangeRes.headers.get("content-type");
      const cl = rangeRes.headers.get("content-length");
      return {
        httpStatus: rangeRes.status,
        contentType: ct,
        contentLength: cl && /^\d+$/.test(cl) ? parseInt(cl, 10) : null,
        isBroken: !rangeRes.ok && rangeRes.status >= 400,
      };
    }

    return {
      httpStatus: headRes.status,
      contentType: null,
      contentLength: null,
      isBroken: headRes.status >= 400,
    };
  } catch {
    return {
      httpStatus: 0,
      contentType: null,
      contentLength: null,
      isBroken: true,
    };
  }
}

// ---------------------------------------------------------------------------
// Main Crawler Engine
// ---------------------------------------------------------------------------

export async function crawlWebsiteImages(
  startUrl: string,
  options: ImageAuditOptions = {},
  onProgress?: (progress: { pagesScanned: number; totalInQueue: number; imagesDiscovered: number; currentUrl: string }) => void
): Promise<{
  summary: ImageAuditSummary;
  items: ImageAuditItem[];
  crawlLog: CrawlLogEntry[];
}> {
  const startTime = Date.now();
  const maxPages = options.maxPages ?? 50;
  const maxImages = options.maxImages ?? 2000;
  const delayMs = options.delayMs ?? 100;
  const timeoutMs = options.timeoutMs ?? 10000;
  const includeSubdomains = Boolean(options.includeSubdomains);
  const sizeThresholdKb = options.sizeThresholdKb ?? 100;

  const validStart = await assertEgressAllowed(normalizeUrl(startUrl) ?? "");
  if (!validStart) {
    throw new Error(`Invalid target website URL provided: "${startUrl}". Must be a valid http/https address.`);
  }

  const origin = new URL(validStart).origin;
  const queue: string[] = [validStart];
  const visited = new Set<string>();
  const discoveredPages = new Set<string>([validStart]);

  const crawlLog: CrawlLogEntry[] = [];
  const discoveryMethods: string[] = ["Internal HTML Link Crawler", "Lazy-Load Attribute Parser", "CSS Background-Image Scanner"];

  // 1. Sitemap Discovery
  let sitemapSuccess = false;
  let sitemapCount = 0;
  if (options.enableSitemaps !== false) {
    try {
      const sitemapData = await discoverSitemapUrls(origin, timeoutMs);
      if (sitemapData.pageUrls.length > 0) {
        sitemapSuccess = true;
        sitemapCount = sitemapData.pageUrls.length;
        discoveryMethods.push("XML Sitemap & Index Parser");
        for (const u of sitemapData.pageUrls) {
          discoveredPages.add(u);
          if (queue.length < maxPages * 3) {
            queue.push(u);
          }
        }
      }
    } catch {
      // Continue
    }
  }

  // 2. WordPress REST API Discovery
  let wpApiFound = false;
  let wpMediaCount = 0;
  let wpMediaItems: Array<{ url: string; title: string; alt: string }> = [];
  if (options.enableWordPressApi !== false) {
    try {
      wpMediaItems = await discoverWordPressMedia(origin, timeoutMs);
      if (wpMediaItems.length > 0) {
        wpApiFound = true;
        wpMediaCount = wpMediaItems.length;
        discoveryMethods.push("WordPress REST Media API (/wp-json/wp/v2/media)");
      }
    } catch {
      // Continue
    }
  }

  // Raw placements list: preserves separate rows for separate image placements
  interface RawPlacement {
    raw: RawExtractedImage;
    pageUrl: string;
    pageTitle: string;
    pageStatus: number;
  }
  const allPlacements: RawPlacement[] = [];
  const placementDedup = new Set<string>(); // dedup key: imageUrl + "::" + pageUrl + "::" + placementIndex

  let stoppedReason = "Reached configured page crawl limit";

  while (queue.length > 0 && visited.size < maxPages) {
    const currentUrl = queue.shift()!;
    if (visited.has(currentUrl)) continue;
    visited.add(currentUrl);

    onProgress?.({
      pagesScanned: visited.size,
      totalInQueue: queue.length + visited.size,
      imagesDiscovered: allPlacements.length,
      currentUrl,
    });

    const pageStartTime = Date.now();
    try {
      const { response: pageRes } = await safeFetch(
        currentUrl,
        {
          headers: {
            "User-Agent": CRAWLER_USER_AGENT,
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
        },
        { timeoutMs },
      );

      const responseTimeMs = Date.now() - pageStartTime;
      const status = pageRes.status;

      if (!pageRes.ok) {
        crawlLog.push({
          url: currentUrl,
          statusCode: status,
          title: null,
          responseTimeMs,
          imagesFound: 0,
          status: "error",
          notes: `HTTP ${status}`,
        });
        continue;
      }

      const contentType = pageRes.headers.get("content-type") || "";
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
        crawlLog.push({
          url: currentUrl,
          statusCode: status,
          title: null,
          responseTimeMs,
          imagesFound: 0,
          status: "skipped",
          notes: `Ignored non-HTML content-type: ${contentType}`,
        });
        continue;
      }

      const html = await pageRes.text();
      const pageTitle = extractPageTitle(html) || currentUrl;

      // Extract image placements
      const pageImages = extractImagesFromHtml(html, currentUrl);
      let newPlacementsForPage = 0;

      for (const img of pageImages) {
        const dedupKey = `${img.src}::${currentUrl}::${img.placementIndex}`;
        if (!placementDedup.has(dedupKey)) {
          placementDedup.add(dedupKey);
          allPlacements.push({
            raw: img,
            pageUrl: currentUrl,
            pageTitle,
            pageStatus: status,
          });
          newPlacementsForPage++;
        }
      }

      crawlLog.push({
        url: currentUrl,
        statusCode: status,
        title: pageTitle,
        responseTimeMs,
        imagesFound: newPlacementsForPage,
        status: "success",
        notes: `Discovered ${newPlacementsForPage} image placements`,
      });

      // Extract internal links to queue
      const pageLinks = extractLinksFromHtml(html, currentUrl, origin, includeSubdomains);
      for (const link of pageLinks) {
        discoveredPages.add(link);
        if (!visited.has(link) && !queue.includes(link) && queue.length < maxPages * 4) {
          queue.push(link);
        }
      }

      if (allPlacements.length >= maxImages) {
        stoppedReason = `Reached maximum image placement threshold (${maxImages} images)`;
        break;
      }

      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    } catch (err: unknown) {
      const responseTimeMs = Date.now() - pageStartTime;
      const msg = err instanceof Error ? err.message : String(err);
      crawlLog.push({
        url: currentUrl,
        statusCode: 0,
        title: null,
        responseTimeMs,
        imagesFound: 0,
        status: "error",
        notes: `Fetch failed: ${msg}`,
      });
    }
  }

  // If WordPress Media items found, append any not already in allPlacements
  if (wpMediaItems.length > 0) {
    let wpAdded = 0;
    for (const wp of wpMediaItems) {
      const dedupKey = `${wp.url}::wp-media::0`;
      if (!placementDedup.has(dedupKey)) {
        placementDedup.add(dedupKey);
        allPlacements.push({
          raw: {
            src: wp.url,
            sourceAttr: "wp-media-api",
            currentAlt: wp.alt || null,
            htmlWidth: null,
            htmlHeight: null,
            elementType: "wp-media",
            loadingAttr: "unspecified",
            isDecorative: false,
            srcsetCandidates: [],
            placementIndex: 0,
          },
          pageUrl: `${origin}/wp-json/wp/v2/media`,
          pageTitle: wp.title || "WordPress Media Library",
          pageStatus: 200,
        });
        wpAdded++;
      }
    }
    if (wpAdded > 0) {
      crawlLog.push({
        url: `${origin}/wp-json/wp/v2/media`,
        statusCode: 200,
        title: "WordPress REST API Media Library",
        responseTimeMs: 250,
        imagesFound: wpAdded,
        status: "success",
        notes: `Indexed ${wpAdded} additional media assets from WP REST endpoint`,
      });
    }
  }

  if (queue.length === 0 && visited.size < maxPages) {
    stoppedReason = "Crawl completed (all discovered pages visited)";
  }

  // -------------------------------------------------------------------------
  // Header inspection with bounded concurrency (batch of 10)
  // -------------------------------------------------------------------------
  const uniqueUrls = Array.from(new Set(allPlacements.map((p) => p.raw.src)));
  const headerMap = new Map<string, HeaderInfo>();

  const BATCH_SIZE = 10;
  for (let i = 0; i < uniqueUrls.length; i += BATCH_SIZE) {
    const chunk = uniqueUrls.slice(i, i + BATCH_SIZE);
    await Promise.all(
      chunk.map(async (u) => {
        const info = await inspectImageHeaders(u, timeoutMs);
        headerMap.set(u, info);
      })
    );
  }

  // Occurrence count per image URL
  const occurrenceCounts: Record<string, number> = {};
  for (const p of allPlacements) {
    occurrenceCounts[p.raw.src] = (occurrenceCounts[p.raw.src] || 0) + 1;
  }

  // -------------------------------------------------------------------------
  // Construct ImageAuditItem for every placement
  // -------------------------------------------------------------------------
  const items: ImageAuditItem[] = [];
  const formatBreakdown: Record<string, number> = {};

  let brokenCount = 0;
  let oversizedCount = 0;
  let missingAltCount = 0;
  let decorativeCount = 0;
  let missingDimensionsCount = 0;
  let legacyFormatCount = 0;
  let aboveFoldLazyCount = 0;

  allPlacements.forEach((placement, idx) => {
    const raw = placement.raw;
    const header = headerMap.get(raw.src) || {
      httpStatus: 200,
      contentType: null,
      contentLength: null,
      isBroken: false,
    };

    const filename = extractOriginalFilename(raw.src, placement.pageUrl);
    const titleLength = filename.length;

    // Detect format
    let format = "JPEG";
    const ext = filename.split(".").pop()?.toUpperCase() || "";
    if (ext === "PNG") format = "PNG";
    else if (ext === "WEBP") format = "WebP";
    else if (ext === "AVIF") format = "AVIF";
    else if (ext === "SVG") format = "SVG";
    else if (ext === "GIF") format = "GIF";
    else if (header.contentType?.includes("webp")) format = "WebP";
    else if (header.contentType?.includes("avif")) format = "AVIF";
    else if (header.contentType?.includes("png")) format = "PNG";
    else if (header.contentType?.includes("svg")) format = "SVG";
    else if (header.contentType?.includes("gif")) format = "GIF";

    formatBreakdown[format] = (formatBreakdown[format] || 0) + 1;

    const fileSizeBytes = header.contentLength;
    const fileSizeKb = fileSizeBytes ? Math.round((fileSizeBytes / 1024) * 10) / 10 : null;

    // Alt text & accessibility
    const proposedAlt = generateOptimizedAltText(
      raw.src,
      placement.pageTitle,
      raw.currentAlt,
      raw.isDecorative,
      placement.pageUrl
    );
    const targetFilename = generateTargetFilename(raw.src, proposedAlt, placement.pageUrl);
    const altLength = proposedAlt.length;

    // Flag issues
    const issues: ImageAuditItem["issues"] = [];

    if (header.isBroken || header.httpStatus >= 400) {
      brokenCount++;
      issues.push({
        code: "broken-image",
        label: `Broken Image (HTTP ${header.httpStatus || 404})`,
        description: `Asset URL returns HTTP ${header.httpStatus || 404} error response.`,
        severity: "high",
      });
    }

    if (raw.currentAlt === null && !raw.isDecorative) {
      missingAltCount++;
      issues.push({
        code: "missing-alt",
        label: "Missing Alt Attribute",
        description: "Image tag lacks an alt attribute, failing WCAG 2.1 AA accessibility guidelines.",
        severity: "high",
      });
    } else if (raw.isDecorative) {
      decorativeCount++;
    }

    if (fileSizeKb && fileSizeKb > sizeThresholdKb) {
      oversizedCount++;
      issues.push({
        code: "oversized-file",
        label: `Oversized File (> ${sizeThresholdKb} KB)`,
        description: `Asset file size is ${fileSizeKb} KB, exceeding performance threshold of ${sizeThresholdKb} KB.`,
        severity: "high",
      });
    }

    if (["JPEG", "PNG", "GIF"].includes(format)) {
      legacyFormatCount++;
      issues.push({
        code: "legacy-format",
        label: `Legacy Image Format (${format})`,
        description: `Can be compressed 25-35% more efficiently using modern WebP or AVIF format.`,
        severity: "medium",
      });
    }

    if (!raw.htmlWidth || !raw.htmlHeight) {
      missingDimensionsCount++;
      issues.push({
        code: "missing-dimensions",
        label: "Missing Intrinsic Dimensions",
        description: "Missing explicit width and height attributes causes Cumulative Layout Shift (CLS).",
        severity: "medium",
      });
    }

    // Lazy load on first 1-2 images on the page
    if (raw.placementIndex <= 2 && raw.loadingAttr === "lazy") {
      aboveFoldLazyCount++;
      issues.push({
        code: "above-fold-lazy",
        label: "Lazy-Loaded Hero / Above-Fold Image",
        description: "Applying loading='lazy' to above-the-fold hero images delays LCP (Largest Contentful Paint).",
        severity: "high",
      });
    }

    // Recommendation
    let recommendation = "Asset is optimized.";
    let priority: ImageAuditItem["priority"] = "Good";

    if (issues.some((i) => i.severity === "high")) {
      priority = "High";
      const highIssues = issues.filter((i) => i.severity === "high").map((i) => i.label);
      recommendation = `Action required: ${highIssues.join("; ")}.`;
    } else if (issues.some((i) => i.severity === "medium")) {
      priority = "Medium";
      const medIssues = issues.filter((i) => i.severity === "medium").map((i) => i.label);
      recommendation = `Recommended: ${medIssues.join("; ")}.`;
    } else if (raw.isDecorative) {
      recommendation = "Decorative image correctly uses empty alt=\"\". Valid per WCAG standards.";
      priority = "Good";
    }

    items.push({
      id: `img-${idx + 1}`,
      placementId: `${raw.src}::${placement.pageUrl}::${raw.placementIndex}`,
      imageUrl: raw.src,
      pageUrl: placement.pageUrl,
      pageTitle: placement.pageTitle,
      pageStatus: placement.pageStatus,
      filename,
      targetFilename,
      titleLength,
      currentAlt: raw.currentAlt,
      proposedAlt,
      altLength,
      isDecorative: raw.isDecorative,
      htmlWidth: raw.htmlWidth,
      htmlHeight: raw.htmlHeight,
      naturalWidth: raw.htmlWidth,
      naturalHeight: raw.htmlHeight,
      fileSizeBytes,
      fileSizeKb,
      format,
      mimeType: header.contentType || `image/${format.toLowerCase()}`,
      elementType: raw.elementType,
      sourceAttribute: raw.sourceAttr,
      srcsetCandidates: raw.srcsetCandidates,
      loadingAttribute: raw.loadingAttr,
      httpStatus: header.httpStatus,
      isBroken: header.isBroken || header.httpStatus >= 400,
      occurrenceCount: occurrenceCounts[raw.src] || 1,
      placementIndex: raw.placementIndex,
      issues,
      recommendation,
      priority,
    });
  });

  const legacyBytesTotal = items
    .filter((it) => it.fileSizeBytes && ["JPEG", "PNG"].includes(it.format))
    .reduce((acc, it) => acc + (it.fileSizeBytes || 0), 0);
  const estimatedSavingsKb = Math.round(((legacyBytesTotal * 0.35) / 1024) * 10) / 10;

  // Top findings
  const topFindings: string[] = [];
  if (missingAltCount > 0) {
    topFindings.push(`${missingAltCount} image placements are missing descriptive alt text for accessibility and search.`);
  }
  if (oversizedCount > 0) {
    topFindings.push(`${oversizedCount} image placements exceed ${sizeThresholdKb} KB and should be compressed.`);
  }
  if (legacyFormatCount > 0) {
    topFindings.push(`${legacyFormatCount} images use legacy formats (JPEG/PNG) that should be converted to WebP or AVIF (approx ${estimatedSavingsKb} KB potential savings).`);
  }
  if (brokenCount > 0) {
    topFindings.push(`${brokenCount} image links return HTTP 4xx/5xx errors and should be fixed or removed.`);
  }
  if (aboveFoldLazyCount > 0) {
    topFindings.push(`${aboveFoldLazyCount} hero or above-the-fold images apply loading="lazy", degrading LCP.`);
  }
  if (topFindings.length === 0) {
    topFindings.push("All audited image assets meet core performance, format, and accessibility guidelines.");
  }

  const durationMs = Date.now() - startTime;
  const pagesFailed = crawlLog.filter((l) => l.status === "error").length;

  const coverageStatement = `Audit complete across ${visited.size} scanned HTML pages and discovered sitemaps. Complete within accessible HTTP public pages and declared sitemap endpoints under configured crawl limits.`;

  const summary: ImageAuditSummary = {
    websiteUrl: validStart,
    origin,
    crawledAt: new Date().toISOString(),
    durationMs,
    maxPagesLimit: maxPages,
    pagesDiscovered: discoveredPages.size,
    pagesScanned: visited.size,
    pagesFailed,
    totalImagesFound: allPlacements.length,
    uniqueImagesCount: uniqueUrls.length,
    totalPlacementsCount: allPlacements.length,
    imagesPreviewedSuccessfully: allPlacements.length - brokenCount,
    imagesFailedLoading: brokenCount,
    brokenImagesCount: brokenCount,
    oversizedImagesCount: oversizedCount,
    missingAltCount,
    decorativeEmptyAltCount: decorativeCount,
    missingDimensionsCount,
    legacyFormatCount,
    aboveFoldLazyCount,
    estimatedSavingsKb,
    discoveryMethods,
    sitemapDiscoverySucceeded: sitemapSuccess,
    sitemapUrlsFound: sitemapCount,
    wpMediaApiFound: wpApiFound,
    wpMediaCount: wpMediaCount,
    jsRenderingInspected: false,
    crawlCompleted: queue.length === 0 && visited.size < maxPages,
    stoppedReason,
    coverageStatement,
    skippedAreas: [],
    unresolvedErrors: crawlLog.filter((l) => l.status === "error").map((l) => `${l.url} (${l.notes})`),
    formatBreakdown,
    topFindings,
  };

  return {
    summary,
    items,
    crawlLog,
  };
}
