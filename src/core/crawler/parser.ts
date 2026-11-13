import { createHash } from "node:crypto";
import type { HeadingEntry, HreflangEntry, ImageAsset } from "./types";
import { canonicalHost, normalizeCrawlUrl } from "./url";

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ");
}

function cleanText(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function getAttr(tag: string, attrName: string): string | null {
  const re = new RegExp(`\\b${attrName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const m = tag.match(re);
  if (!m) return null;
  return decodeEntities((m[1] ?? m[2] ?? m[3] ?? "").trim());
}

function parseIntOrNull(val: string | null): number | null {
  if (!val) return null;
  const n = Number.parseInt(val, 10);
  return Number.isFinite(n) ? n : null;
}

export interface ParsedHtmlPage {
  canonical: string | null;
  robotsMeta: string | null;
  title: string | null;
  metaDescription: string | null;
  h1H6: HeadingEntry[];
  wordCount: number;
  contentHash: string;
  images: ImageAsset[];
  internalLinks: string[];
  externalLinks: string[];
  hreflang: HreflangEntry[];
  jsonLd: string[];
  openGraph: Record<string, string>;
  needsJsRendering: boolean;
  plainText: string;
}

export function parseHtmlPage(html: string, pageUrl: string): ParsedHtmlPage {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? cleanText(titleMatch[1]) || null : null;

  let metaDescription: string | null = null;
  let robotsMeta: string | null = null;
  const openGraph: Record<string, string> = {};

  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const name = (getAttr(tag, "name") ?? "").toLowerCase();
    const prop = (getAttr(tag, "property") ?? "").toLowerCase();
    const content = getAttr(tag, "content");
    if (content === null) continue;

    if (name === "description" && !metaDescription) {
      metaDescription = content.trim() || null;
    } else if (name === "robots" && !robotsMeta) {
      robotsMeta = content.trim() || null;
    }
    if (prop.startsWith("og:")) {
      openGraph[prop] = content.trim();
    }
  }

  let canonical: string | null = null;
  const hreflang: HreflangEntry[] = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    const rel = (getAttr(tag, "rel") ?? "").toLowerCase().split(/\s+/);
    const href = getAttr(tag, "href");
    if (!href) continue;

    if (rel.includes("canonical") && !canonical) {
      canonical = normalizeCrawlUrl(href, pageUrl, false) ?? href.trim();
    }
    if (rel.includes("alternate")) {
      const lang = getAttr(tag, "hreflang");
      if (lang) {
        hreflang.push({ lang: lang.trim(), href: normalizeCrawlUrl(href, pageUrl, false) ?? href.trim() });
      }
    }
  }

  const jsonLd: string[] = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const raw = m[1].trim();
    if (raw) jsonLd.push(raw);
  }

  const bodyOnly = html
    .replace(/<(script|style|noscript|svg)[^>]*>[\s\S]*?<\/\1>/gi, " ");

  const h1H6: HeadingEntry[] = [];
  for (const m of bodyOnly.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    const level = Number(m[1]) as 1 | 2 | 3 | 4 | 5 | 6;
    const text = cleanText(m[2]);
    if (text) h1H6.push({ level, text });
  }

  const images: ImageAsset[] = [];
  for (const m of bodyOnly.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const rawSrc = getAttr(tag, "src") ?? getAttr(tag, "data-src");
    if (!rawSrc) continue;
    const resolvedSrc = normalizeCrawlUrl(rawSrc, pageUrl, false) ?? rawSrc;
    const altAttr = getAttr(tag, "alt");
    images.push({
      src: resolvedSrc,
      alt: altAttr,
      width: parseIntOrNull(getAttr(tag, "width")),
      height: parseIntOrNull(getAttr(tag, "height")),
      fileSize: parseIntOrNull(getAttr(tag, "data-size") ?? getAttr(tag, "data-file-size")),
    });
  }

  const internalSet = new Set<string>();
  const externalSet = new Set<string>();
  let pageHost = "";
  try {
    pageHost = canonicalHost(new URL(pageUrl).hostname);
  } catch {
    pageHost = "";
  }

  for (const m of bodyOnly.matchAll(/<a\b[^>]*>/gi)) {
    const tag = m[0];
    const href = getAttr(tag, "href");
    if (!href || href.startsWith("#") || /^(?:mailto:|tel:|javascript:)/i.test(href)) continue;
    const normalized = normalizeCrawlUrl(href, pageUrl, false);
    if (!normalized) continue;
    try {
      const host = canonicalHost(new URL(normalized).hostname);
      if (host === pageHost) {
        internalSet.add(normalized);
      } else {
        externalSet.add(normalized);
      }
    } catch {
      // ignore
    }
  }

  const plainText = cleanText(bodyOnly);
  const words = plainText ? plainText.split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;
  const contentHash = createHash("sha256").update(plainText.toLowerCase()).digest("hex");

  const lowerHtml = html.toLowerCase();
  const hasSpaShell =
    /<div[^>]+id=["'](?:root|app|__next)["'][^>]*>\s*<\/div>/i.test(html) ||
    lowerHtml.includes("enable javascript") ||
    lowerHtml.includes("requires javascript") ||
    lowerHtml.includes("cf-browser-verification");
  const needsJsRendering = wordCount < 25 && (hasSpaShell || /<noscript/i.test(html));

  return {
    canonical,
    robotsMeta,
    title,
    metaDescription,
    h1H6,
    wordCount,
    contentHash,
    images,
    internalLinks: [...internalSet],
    externalLinks: [...externalSet],
    hreflang,
    jsonLd,
    openGraph,
    needsJsRendering,
    plainText,
  };
}

