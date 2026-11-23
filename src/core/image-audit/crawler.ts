import type {
  CrawlLogEntry,
  ImageAuditItem,
  ImageAuditOptions,
  ImageAuditSummary,
  ImageIssueCode,
} from "./types.ts";

const CRAWLER_USER_AGENT =
  "Mozilla/5.0 (compatible; CogwheelImageAudit/2.7; +https://cogwheel-seo-templates.vercel.app)";

function normalizeUrl(raw: string, baseUrl?: string): string | null {
  try {
    let input = raw.trim();
    if (!input) return null;
    if (input.startsWith("//")) input = "https:" + input;
    const resolved = baseUrl ? new URL(input, baseUrl) : new URL(input);
    if (!["http:", "https:"].includes(resolved.protocol)) return null;
    resolved.hash = "";
    return resolved.href;
  } catch {
    return null;
  }
}

function cleanFilenameTitle(imageUrl: string): string {
  try {
    const pathname = new URL(imageUrl).pathname;
    const filename = pathname.split("/").pop() || "";
    // Remove query, extension, and common image suffixes
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

function generateOptimizedAltText(
  imageUrl: string,
  pageTitle: string | null,
  currentAlt: string | null,
  isHero: boolean
): string {
  if (currentAlt && currentAlt.trim().length > 15 && !currentAlt.includes(".jpg") && !currentAlt.includes(".png")) {
    return currentAlt.trim();
  }

  const cleanTitle = cleanFilenameTitle(imageUrl);
  const cleanSitePage = (pageTitle || "")
    .replace(/\s*[-|–|—]\s*.*$/, "")
    .replace(/[^\w\s]/g, " ")
    .trim();

  // If clean title is generic like "DSC001" or "IMG 1234"
  const isGenericFilename = /^(?:img|dsc|image|photo|pic|asset|upload|banner)[_\s-]*\d*$/i.test(cleanTitle);

  if (isGenericFilename) {
    if (isHero && cleanSitePage) {
      return `Primary visual showcase for ${cleanSitePage}`;
    }
    return cleanSitePage ? `Featured photography on ${cleanSitePage}` : "Descriptive photography showcase";
  }

  // Capitalize first letter of cleanTitle
  const formattedTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
  if (cleanSitePage && !formattedTitle.toLowerCase().includes(cleanSitePage.toLowerCase())) {
    return `${formattedTitle} featured at ${cleanSitePage}`;
  }
  return formattedTitle;
}

function detectImageFormat(url: string, contentType: string | null): string {
  const mime = (contentType || "").toLowerCase();
  if (mime.includes("webp")) return "WebP";
  if (mime.includes("avif")) return "AVIF";
  if (mime.includes("svg")) return "SVG";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "JPEG";
  if (mime.includes("png")) return "PNG";
  if (mime.includes("gif")) return "GIF";

  const lowerUrl = url.toLowerCase();
  if (lowerUrl.endsWith(".webp")) return "WebP";
  if (lowerUrl.endsWith(".avif")) return "AVIF";
  if (lowerUrl.endsWith(".svg")) return "SVG";
  if (lowerUrl.endsWith(".png")) return "PNG";
  if (lowerUrl.endsWith(".jpg") || lowerUrl.endsWith(".jpeg")) return "JPEG";
  if (lowerUrl.endsWith(".gif")) return "GIF";
  return "Unknown";
}

interface RawExtractedImage {
  src: string;
  alt: string | null;
  htmlWidth: number | null;
  htmlHeight: number | null;
  loading: "lazy" | "eager" | "auto" | "unspecified";
  elementType: "img" | "picture" | "source" | "data-lazy" | "css-background";
  sourceAttribute: string;
  srcsetCandidates?: string[];
  isAboveTheFoldCandidate: boolean;
}

export function extractImagesFromHtml(html: string, pageUrl: string): RawExtractedImage[] {
  const results: RawExtractedImage[] = [];
  const seenSrcs = new Set<string>();

  // 1. Standard <img> and lazy-loaded variants
  const imgRegex = /<img\b([^>]*)>/gi;
  let match: RegExpExecArray | null;
  let imgIndex = 0;

  while ((match = imgRegex.exec(html)) !== null) {
    imgIndex++;
    const attrsStr = match[1];

    const getAttr = (name: string): string | null => {
      const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
      const m = attrsStr.match(re);
      return m ? (m[1] ?? m[2] ?? m[3] ?? "").trim() : null;
    };

    const src =
      getAttr("src") ||
      getAttr("data-src") ||
      getAttr("data-original") ||
      getAttr("data-lazy-src") ||
      getAttr("data-lazy");

    const srcset = getAttr("srcset") || getAttr("data-srcset");
    const alt = getAttr("alt");
    const widthStr = getAttr("width");
    const heightStr = getAttr("height");
    const loadingStr = (getAttr("loading") || "").toLowerCase();

    const loading: "lazy" | "eager" | "auto" | "unspecified" =
      loadingStr === "lazy"
        ? "lazy"
        : loadingStr === "eager"
        ? "eager"
        : loadingStr === "auto"
        ? "auto"
        : "unspecified";

    const htmlWidth = widthStr && !isNaN(parseInt(widthStr, 10)) ? parseInt(widthStr, 10) : null;
    const htmlHeight = heightStr && !isNaN(parseInt(heightStr, 10)) ? parseInt(heightStr, 10) : null;

    let targetUrl: string | null = null;
    let sourceAttribute = "src";
    let candidates: string[] | undefined;

    if (src) {
      targetUrl = normalizeUrl(src, pageUrl);
      sourceAttribute = getAttr("src") ? "src" : "data-src";
    }

    if (srcset) {
      const list = srcset
        .split(",")
        .map((s) => s.trim().split(/\s+/)[0])
        .filter(Boolean);
      candidates = list.map((c) => normalizeUrl(c, pageUrl) ?? c);
      if (!targetUrl && list.length > 0) {
        targetUrl = normalizeUrl(list[0], pageUrl);
        sourceAttribute = "srcset";
      }
    }

    if (targetUrl && !seenSrcs.has(targetUrl)) {
      seenSrcs.add(targetUrl);
      results.push({
        src: targetUrl,
        alt: alt !== null ? alt.trim() : null,
        htmlWidth,
        htmlHeight,
        loading,
        elementType: getAttr("src") ? "img" : "data-lazy",
        sourceAttribute,
        srcsetCandidates: candidates,
        isAboveTheFoldCandidate: imgIndex <= 2,
      });
    }
  }

  // 2. <picture> and <source> elements
  const sourceRegex = /<source\b([^>]*)>/gi;
  while ((match = sourceRegex.exec(html)) !== null) {
    const attrsStr = match[1];
    const getAttr = (name: string): string | null => {
      const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
      const m = attrsStr.match(re);
      return m ? (m[1] ?? m[2] ?? m[3] ?? "").trim() : null;
    };

    const srcset = getAttr("srcset") || getAttr("data-srcset");
    if (srcset) {
      const first = srcset.split(",")[0].trim().split(/\s+/)[0];
      const targetUrl = normalizeUrl(first, pageUrl);
      if (targetUrl && !seenSrcs.has(targetUrl)) {
        seenSrcs.add(targetUrl);
        results.push({
          src: targetUrl,
          alt: null,
          htmlWidth: null,
          htmlHeight: null,
          loading: "unspecified",
          elementType: "source",
          sourceAttribute: "source srcset",
          isAboveTheFoldCandidate: false,
        });
      }
    }
  }

  // 3. CSS background images (inline styles)
  const bgRegex = /style\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  while ((match = bgRegex.exec(html)) !== null) {
    const styleContent = match[1] || match[2] || "";
    const bgMatch = styleContent.match(/background(?:-image)?\s*:\s*url\(\s*(?:['"]?)(.*?)(?:['"]?)\s*\)/i);
    if (bgMatch && bgMatch[1]) {
      const rawBg = bgMatch[1].trim();
      const targetUrl = normalizeUrl(rawBg, pageUrl);
      if (targetUrl && !seenSrcs.has(targetUrl)) {
        seenSrcs.add(targetUrl);
        results.push({
          src: targetUrl,
          alt: null,
          htmlWidth: null,
          htmlHeight: null,
          loading: "unspecified",
          elementType: "css-background",
          sourceAttribute: "css-background-image",
          isAboveTheFoldCandidate: false,
        });
      }
    }
  }

  return results;
}

export function extractInternalLinks(html: string, pageUrl: string, origin: string, allowSubdomains: boolean): string[] {
  const links: string[] = [];
  const linkRegex = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))[^>]*>/gi;
  let match: RegExpExecArray | null;

  let originHost = "";
  try {
    originHost = new URL(origin).hostname.toLowerCase();
  } catch {
    return [];
  }

  while ((match = linkRegex.exec(html)) !== null) {
    const rawHref = match[1] ?? match[2] ?? match[3] ?? "";
    if (!rawHref || rawHref.startsWith("#") || /^(?:mailto:|tel:|javascript:)/i.test(rawHref)) continue;

    const normalized = normalizeUrl(rawHref, pageUrl);
    if (!normalized) continue;

    try {
      const u = new URL(normalized);
      const host = u.hostname.toLowerCase();
      const isInternal = allowSubdomains
        ? host === originHost || host.endsWith("." + originHost)
        : host === originHost;

      // Filter out non-HTML file downloads (pdf, zip, mp4, etc.)
      const isPage = !/\.(pdf|zip|mp4|mp3|exe|docx?|xlsx?|tar|gz)$/i.test(u.pathname);

      if (isInternal && isPage) {
        links.push(normalized);
      }
    } catch {
      // ignore
    }
  }

  return Array.from(new Set(links));
}

export async function inspectImageNetwork(imageUrl: string, timeoutMs = 8000): Promise<{
  httpStatus: number;
  contentType: string | null;
  contentLength: number | null;
  isBroken: boolean;
}> {
  try {
    const res = await fetch(imageUrl, {
      method: "HEAD",
      headers: {
        "User-Agent": CRAWLER_USER_AGENT,
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    const status = res.status;
    const contentType = res.headers.get("content-type");
    const lenHeader = res.headers.get("content-length");
    const contentLength = lenHeader && !isNaN(parseInt(lenHeader, 10)) ? parseInt(lenHeader, 10) : null;

    if (status >= 400) {
      return { httpStatus: status, contentType, contentLength, isBroken: true };
    }

    return {
      httpStatus: status,
      contentType,
      contentLength,
      isBroken: false,
    };
  } catch {
    // If HEAD is blocked or fails, fallback to range GET or report broken
    try {
      const getRes = await fetch(imageUrl, {
        method: "GET",
        headers: {
          "User-Agent": CRAWLER_USER_AGENT,
          Range: "bytes=0-1024",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const status = getRes.status;
      const contentType = getRes.headers.get("content-type");
      const len = getRes.headers.get("content-range")?.split("/")?.[1] || getRes.headers.get("content-length");
      const contentLength = len && !isNaN(parseInt(len, 10)) ? parseInt(len, 10) : null;

      return {
        httpStatus: status,
        contentType,
        contentLength,
        isBroken: status >= 400,
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
}

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
  const delayMs = options.delayMs ?? 150;
  const timeoutMs = options.timeoutMs ?? 10000;
  const includeSubdomains = Boolean(options.includeSubdomains);
  const sizeThresholdKb = options.sizeThresholdKb ?? 100;

  const validStart = normalizeUrl(startUrl);
  if (!validStart) {
    throw new Error(`Invalid target website URL provided: "${startUrl}". Must be a valid http/https address.`);
  }

  const origin = new URL(validStart).origin;
  const queue: string[] = [validStart];
  const visited = new Set<string>();

  // Map of canonical image URL -> pages where found
  interface ImageDiscovery {
    raw: RawExtractedImage;
    pageUrl: string;
    pageTitle: string;
    pageStatus: number;
  }
  const imageMap = new Map<string, ImageDiscovery[]>();
  const crawlLog: CrawlLogEntry[] = [];

  while (queue.length > 0 && visited.size < maxPages) {
    const currentUrl = queue.shift()!;
    if (visited.has(currentUrl)) continue;
    visited.add(currentUrl);

    onProgress?.({
      pagesScanned: visited.size,
      totalInQueue: queue.length + visited.size,
      imagesDiscovered: imageMap.size,
      currentUrl,
    });

    const pageStartTime = Date.now();
    try {
      const pageRes = await fetch(currentUrl, {
        headers: {
          "User-Agent": CRAWLER_USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

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
          notes: `Non-HTML content type (${contentType})`,
        });
        continue;
      }

      const html = await pageRes.text();
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const pageTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "Untitled Page";

      // Extract images from this page
      const extractedImages = extractImagesFromHtml(html, currentUrl);
      for (const img of extractedImages) {
        const list = imageMap.get(img.src) || [];
        list.push({
          raw: img,
          pageUrl: currentUrl,
          pageTitle,
          pageStatus: status,
        });
        imageMap.set(img.src, list);
      }

      crawlLog.push({
        url: currentUrl,
        statusCode: status,
        title: pageTitle,
        responseTimeMs,
        imagesFound: extractedImages.length,
        status: "success",
      });

      // Extract links for crawl queue if under limit
      if (visited.size + queue.length < maxPages * 2) {
        const links = extractInternalLinks(html, currentUrl, origin, includeSubdomains);
        for (const link of links) {
          if (!visited.has(link) && !queue.includes(link)) {
            queue.push(link);
          }
        }
      }
    } catch (err) {
      crawlLog.push({
        url: currentUrl,
        statusCode: 0,
        title: null,
        responseTimeMs: Date.now() - pageStartTime,
        imagesFound: 0,
        status: "error",
        notes: (err as Error).message || "Request timed out or connection failed",
      });
    }

    if (delayMs > 0 && queue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // Inspect discovered images (up to 200 unique assets in parallel batches of 10)
  const imageEntries = Array.from(imageMap.entries()).slice(0, 300);
  const items: ImageAuditItem[] = [];

  const BATCH_SIZE = 8;
  for (let i = 0; i < imageEntries.length; i += BATCH_SIZE) {
    const batch = imageEntries.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async ([imageUrl, occurrences]) => {
        const primary = occurrences[0];
        const net = await inspectImageNetwork(imageUrl);

        const format = detectImageFormat(imageUrl, net.contentType);
        const fileSizeBytes = net.contentLength;
        const fileSizeKb = fileSizeBytes ? Math.round((fileSizeBytes / 1024) * 10) / 10 : null;

        const currentAlt = primary.raw.alt;
        const isDecorative = currentAlt === "";
        const isAltMissing = currentAlt === null;

        const proposedAlt = generateOptimizedAltText(
          imageUrl,
          primary.pageTitle,
          currentAlt,
          primary.raw.isAboveTheFoldCandidate
        );

        const issues: ImageAuditItem["issues"] = [];

        // 1. Alt issues
        if (isAltMissing) {
          issues.push({
            code: "missing-alt",
            label: "Missing Alt Attribute",
            description: "Image tag lacks an alt attribute entirely, hurting screen readers and image SEO.",
            severity: "high",
          });
        } else if (isDecorative && !primary.raw.isAboveTheFoldCandidate && !imageUrl.includes("icon") && !imageUrl.includes("logo")) {
          // If empty alt but looks like editorial content
          issues.push({
            code: "empty-alt-suspicious",
            label: "Empty Alt Text (Verify if Decorative)",
            description: "alt=\"\" is correct for purely decorative icons/spacers, but content images require descriptive alt text.",
            severity: "info",
          });
        }

        // 2. File size
        if (fileSizeKb && fileSizeKb > sizeThresholdKb) {
          issues.push({
            code: "oversized-file",
            label: `Oversized Image File (${fileSizeKb} KB)`,
            description: `File exceeds the recommended ${sizeThresholdKb} KB threshold. Compressing can save significant bandwidth.`,
            severity: fileSizeKb > 300 ? "high" : "medium",
          });
        }

        // 3. Format
        if (["JPEG", "PNG", "GIF"].includes(format)) {
          issues.push({
            code: "legacy-format",
            label: `Legacy Image Format (${format})`,
            description: `Serving next-gen WebP or AVIF formats typically reduces asset weight by 30% to 70%.`,
            severity: "medium",
          });
        }

        // 4. Missing intrinsic dimensions
        if (!primary.raw.htmlWidth || !primary.raw.htmlHeight) {
          issues.push({
            code: "missing-dimensions",
            label: "Missing HTML Dimensions",
            description: "Missing width/height attributes on <img> tags trigger Cumulative Layout Shift (CLS).",
            severity: "medium",
          });
        }

        // 5. Broken image
        if (net.isBroken) {
          issues.push({
            code: "broken-image",
            label: `Broken Image URL (${net.httpStatus || "Connection Error"})`,
            description: "Image URL returned an error or is unreachable.",
            severity: "high",
          });
        }

        // 6. Above the fold lazy loading
        if (primary.raw.isAboveTheFoldCandidate && primary.raw.loading === "lazy") {
          issues.push({
            code: "above-fold-lazy",
            label: "Lazy Loading on Hero/Above-The-Fold Asset",
            description: "Lazy-loading above-the-fold images delays Largest Contentful Paint (LCP). Use priority loading instead.",
            severity: "medium",
          });
        }

        // 7. Duplicate asset
        if (occurrences.length > 1) {
          issues.push({
            code: "duplicate-asset",
            label: `Asset Used on ${occurrences.length} Pages`,
            description: `This exact image asset is embedded across multiple pages. Ensure it is cached via CDN.`,
            severity: "info",
          });
        }

        // Priority calculation
        let priority: ImageAuditItem["priority"] = "Good";
        if (issues.some((iss) => iss.severity === "high")) {
          priority = "High";
        } else if (issues.some((iss) => iss.severity === "medium")) {
          priority = "Medium";
        } else if (issues.length > 0) {
          priority = "Low";
        }

        // Specific actionable recommendation
        let rec = "Asset is in healthy condition.";
        if (net.isBroken) {
          rec = `Fix or remove broken image link (HTTP ${net.httpStatus}).`;
        } else if (isAltMissing) {
          rec = `Add descriptive alt text: "${proposedAlt}".`;
        } else if (fileSizeKb && fileSizeKb > sizeThresholdKb) {
          rec = `Compress asset to under ${sizeThresholdKb}KB and convert to WebP/AVIF.`;
        } else if (["JPEG", "PNG"].includes(format)) {
          rec = `Convert from ${format} to WebP or AVIF for lighter mobile loading.`;
        } else if (!primary.raw.htmlWidth || !primary.raw.htmlHeight) {
          rec = `Add explicit width and height attributes to prevent CLS layout shift.`;
        } else if (primary.raw.isAboveTheFoldCandidate && primary.raw.loading === "lazy") {
          rec = `Remove loading="lazy" or add fetchpriority="high" to improve LCP speed.`;
        }

        items.push({
          id: `img-${items.length + 1}`,
          imageUrl,
          pageUrl: primary.pageUrl,
          pageTitle: primary.pageTitle,
          pageStatus: primary.pageStatus,
          currentAlt: primary.raw.alt,
          proposedAlt,
          isDecorative,
          htmlWidth: primary.raw.htmlWidth,
          htmlHeight: primary.raw.htmlHeight,
          naturalWidth: null,
          naturalHeight: null,
          fileSizeBytes,
          fileSizeKb,
          format,
          mimeType: net.contentType || "image/unknown",
          elementType: primary.raw.elementType,
          sourceAttribute: primary.raw.sourceAttribute,
          srcsetCandidates: primary.raw.srcsetCandidates,
          loadingAttribute: primary.raw.loading,
          httpStatus: net.httpStatus,
          isBroken: net.isBroken,
          occurrenceCount: occurrences.length,
          issues,
          recommendation: rec,
          priority,
        });
      })
    );
  }

  // Summary aggregation
  const formatBreakdown: Record<string, number> = {};
  let brokenCount = 0;
  let oversizedCount = 0;
  let missingAltCount = 0;
  let decorativeCount = 0;
  let missingDimsCount = 0;
  let legacyCount = 0;
  let aboveFoldLazyCount = 0;

  for (const item of items) {
    formatBreakdown[item.format] = (formatBreakdown[item.format] || 0) + 1;
    if (item.isBroken) brokenCount++;
    if (item.fileSizeKb && item.fileSizeKb > sizeThresholdKb) oversizedCount++;
    if (item.currentAlt === null) missingAltCount++;
    if (item.isDecorative) decorativeCount++;
    if (!item.htmlWidth || !item.htmlHeight) missingDimsCount++;
    if (["JPEG", "PNG", "GIF"].includes(item.format)) legacyCount++;
    if (item.issues.some((iss) => iss.code === "above-fold-lazy")) aboveFoldLazyCount++;
  }

  const topFindings: string[] = [];
  if (brokenCount > 0) topFindings.push(`Found ${brokenCount} broken image asset(s) returning HTTP errors.`);
  if (missingAltCount > 0) topFindings.push(`${missingAltCount} image(s) completely lack alt text attributes.`);
  if (oversizedCount > 0) topFindings.push(`${oversizedCount} image(s) exceed the ${sizeThresholdKb}KB threshold.`);
  if (legacyCount > 0) topFindings.push(`${legacyCount} asset(s) are in legacy JPEG/PNG formats that can be converted to modern WebP/AVIF.`);
  if (missingDimsCount > 0) topFindings.push(`${missingDimsCount} image(s) lack explicit HTML width/height dimensions (CLS risk).`);
  if (topFindings.length === 0) topFindings.push("All crawled image assets meet basic SEO & optimization standards.");

  const summary: ImageAuditSummary = {
    websiteUrl: startUrl,
    origin,
    crawledAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    maxPagesLimit: maxPages,
    pagesScanned: visited.size,
    pagesFailed: crawlLog.filter((c) => c.status === "error").length,
    totalImagesFound: items.length,
    uniqueImagesCount: items.length,
    brokenImagesCount: brokenCount,
    oversizedImagesCount: oversizedCount,
    missingAltCount,
    decorativeEmptyAltCount: decorativeCount,
    missingDimensionsCount: missingDimsCount,
    legacyFormatCount: legacyCount,
    aboveFoldLazyCount,
    formatBreakdown,
    topFindings,
  };

  return { summary, items, crawlLog };
}
