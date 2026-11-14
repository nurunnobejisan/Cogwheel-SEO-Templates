/**
 * Cogwheel SEO Templates — SERP Pixel-Width Optimizer
 * 
 * Provides:
 * - Proportional glyph pixel-width estimation for Google SERP typography (Arial / Roboto)
 * - Desktop Title limit validation (580px ceiling)
 * - Mobile Title limit validation (920px ceiling)
 * - Meta Description length & pixel evaluation (min 70 chars, 155-160 char guideline, 920px ceiling)
 * - Word-boundary-aware smart title trimming with brand suffix preservation / peel-off
 * - Actionable diagnostic warnings
 */

// Approximate character widths based on Arial 20px / 14px in Google SERP results
const CHAR_WIDTH_MAP: Record<string, number> = {
  // Uppercase wide characters
  "W": 17, "M": 16, "O": 14, "Q": 14, "G": 14, "C": 13, "D": 13, "H": 13, "N": 13, "U": 13,
  // Uppercase medium characters
  "A": 12, "B": 12, "E": 11, "F": 10, "K": 12, "P": 11, "R": 12, "S": 11, "T": 11, "V": 12, "X": 12, "Y": 12, "Z": 11,
  // Uppercase narrow characters
  "I": 5, "J": 8, "L": 9,
  // Lowercase wide characters
  "w": 13, "m": 15,
  // Lowercase medium characters
  "a": 9, "b": 10, "c": 9, "d": 10, "e": 9, "g": 10, "h": 10, "k": 9, "n": 10, "o": 10, "p": 10, "q": 10, "u": 10, "v": 8, "x": 8, "y": 8, "z": 8,
  // Lowercase narrow characters
  "i": 4, "l": 4, "t": 6, "f": 5, "j": 4, "r": 6, "s": 8,
  // Digits
  "0": 10, "1": 7, "2": 10, "3": 10, "4": 10, "5": 10, "6": 10, "7": 10, "8": 10, "9": 10,
  // Punctuation & spaces
  " ": 5, "-": 6, "–": 10, "—": 16, "|": 4, ":": 4, ";": 4, ".": 4, ",": 4, "!": 5, "?": 9, "(": 6, ")": 6, "'": 3, '"': 6
};

const DEFAULT_CHAR_WIDTH = 9;

export interface SerpValidationLimits {
  desktopTitleMaxPx: number;
  mobileTitleMaxPx: number;
  metaDescMinChars: number;
  metaDescMaxChars: number;
  metaDescMaxPx: number;
}

export const DEFAULT_SERP_LIMITS: SerpValidationLimits = {
  desktopTitleMaxPx: 580,
  mobileTitleMaxPx: 920,
  metaDescMinChars: 70,
  metaDescMaxChars: 160,
  metaDescMaxPx: 920
};

export interface SerpAnalysis {
  title: {
    raw: string;
    charCount: number;
    pixelWidth: number;
    desktopOverflow: boolean;
    mobileOverflow: boolean;
    truncatedTitle?: string;
  };
  metaDescription: {
    raw: string;
    charCount: number;
    pixelWidth: number;
    isTooShort: boolean;
    isTooLong: boolean;
    pixelOverflow: boolean;
  };
  warnings: string[];
}

/**
 * Calculates estimated pixel width for an arbitrary string.
 */
export function calculatePixelWidth(str: string | null | undefined): number {
  if (!str) return 0;
  let total = 0;
  for (const char of str) {
    total += CHAR_WIDTH_MAP[char] ?? DEFAULT_CHAR_WIDTH;
  }
  return total;
}

/**
 * Smartly trims a title at a word boundary to fit within a target pixel width.
 * Preserves brand suffix if specified, or removes brand suffix first if keyword content is too long.
 */
export function smartTrimTitle(
  title: string,
  targetPx: number = 580,
  brandSuffix?: string
): string {
  const currentPx = calculatePixelWidth(title);
  if (currentPx <= targetPx) {
    return title;
  }

  let baseTitle = title;
  let suffix = "";

  if (brandSuffix && title.endsWith(brandSuffix)) {
    suffix = brandSuffix;
    baseTitle = title.slice(0, -brandSuffix.length).trim();
  }

  // If removing suffix alone fits target, return baseTitle
  if (suffix && calculatePixelWidth(baseTitle) <= targetPx) {
    return baseTitle;
  }

  // Trim word by word
  const words = baseTitle.split(/\s+/);
  let accumulated = "";

  for (const word of words) {
    const candidate = accumulated ? `${accumulated} ${word}` : word;
    const candidateWithEllipsis = `${candidate} ...`;
    const checkWidth = calculatePixelWidth(candidateWithEllipsis);

    if (checkWidth > targetPx) {
      break;
    }
    accumulated = candidate;
  }

  return accumulated ? `${accumulated} ...` : title.substring(0, 50) + " ...";
}

/**
 * Evaluates Title and Meta Description for SERP compliance.
 */
export function analyzeSerpSnippet(
  title: string,
  metaDescription: string,
  options: Partial<SerpValidationLimits> = {}
): SerpAnalysis {
  const limits: SerpValidationLimits = { ...DEFAULT_SERP_LIMITS, ...options };
  const warnings: string[] = [];

  const titlePx = calculatePixelWidth(title);
  const desktopTitleOverflow = titlePx > limits.desktopTitleMaxPx;
  const mobileTitleOverflow = titlePx > limits.mobileTitleMaxPx;

  if (desktopTitleOverflow) {
    warnings.push(
      `Title exceeds desktop SERP width (${titlePx}px > ${limits.desktopTitleMaxPx}px). Truncation will occur in Google search.`
    );
  }

  const descPx = calculatePixelWidth(metaDescription);
  const descChars = metaDescription ? metaDescription.length : 0;
  const descTooShort = descChars > 0 && descChars < limits.metaDescMinChars;
  const descTooLong = descChars > limits.metaDescMaxChars;
  const descPixelOverflow = descPx > limits.metaDescMaxPx;

  if (descTooShort) {
    warnings.push(
      `Meta description is short (${descChars} chars < ${limits.metaDescMinChars} min). May fail to earn rich snippets.`
    );
  }
  if (descTooLong || descPixelOverflow) {
    warnings.push(
      `Meta description is long (${descChars} chars / ${descPx}px). Recommended: 155-160 chars / max ${limits.metaDescMaxPx}px.`
    );
  }

  return {
    title: {
      raw: title,
      charCount: title ? title.length : 0,
      pixelWidth: titlePx,
      desktopOverflow: desktopTitleOverflow,
      mobileOverflow: mobileTitleOverflow,
      truncatedTitle: desktopTitleOverflow ? smartTrimTitle(title, limits.desktopTitleMaxPx) : undefined
    },
    metaDescription: {
      raw: metaDescription,
      charCount: descChars,
      pixelWidth: descPx,
      isTooShort: descTooShort,
      isTooLong: descTooLong,
      pixelOverflow: descPixelOverflow
    },
    warnings
  };
}
