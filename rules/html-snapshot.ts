/**
 * Lightweight HTML → PageSnapshot builder.
 *
 * Used as a dependency-free fallback when a full DOM is unavailable (crawler
 * backend, tests, CI). The Chrome extension uses its controlled DOM extraction
 * pass instead and produces the same PageSnapshot shape.
 */

import type {
  HeadingEntry,
  ImageAsset,
  JsonLdNode,
  LinkEntry,
  PageSnapshot,
} from "./types.ts";

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );
}

function getAttr(tag: string, name: string): string | null {
  const pattern = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = pattern.exec(tag);
  if (!match) {
    return null;
  }
  return match[1] ?? match[2] ?? match[3] ?? null;
}

function firstMatch(html: string, pattern: RegExp): string | null {
  const match = pattern.exec(html);
  return match && match[1] !== undefined ? decodeEntities(match[1].trim()) : null;
}

function metaContent(html: string, attribute: "name" | "property", key: string): string | null {
  const pattern = new RegExp(
    `<meta[^>]+${attribute}\\s*=\\s*["']${key}["'][^>]*>`,
    "i"
  );
  const tag = pattern.exec(html);
  if (!tag) {
    return null;
  }
  const content = getAttr(tag[0], "content");
  return content !== null ? decodeEntities(content.trim()) : null;
}

function parseHeadings(html: string): HeadingEntry[] {
  const headings: HeadingEntry[] = [];
  const pattern = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const level = Number(match[1]) as HeadingEntry["level"];
    if (!HEADING_LEVELS.includes(level)) {
      continue;
    }
    headings.push({ level, text: stripTags(match[2] ?? "").replace(/\s+/g, " ").trim() });
  }
  return headings;
}

function parseImages(html: string): ImageAsset[] {
  const images: ImageAsset[] = [];
  const pattern = /<img\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const tag = match[0];
    const src = getAttr(tag, "src");
    if (!src) {
      continue;
    }
    const width = getAttr(tag, "width");
    const height = getAttr(tag, "height");
    const formatMatch = /\.([a-z0-9]+)(?:\?|#|$)/i.exec(src);
    images.push({
      src,
      alt: getAttr(tag, "alt"),
      width: width !== null && /^\d+$/.test(width) ? Number(width) : null,
      height: height !== null && /^\d+$/.test(height) ? Number(height) : null,
      format: formatMatch && formatMatch[1] ? formatMatch[1].toLowerCase() : null,
      loading: getAttr(tag, "loading"),
    });
  }
  return images;
}

function parseLinks(html: string, hostname: string): LinkEntry[] {
  const links: LinkEntry[] = [];
  const pattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const attrs = match[1] ?? "";
    const href = getAttr(`<a ${attrs}>`, "href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      continue;
    }
    let external = false;
    try {
      const resolved = new URL(href, `https://${hostname}`);
      external = resolved.hostname !== hostname;
    } catch {
      external = false;
    }
    links.push({
      href,
      text: stripTags(match[2] ?? "").replace(/\s+/g, " ").trim(),
      external,
      rel: getAttr(`<a ${attrs}>`, "rel"),
    });
  }
  return links;
}

function parseJsonLd(html: string): JsonLdNode[] {
  const nodes: JsonLdNode[] = [];
  const pattern =
    /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const raw = (match[1] ?? "").trim();
    if (!raw) {
      continue;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (entry && typeof entry === "object") {
            nodes.push(entry as JsonLdNode);
          }
        }
      } else if (parsed && typeof parsed === "object") {
        const node = parsed as JsonLdNode & { "@graph"?: unknown };
        if (Array.isArray(node["@graph"])) {
          for (const entry of node["@graph"]) {
            if (entry && typeof entry === "object") {
              nodes.push(entry as JsonLdNode);
            }
          }
        } else {
          nodes.push(node);
        }
      }
    } catch {
      /* skip malformed JSON-LD blocks; technical rules flag their absence */
    }
  }
  return nodes;
}

function parseScriptSrcs(html: string): string[] {
  const srcs: string[] = [];
  const pattern = /<script[^>]+src\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    if (match[1]) {
      srcs.push(match[1]);
    }
  }
  return srcs;
}

function detectReservationWidgets(html: string): boolean {
  const lower = html.toLowerCase();
  if (/name\s*=\s*["'](checkin|check-in|checkout|check-out|arrival|departure)["']/.test(lower)) {
    return true;
  }
  return /(booking|reservation|book-now|bookingform)[-_a-z0-9]*["'\s]/.test(lower) &&
    /type\s*=\s*["']date["']/.test(lower);
}

function countWords(text: string): number {
  const tokens = text.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token));
  return tokens.length;
}

export interface BuildSnapshotOptions {
  /** Overrides applied after parsing (e.g. measured render dimensions). */
  overrides?: Partial<PageSnapshot>;
}

/**
 * Parse a raw HTML document into a normalized PageSnapshot.
 */
export function buildSnapshotFromHtml(
  html: string,
  url: string,
  options: BuildSnapshotOptions = {}
): PageSnapshot {
  let hostname = "";
  try {
    hostname = new URL(url).hostname;
  } catch {
    hostname = url.replace(/^https?:\/\//i, "").split("/")[0] ?? "";
  }

  const textContent = stripTags(html).replace(/\s+/g, " ").trim();

  const snapshot: PageSnapshot = {
    url,
    hostname,
    title: firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i) ?? "",
    metaDescription: metaContent(html, "name", "description") ?? "",
    canonical: firstMatch(
      html,
      /<link[^>]+rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["']([^"']+)["'][^>]*>/i
    ),
    metaRobots: metaContent(html, "name", "robots"),
    language: firstMatch(html, /<html[^>]+lang\s*=\s*["']([^"']+)["']/i),
    headings: parseHeadings(html),
    images: parseImages(html),
    links: parseLinks(html, hostname),
    wordCount: countWords(textContent),
    textContent,
    jsonLd: parseJsonLd(html),
    scriptSrcs: parseScriptSrcs(html),
    openGraph: {
      title: metaContent(html, "property", "og:title"),
      description: metaContent(html, "property", "og:description"),
      image: metaContent(html, "property", "og:image"),
      url: metaContent(html, "property", "og:url"),
      type: metaContent(html, "property", "og:type"),
    },
    twitter: {
      card: metaContent(html, "name", "twitter:card"),
      title: metaContent(html, "name", "twitter:title"),
      description: metaContent(html, "name", "twitter:description"),
      image: metaContent(html, "name", "twitter:image"),
    },
    hasViewport: /<meta[^>]+name\s*=\s*["']viewport["']/i.test(html),
    reservationWidgets: detectReservationWidgets(html),
  };

  return { ...snapshot, ...options.overrides };
}

/**
 * Build a PageSnapshot from a partial object, filling safe defaults. Useful for
 * DOM-extracted payloads and unit tests.
 */
export function createSnapshot(partial: Partial<PageSnapshot> & { url: string }): PageSnapshot {
  let hostname = partial.hostname ?? "";
  if (!hostname) {
    try {
      hostname = new URL(partial.url).hostname;
    } catch {
      hostname = partial.url.replace(/^https?:\/\//i, "").split("/")[0] ?? "";
    }
  }
  return {
    url: partial.url,
    hostname,
    title: partial.title ?? "",
    metaDescription: partial.metaDescription ?? "",
    canonical: partial.canonical ?? null,
    metaRobots: partial.metaRobots ?? null,
    language: partial.language ?? null,
    headings: partial.headings ?? [],
    images: partial.images ?? [],
    links: partial.links ?? [],
    wordCount: partial.wordCount ?? 0,
    textContent: partial.textContent ?? "",
    jsonLd: partial.jsonLd ?? [],
    scriptSrcs: partial.scriptSrcs ?? [],
    openGraph: partial.openGraph ?? {},
    twitter: partial.twitter ?? {},
    hasViewport: partial.hasViewport ?? false,
    reservationWidgets: partial.reservationWidgets ?? false,
    fetchStatus: partial.fetchStatus ?? null,
  };
}
