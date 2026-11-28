import type { HeadingItem, HeadingLevelTag, PageHeadingAudit } from "./types.ts";

export function toTitleCase(str: string): string {
  if (!str) return "";
  const smallWords = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "if", "in", "nor", "of", "on", "or", "so", "the", "to", "up", "yet", "with"]);
  const romanNumerals = new Set(["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"]);
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((word, index, arr) => {
      // Keep acronyms or brands intact if recognized
      if (word === "rfp") return "RFP";
      if (word === "faq" || word === "faqs") return "FAQ";
      if (word === "h1" || word === "h2" || word === "h3") return word.toUpperCase();
      if (romanNumerals.has(word)) return word.toUpperCase();
      if (index === 0 || index === arr.length - 1 || !smallWords.has(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word;
    })
    .join(" ");
}

export function classifyPageUrl(urlStr: string): { category: string; subCategory: string } {
  try {
    const pathname = new URL(urlStr).pathname.toLowerCase();
    if (pathname === "" || pathname === "/" || pathname === "/home") {
      return { category: "HOME PAGE", subCategory: "Home" };
    }
    if (pathname.includes("/accommodation") || pathname.includes("/room") || pathname.includes("/suite")) {
      const slug = pathname.split("/").filter(Boolean).pop() || "overview";
      return { category: "Accommodations", subCategory: toTitleCase(slug.replace(/[-_]+/g, " ")) };
    }
    if (pathname.includes("/dining") || pathname.includes("/restaurant") || pathname.includes("/rooftop") || pathname.includes("/steakhouse")) {
      const slug = pathname.split("/").filter(Boolean).pop() || "overview";
      return { category: "DINING", subCategory: toTitleCase(slug.replace(/[-_]+/g, " ")) };
    }
    if (pathname.includes("/gather") || pathname.includes("/meeting") || pathname.includes("/event") || pathname.includes("/wedding") || pathname.includes("/rfp")) {
      const slug = pathname.split("/").filter(Boolean).pop() || "overview";
      return { category: "MEETING & EVENTS", subCategory: toTitleCase(slug.replace(/[-_]+/g, " ")) };
    }
    if (pathname.includes("/experience") || pathname.includes("/amenit") || pathname.includes("/art") || pathname.includes("/history") || pathname.includes("/pet")) {
      const slug = pathname.split("/").filter(Boolean).pop() || "overview";
      return { category: "EXPERIENCE", subCategory: toTitleCase(slug.replace(/[-_]+/g, " ")) };
    }
    if (pathname.includes("/offer") || pathname.includes("/package") || pathname.includes("/deal") || pathname.includes("/special")) {
      const slug = pathname.split("/").filter(Boolean).pop() || "overview";
      return { category: "Offers & Packages", subCategory: toTitleCase(slug.replace(/[-_]+/g, " ")) };
    }
    if (pathname.includes("/blog") || pathname.includes("/gallery") || pathname.includes("/faq") || pathname.includes("/calendar")) {
      const slug = pathname.split("/").filter(Boolean).pop() || "overview";
      return { category: "DISCOVER", subCategory: toTitleCase(slug.replace(/[-_]+/g, " ")) };
    }
    const fallbackSlug = pathname.split("/").filter(Boolean).pop() || "page";
    return { category: "General Pages", subCategory: toTitleCase(fallbackSlug.replace(/[-_]+/g, " ")) };
  } catch {
    return { category: "General Pages", subCategory: "Page" };
  }
}

export function deriveTargetKeyword(urlStr: string, pageTitle: string): string {
  try {
    const pathname = new URL(urlStr).pathname.toLowerCase().replace(/\/+$/, "");
    if (!pathname || pathname === "") return "Downtown Portland Hotels";

    // Known Example Hotel mapping matching reference template
    if (pathname.includes("one-bedroom-suite")) return "One Bedroom Suite Downtown Portland";
    if (pathname.includes("deluxe-room")) return "Deluxe Rooms Downtown Portland";
    if (pathname.includes("studio-suite")) return "Studio Hotel Suite Portland";
    if (pathname.includes("signature-suite")) return "Luxury Suite Downtown Portland";
    if (pathname.includes("superior-room")) return "Superior Hotel Rooms Portland";
    if (pathname.includes("historic-suite")) return "Historic Suite";
    if (pathname.includes("rooftop")) return "Rooftop Restaurant In Portland";
    if (pathname.includes("steakhouse")) return "Steakhouse In Portland: The Steakhouse";
    if (pathname.includes("in-room-dining")) return "Portland Luxury In-Room Dining";
    if (pathname.includes("dining")) return "Downtown Portland Restaurants At Example Hotel";
    if (pathname.includes("experience-portland")) return "Things To Do In Downtown Portland";
    if (pathname.includes("amenities")) return "Downtown Portland Hotel Amenities";
    if (/(^|\/|-|_)art(\/|-|_|$)/.test(pathname)) return "Curated Hotel Art Collection Portland";
    if (pathname.includes("hotel-history")) return "Historic Historic Building Portland";
    if (pathname.includes("offers-packages")) return "Portland Hotel Deals & Vacation Packages";
    if (pathname.includes("gather")) return "Downtown Portland Meeting & Event Spaces";
    if (pathname.includes("meetings")) return "Portland Conference & Meeting Venues";
    if (pathname.includes("weddings")) return "Luxury Portland Wedding Venue";
    if (pathname.includes("event-rfp-submission")) return "Portland Event Venue RFP Submission";
    if (pathname.includes("blogs")) return "Portland Travel Blog & Stories";
    if (pathname.includes("events-calendar")) return "Downtown Portland Events Calendar";
    if (pathname.includes("frequently-asked-questions")) return "Example Hotel Portland Hotel FAQs";
    if (pathname.includes("gallery")) return "Example Hotel Photo Gallery";

    // Fallback based on clean page title
    const cleanTitle = pageTitle
      .replace(/\s*[-|–|—]\s*.*$/, "")
      .replace(/[^\w\s]/g, " ")
      .trim();
    if (cleanTitle) {
      return `${toTitleCase(cleanTitle)} Portland`;
    }

    const slug = pathname.split("/").filter(Boolean).pop() || "hotel";
    return toTitleCase(slug.replace(/[-_]+/g, " ")) + " Portland";
  } catch {
    return "Downtown Portland Hotel";
  }
}

export interface RawExtractedHeading {
  tag: HeadingLevelTag;
  text: string;
  position: number;
}

export function analyzeAndOptimizeHeadings(
  rawHeadings: RawExtractedHeading[],
  pageUrl: string,
  pageTitle: string
): {
  headings: HeadingItem[];
  h1Count: number;
  h2Count: number;
  h3Count: number;
  h4Count: number;
  hasSkippedLevels: boolean;
  issues: string[];
  recommendationSummary: string;
} {
  const targetKeyword = deriveTargetKeyword(pageUrl, pageTitle);
  const isHomePage = new URL(pageUrl).pathname === "/" || new URL(pageUrl).pathname === "";

  const headings: HeadingItem[] = [];
  const pageIssues: string[] = [];

  let h1Count = 0;
  let h2Count = 0;
  let h3Count = 0;
  let h4Count = 0;
  let hasSkippedLevels = false;

  let currentLevelNum = 0;
  let primaryH1Found = false;

  rawHeadings.forEach((raw, idx) => {
    const rawText = raw.text.trim();
    const tag = raw.tag;

    const itemIssues: HeadingItem["issues"] = [];
    let isDecorativeOrWidget = false;

    // Detect empty heading
    if (!rawText) {
      itemIssues.push({
        type: "empty-heading",
        label: "Empty Heading Element",
        description: `Found empty <${tag}> tag containing no visible text.`,
        severity: "medium",
      });
    }

    // Detect template placeholder like '+page.title+'
    if (rawText.includes("+page.title+") || rawText.includes("{{") || rawText.includes("${")) {
      itemIssues.push({
        type: "template-placeholder",
        label: "Unrendered Template Variable",
        description: `Heading contains unresolved script or template variable syntax ("${rawText}").`,
        severity: "high",
      });
    }

    // Detect all caps shouting
    if (rawText.length > 5 && rawText === rawText.toUpperCase() && /[A-Z]/.test(rawText)) {
      itemIssues.push({
        type: "all-caps-shouting",
        label: "All-Caps Heading Text",
        description: "Heading text is coded in ALL-CAPS; recommendation converts to accessible Title Case.",
        severity: "info",
      });
    }

    // Detect widget / navigation headings
    if (/^(?:check availability|menu|navigation|search|book now|quick links|footer)$/i.test(rawText)) {
      isDecorativeOrWidget = true;
      itemIssues.push({
        type: "generic-label",
        label: "Widget / Functional Heading",
        description: "Heading represents a booking widget or navigation control rather than informational page hierarchy.",
        severity: "low",
      });
    }

    // Heading level parsing
    const levelNum = tag === "TEXT" ? 0 : parseInt(tag.replace("H", ""), 10);
    if (tag === "H1") h1Count++;
    if (tag === "H2") h2Count++;
    if (tag === "H3") h3Count++;
    if (tag === "H4") h4Count++;

    // Inverted hierarchy: H2 or H3 before H1
    if (levelNum > 1 && !primaryH1Found) {
      itemIssues.push({
        type: "inverted-hierarchy",
        label: `Inverted Heading Order (<${tag}> before <H1>)`,
        description: `Found <${tag}> before the primary <H1> heading has been declared on the page.`,
        severity: "high",
      });
    }

    // Multiple H1s
    if (tag === "H1" && primaryH1Found) {
      itemIssues.push({
        type: "multiple-h1",
        label: "Multiple H1 Headings",
        description: "Page declares multiple <h1> elements. Single primary H1 is recommended for clear topical focus.",
        severity: "high",
      });
    }

    // Skipped level (e.g. H1 directly to H3)
    if (currentLevelNum > 0 && levelNum > currentLevelNum + 1 && !isDecorativeOrWidget) {
      hasSkippedLevels = true;
      itemIssues.push({
        type: "skipped-level",
        label: `Skipped Heading Level (H${currentLevelNum} -> H${levelNum})`,
        description: `Heading level skips intermediate hierarchy step from H${currentLevelNum} directly to H${levelNum}.`,
        severity: "medium",
      });
    }

    if (tag === "H1" && !isDecorativeOrWidget) {
      primaryH1Found = true;
    }
    if (levelNum > 0) {
      currentLevelNum = levelNum;
    }

    // -----------------------------------------------------------------------
    // Generate Proposed Optimized Heading & Level
    // -----------------------------------------------------------------------
    let optimizedLevel: HeadingLevelTag = tag;
    let optimizedText = rawText;

    // Clean placeholders
    if (rawText.includes("+page.title+")) {
      const pageSlug = new URL(pageUrl).pathname.split("/").filter(Boolean).pop() || "Overview";
      optimizedText = toTitleCase(pageSlug.replace(/[-_]+/g, " "));
    }

    // Convert shouting all-caps
    optimizedText = toTitleCase(optimizedText);

    // Primary H1 Optimization
    if (idx === 0 || (tag === "H1" && !headings.some((h) => h.optimizedLevel === "H1"))) {
      optimizedLevel = "H1";
      if (isHomePage) {
        optimizedText = `${targetKeyword} | Dressed To Impress`;
      } else if (!optimizedText.toLowerCase().includes(targetKeyword.toLowerCase())) {
        optimizedText = `${toTitleCase(optimizedText)} | ${targetKeyword}`;
      }
    } else if (tag === "H1") {
      // Demote second H1 to H2
      optimizedLevel = "H2";
    } else if (tag === "TEXT") {
      // Promote prominent styled text to H2 or H3
      optimizedLevel = idx <= 2 ? "H2" : "H3";
    } else if (tag === "H3" && currentLevelNum <= 1 && idx <= 3) {
      // Fix skipped H1 -> H3
      optimizedLevel = "H2";
    } else {
      optimizedLevel = tag;
    }

    // Widget text optimization
    if (isDecorativeOrWidget) {
      optimizedLevel = "H3";
      optimizedText = toTitleCase(rawText);
    }

    headings.push({
      id: `hdg-${idx + 1}`,
      tag,
      originalText: rawText,
      optimizedText,
      optimizedLevel,
      position: idx + 1,
      issues: itemIssues,
      isDecorativeOrWidget,
    });
  });

  // Check if page completely missed an H1
  if (h1Count === 0) {
    pageIssues.push("Missing <h1> element on page.");
    if (headings.length > 0) {
      headings[0].optimizedLevel = "H1";
      headings[0].optimizedText = isHomePage
        ? `${targetKeyword} | Dressed To Impress`
        : `${targetKeyword} — ${toTitleCase(headings[0].originalText || "Overview")}`;
    }
  }

  if (h1Count > 1) {
    pageIssues.push(`Found ${h1Count} separate <h1> tags (consolidated into 1 primary H1).`);
  }

  if (hasSkippedLevels) {
    pageIssues.push("Heading levels skip hierarchy ranks (e.g. H1 directly to H3).");
  }

  let recommendationSummary = "Heading hierarchy is well-structured and logical.";
  if (pageIssues.length > 0) {
    recommendationSummary = `Fix hierarchy: ${pageIssues.join(" ")}`;
  }

  return {
    headings,
    h1Count,
    h2Count,
    h3Count,
    h4Count,
    hasSkippedLevels,
    issues: pageIssues,
    recommendationSummary,
  };
}
