/**
 * SEO Studio Templates — Anti-Thin-Content Gate & Uniqueness Scorer
 * 
 * Provides:
 * - N-gram tokenization and Jaccard similarity scoring across pages
 * - Batch duplicate content detection (flags/blocks pages exceeding similarity ceiling, default 70%)
 * - Non-boilerplate word count calculation (minimum threshold default 250 words)
 * - Conditional section validator (guards comparison tables, local insights against empty renders)
 * - Actionable validation reports
 */

export interface UniquenessGateConfig {
  maxSimilarityThreshold: number; // e.g. 0.70 (70%)
  minUniqueWordCount: number;      // e.g. 250 words
  ngramSize: number;               // default 3 (tri-grams)
  boilerplatePhrases?: string[];
}

export const DEFAULT_UNIQUENESS_CONFIG: UniquenessGateConfig = {
  maxSimilarityThreshold: parseFloat(process.env.MAX_SIMILARITY_THRESHOLD || "0.70"),
  minUniqueWordCount: parseInt(process.env.MIN_UNIQUE_WORD_COUNT || "250", 10),
  ngramSize: 3,
  boilerplatePhrases: [
    "all rights reserved",
    "privacy policy",
    "terms and conditions",
    "cookie policy",
    "powered by nurunnobe marketing",
    "check-in time is",
    "contact us today",
    "book direct and save"
  ]
};

export interface PageContentItem {
  id: string;
  url: string;
  content: string;
}

export interface PageSimilarityComparison {
  pageAId: string;
  pageBId: string;
  similarity: number; // 0.0 to 1.0
  isDuplicate: boolean;
}

export interface PageAuditResult {
  id: string;
  url: string;
  rawWordCount: number;
  cleanedWordCount: number;
  isThinContent: boolean;
  highestSimilarity: number;
  mostSimilarPageId?: string;
  passed: boolean;
  reasons: string[];
}

/**
 * Strips HTML tags, punctuation, and known boilerplate phrases, returning clean text.
 */
export function cleanContent(text: string, boilerplatePhrases: string[] = []): string {
  if (!text) return "";

  // Strip HTML tags
  let stripped = text.replace(/<[^>]*>/g, " ");

  // Lowercase
  let lower = stripped.toLowerCase();

  // Strip known boilerplate phrases
  for (const phrase of boilerplatePhrases) {
    if (!phrase || !phrase.trim()) continue;
    const pLower = phrase.toLowerCase().trim();
    while (lower.includes(pLower)) {
      lower = lower.replace(pLower, " ");
    }
  }

  // Normalize whitespace and punctuation
  return lower.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Counts words in a cleaned text string.
 */
export function countWords(cleanedText: string): number {
  if (!cleanedText) return 0;
  return cleanedText.split(/\s+/).filter(Boolean).length;
}

/**
 * Generates an n-gram set from clean text.
 */
export function generateNgrams(text: string, n: number = 3): Set<string> {
  const words = text.split(/\s+/).filter(Boolean);
  const ngrams = new Set<string>();

  if (words.length < n) {
    if (words.length > 0) {
      ngrams.add(words.join(" "));
    }
    return ngrams;
  }

  for (let i = 0; i <= words.length - n; i++) {
    ngrams.add(words.slice(i, i + n).join(" "));
  }

  return ngrams;
}

/**
 * Calculates Jaccard similarity between two n-gram sets:
 * J(A, B) = |A ∩ B| / |A ∪ B|
 */
export function calculateJaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 1.0;
  if (setA.size === 0 || setB.size === 0) return 0.0;

  let intersectionSize = 0;
  for (const item of setA) {
    if (setB.has(item)) {
      intersectionSize++;
    }
  }

  const unionSize = setA.size + setB.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

/**
 * Validates a batch of generated pages against thin content and duplicate content thresholds.
 */
export function auditContentUniqueness(
  pages: PageContentItem[],
  customConfig: Partial<UniquenessGateConfig> = {}
): {
  results: PageAuditResult[];
  comparisons: PageSimilarityComparison[];
  allPassed: boolean;
} {
  const config: UniquenessGateConfig = { ...DEFAULT_UNIQUENESS_CONFIG, ...customConfig };

  const pageData = pages.map((p) => {
    const cleaned = cleanContent(p.content, config.boilerplatePhrases);
    const wordCount = countWords(cleaned);
    const ngrams = generateNgrams(cleaned, config.ngramSize);
    return {
      ...p,
      cleaned,
      wordCount,
      ngrams
    };
  });

  const comparisons: PageSimilarityComparison[] = [];
  const similarityMap: Record<string, { maxSim: number; mostSimilarId?: string }> = {};

  pages.forEach((p) => {
    similarityMap[p.id] = { maxSim: 0 };
  });

  // Pairwise Jaccard comparisons
  for (let i = 0; i < pageData.length; i++) {
    for (let j = i + 1; j < pageData.length; j++) {
      const pageA = pageData[i];
      const pageB = pageData[j];
      const similarity = calculateJaccardSimilarity(pageA.ngrams, pageB.ngrams);
      const isDuplicate = similarity > config.maxSimilarityThreshold;

      comparisons.push({
        pageAId: pageA.id,
        pageBId: pageB.id,
        similarity: parseFloat(similarity.toFixed(4)),
        isDuplicate
      });

      if (similarity > similarityMap[pageA.id].maxSim) {
        similarityMap[pageA.id] = { maxSim: similarity, mostSimilarId: pageB.id };
      }
      if (similarity > similarityMap[pageB.id].maxSim) {
        similarityMap[pageB.id] = { maxSim: similarity, mostSimilarId: pageA.id };
      }
    }
  }

  const results: PageAuditResult[] = pageData.map((p) => {
    const reasons: string[] = [];
    const isThin = p.wordCount < config.minUniqueWordCount;
    const simInfo = similarityMap[p.id];
    const isDuplicate = simInfo.maxSim > config.maxSimilarityThreshold;

    if (isThin) {
      reasons.push(
        `Thin content: non-boilerplate word count (${p.wordCount}) is below the required threshold of ${config.minUniqueWordCount} words.`
      );
    }
    if (isDuplicate) {
      reasons.push(
        `Duplicate content: similarity with page "${simInfo.mostSimilarId}" is ${(simInfo.maxSim * 100).toFixed(1)}%, exceeding the maximum allowed threshold of ${(config.maxSimilarityThreshold * 100)}%.`
      );
    }

    return {
      id: p.id,
      url: p.url,
      rawWordCount: countWords(p.content),
      cleanedWordCount: p.wordCount,
      isThinContent: isThin,
      highestSimilarity: parseFloat(simInfo.maxSim.toFixed(4)),
      mostSimilarPageId: simInfo.mostSimilarId,
      passed: !isThin && !isDuplicate,
      reasons
    };
  });

  return {
    results,
    comparisons,
    allPassed: results.every((r) => r.passed)
  };
}

/**
 * Conditional Section Guard:
 * Returns true only if meaningful data exists, preventing empty or placeholder sections.
 */
export function shouldRenderSection(data: any): boolean {
  if (data === null || data === undefined) return false;
  if (typeof data === "string") return data.trim().length > 0;
  if (Array.isArray(data)) return data.length > 0 && data.some((item) => shouldRenderSection(item));
  if (typeof data === "object") {
    const values = Object.values(data);
    return values.length > 0 && values.some((val) => shouldRenderSection(val));
  }
  return true;
}
