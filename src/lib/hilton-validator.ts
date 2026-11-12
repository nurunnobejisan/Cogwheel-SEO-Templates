import { isHalfAndHalfEligible, SECTION_RULES, type HiltonSectionId } from "@/config/hilton-rules";

export interface DiffSegment {
  text: string;
  kind: "plain" | "added" | "removed";
}

/**
 * Parse diff-marked copy (`**added**` and `~~removed~~`) into typed segments
 * for the UI diff viewer and Google Docs native bold/strikethrough styling.
 */
export function parseDiffSegments(input: string): DiffSegment[] {
  const segments: DiffSegment[] = [];
  const regex = /(\*\*[\s\S]+?\*\*|~~[\s\S]+?~~)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: input.slice(lastIndex, match.index), kind: "plain" });
    }
    const token = match[0];
    if (token.startsWith("**")) {
      segments.push({ text: token.slice(2, -2), kind: "added" });
    } else {
      segments.push({ text: token.slice(2, -2), kind: "removed" });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < input.length) {
    segments.push({ text: input.slice(lastIndex), kind: "plain" });
  }
  return segments;
}

/**
 * Compute the final live copy from diff-marked text:
 * keeps plain + `**added**` text, drops `~~removed~~` text, and normalizes spaces.
 */
export function stripDiffMarkers(input: string): string {
  const joined = parseDiffSegments(input)
    .filter((s) => s.kind !== "removed")
    .map((s) => s.text)
    .join("");
  return joined.replace(/[ \t]{2,}/g, " ").replace(/ ([.,;:!?])/g, "$1").trim();
}

export function countLinks(text: string): number {
  const mdLinks = text.match(/\[[^\]]+\]\([^)]+\)/g) ?? [];
  const bareUrls = text.replace(/\[[^\]]+\]\([^)]+\)/g, "").match(/https?:\/\/\S+/gi) ?? [];
  return mdLinks.length + bareUrls.length;
}

export function containsKeyword(text: string, keyword: string): boolean {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return true;
  const hay = text.toLowerCase();
  if (hay.includes(kw)) return true;
  const stop = new Set(["in", "near", "the", "a", "an", "of", "for", "and", "with", "at", "by"]);
  const tokens = kw.split(/\s+/).filter((t) => t.length > 1 && !stop.has(t));
  return tokens.length > 0 && tokens.every((t) => hay.includes(t));
}

export interface SectionValidationInput {
  sectionId: HiltonSectionId;
  text: string;
  keyword?: string;
  usps?: string[];
  brand?: string;
  grandfathered?: boolean;
  adaLegalIncluded?: boolean;
  jsNoteIncluded?: boolean;
  spotlightsCount?: number;
}

export interface SectionValidationResult {
  sectionId: HiltonSectionId;
  valid: boolean;
  liveText: string;
  charCount: number;
  limitLabel: string;
  overLimit: boolean;
  keywordPresent: boolean;
  uspCountOk: boolean;
  violations: string[];
}

export function validateSection(input: SectionValidationInput): SectionValidationResult {
  const rule = SECTION_RULES[input.sectionId];
  const liveText = stripDiffMarkers(input.text);
  const charCount = liveText.length;
  const violations: string[] = [];
  let overLimit = false;
  let limitLabel = "No limit";

  if (input.sectionId === "half-and-half") {
    const eligible = isHalfAndHalfEligible(input.brand ?? "");
    const expected = eligible ? "Yes" : "No";
    limitLabel = `Expected: ${expected}`;
    if (liveText && !liveText.toLowerCase().startsWith(expected.toLowerCase())) {
      violations.push(`Half & Half must be "${expected}" for brand "${input.brand || "Unknown"}"`);
    }
  } else if (rule.maxChars !== undefined) {
    const max =
      input.sectionId === "dining-outlet" && input.grandfathered && rule.grandfatheredMaxChars
        ? rule.grandfatheredMaxChars
        : rule.maxChars;
    limitLabel = `≤ ${max} chars`;
    if (charCount > max) {
      overLimit = true;
      violations.push(`${rule.label} exceeds ${max} characters (${charCount}/${max})`);
    }
  } else if (rule.targetChars !== undefined) {
    const tol = Math.round(rule.targetChars * (rule.targetTolerance ?? 0.1));
    const min = rule.targetChars - tol;
    const max = rule.targetChars + tol;
    limitLabel = `~${rule.targetChars} chars (${min}–${max})`;
    if (charCount > 0 && (charCount < min || charCount > max)) {
      overLimit = charCount > max;
      violations.push(`${rule.label} should be ~${rule.targetChars} chars (${min}–${max}, got ${charCount})`);
    }
  }

  let keywordPresent = true;
  if (rule.requiresKeyword && input.keyword?.trim()) {
    keywordPresent = containsKeyword(liveText, input.keyword);
    if (!keywordPresent) {
      violations.push(`${rule.label} is missing target keyword "${input.keyword}"`);
    }
  }

  let uspCountOk = true;
  if (rule.requiredUsps) {
    const providedUsps = (input.usps ?? []).map((u) => u.trim()).filter(Boolean);
    if (providedUsps.length < rule.requiredUsps) {
      uspCountOk = false;
      violations.push(`${rule.label} requires ${rule.requiredUsps} USPs (got ${providedUsps.length})`);
    }
  }

  if (rule.maxLinks !== undefined) {
    const links = countLinks(liveText);
    if (links > rule.maxLinks) {
      violations.push(`${rule.label} allows at most ${rule.maxLinks} link (found ${links})`);
    }
  }

  if (rule.requiresAdaLegal && input.adaLegalIncluded === false) {
    violations.push(`${rule.label} must include Hilton ADA legal copy`);
  }
  if (rule.requiresJsNote && input.jsNoteIncluded === false) {
    violations.push(`${rule.label} must include the JS note`);
  }
  if (rule.maxSpotlights !== undefined && (input.spotlightsCount ?? 0) > rule.maxSpotlights) {
    violations.push(`${rule.label} allows at most ${rule.maxSpotlights} spotlight focus points`);
  }

  return {
    sectionId: input.sectionId,
    valid: violations.length === 0,
    liveText,
    charCount,
    limitLabel,
    overLimit,
    keywordPresent,
    uspCountOk,
    violations,
  };
}

