/**
 * Citability score (0–100).
 *
 * This is a deterministic, documented heuristic over measured page facts. It is
 * labelled `estimated` everywhere it appears — it is not a measurement of how
 * often an AI engine cites the page. Weights follow the GEO paper's method
 * families (structured facts, direct answers, entity clarity, depth, and cited
 * evidence such as statistics and quotations).
 *
 * Formula (weights sum to 100):
 *   score = round( structured_data*0.25 + answer_coverage*0.25
 *                + entity_signals*0.15 + content_depth*0.15
 *                + citations*0.20 )
 */

import type { PageSnapshot } from "../types.ts";
import type { CitabilityComponent, CitabilityScore } from "./types.ts";
import { GEO_ENGINE_VERSION } from "./types.ts";

const WEIGHTS: Record<CitabilityComponent["id"], number> = {
  structured_data: 25,
  answer_coverage: 25,
  entity_signals: 15,
  content_depth: 15,
  citations: 20,
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function schemaTypes(snapshot: PageSnapshot): string[] {
  const types = new Set<string>();
  for (const node of snapshot.jsonLd) {
    const type = node["@type"];
    if (typeof type === "string") types.add(type);
    else if (Array.isArray(type)) for (const entry of type) if (typeof entry === "string") types.add(entry);
  }
  return [...types];
}

function jsonLdValues(snapshot: PageSnapshot, key: string): unknown[] {
  const values: unknown[] = [];
  for (const node of snapshot.jsonLd) {
    const value = node[key];
    if (value !== undefined && value !== null) values.push(value);
  }
  return values;
}

function domainToken(hostname: string): string {
  return hostname.replace(/^www\./, "").split(".")[0]!.toLowerCase();
}

function countMatches(text: string, pattern: RegExp): number {
  return [...text.matchAll(pattern)].length;
}

export function buildCitabilityScore(snapshot: PageSnapshot): CitabilityScore {
  const text = snapshot.textContent || "";
  const lower = text.toLowerCase();
  const types = schemaTypes(snapshot);
  const hasFaq = types.some((type) => ["FAQPage", "QAPage"].includes(type));
  const hasEntity = types.some((type) =>
    ["Organization", "LocalBusiness", "Hotel", "LodgingBusiness", "Restaurant", "Product", "Service"].includes(type)
  );
  const hasArticle = types.some((type) => ["Article", "BlogPosting", "WebPage", "BreadcrumbList"].includes(type));

  /* 1. Structured data ---------------------------------------------------- */
  let structured = 0;
  if (types.length >= 3) structured = 70;
  else if (types.length === 2) structured = 55;
  else if (types.length === 1) structured = 35;
  if (hasFaq) structured += 15;
  if (hasEntity) structured += 10;
  if (hasArticle) structured += 5;
  structured = clamp(structured);
  const malformed = snapshot.jsonLd.length === 0 && /application\/ld\+json/i.test(text) ? 1 : 0;

  const structuredComponent: CitabilityComponent = {
    id: "structured_data",
    label: "Structured data",
    weight: WEIGHTS.structured_data,
    score: structured,
    provenance: "estimated",
    inputs: {
      schemaTypes: types,
      schemaCount: types.length,
      hasFaqSchema: hasFaq,
      hasEntitySchema: hasEntity,
      hasArticleSchema: hasArticle,
      malformedJsonLd: malformed,
    },
    notes: [
      "Base: 35 for one schema type, 55 for two, 70 for three or more.",
      "+15 FAQPage/QAPage, +10 Organization/LocalBusiness/Hotel, +5 Article/WebPage/BreadcrumbList.",
      "No schema score without a parsed JSON-LD type.",
    ],
  };

  /* 2. Answer coverage --------------------------------------------------- */
  const headings = snapshot.headings ?? [];
  const questionHeadings = headings.filter(
    (heading) => heading.level >= 2 && heading.level <= 3 && /\?\s*$|^(how|what|why|when|where|who|which|can|is|are|do|does|best|cost|price)\b/i.test(heading.text.trim())
  );
  const firstChunk = text.slice(0, 700).trim();
  const firstParagraph = firstChunk.split(/\n{2,}/)[0] ?? "";
  const hasDirectAnswer = firstParagraph.split(/[.!?]/).some((sentence) => {
    const words = sentence.trim().split(/\s+/).filter(Boolean).length;
    return words >= 8 && words <= 60;
  });
  const hasListMarkers = /(^|\n)\s*(?:[-*•]|\d+[.)])\s+/m.test(text);

  let coverage = headings.length > 0 ? 20 : 0;
  if (questionHeadings.length >= 1) coverage += 10;
  if (questionHeadings.length >= 3) coverage += 10;
  if (questionHeadings.length >= 5) coverage += 10;
  if (hasFaq) coverage += 20;
  if (hasDirectAnswer) coverage += 15;
  if (hasListMarkers) coverage += 5;
  coverage = clamp(coverage);

  const coverageComponent: CitabilityComponent = {
    id: "answer_coverage",
    label: "Answer coverage",
    weight: WEIGHTS.answer_coverage,
    score: coverage,
    provenance: "estimated",
    inputs: {
      headingCount: headings.length,
      questionHeadingCount: questionHeadings.length,
      questionHeadings: questionHeadings.slice(0, 8).map((heading) => heading.text),
      hasFaqSchema: hasFaq,
      hasDirectAnswer,
      hasListMarkers,
    },
    notes: [
      "Base 20 for having headings; +10/+10/+10 for 1/3/5 question-style headings.",
      "+20 FAQPage/QAPage schema, +15 declarative opening answer (8–60 words), +5 list markers.",
    ],
  };

  /* 3. Entity signals ---------------------------------------------------- */
  const names = jsonLdValues(snapshot, "name").filter((value): value is string => typeof value === "string");
  const sameAs = jsonLdValues(snapshot, "sameAs").flatMap((value) => (Array.isArray(value) ? value : [value]));
  const sameAsUrls = sameAs.filter((value): value is string => typeof value === "string" && /^https?:\/\//.test(value));
  const hasTelephone = jsonLdValues(snapshot, "telephone").length > 0;
  const hasAddress = jsonLdValues(snapshot, "address").length > 0;
  const token = domainToken(snapshot.hostname);
  const brandInTitle = token.length > 2 && snapshot.title.toLowerCase().includes(token);
  const brandInDescription = token.length > 2 && (snapshot.metaDescription ?? "").toLowerCase().includes(token);

  let entity = 0;
  if (hasEntity) entity += 25;
  if (sameAsUrls.length > 0) entity += 20;
  if (names.length > 0) entity += 15;
  if (hasTelephone && hasAddress) entity += 15;
  else if (hasTelephone || hasAddress) entity += 8;
  if (brandInTitle) entity += 10;
  if (brandInDescription) entity += 10;
  if (hasFaq) entity += 5;
  entity = clamp(entity);

  const entityComponent: CitabilityComponent = {
    id: "entity_signals",
    label: "Entity signals",
    weight: WEIGHTS.entity_signals,
    score: entity,
    provenance: "estimated",
    inputs: {
      hasEntitySchema: hasEntity,
      schemaNameCount: names.length,
      sameAsUrlCount: sameAsUrls.length,
      hasTelephone,
      hasAddress,
      brandTokenInTitle: brandInTitle,
      brandTokenInDescription: brandInDescription,
    },
    notes: [
      "+25 entity schema, +20 sameAs links, +15 schema name, +15 full NAP (or +8 partial).",
      "+10 brand token in title, +10 in meta description, +5 FAQ schema.",
    ],
  };

  /* 4. Content depth ----------------------------------------------------- */
  const wordCount = snapshot.wordCount || text.split(/\s+/).filter(Boolean).length;
  let depthBase = 0;
  if (wordCount >= 2000) depthBase = 85;
  else if (wordCount >= 1200) depthBase = 70;
  else if (wordCount >= 600) depthBase = 50;
  else if (wordCount >= 300) depthBase = 30;
  else if (wordCount > 0) depthBase = Math.round((wordCount / 300) * 25);
  const depth = clamp(depthBase + (headings.length >= 5 ? 10 : headings.length >= 3 ? 5 : 0) + (text.split(/\n{2,}/).filter((p) => p.trim().length > 40).length >= 8 ? 5 : 0));

  const depthComponent: CitabilityComponent = {
    id: "content_depth",
    label: "Content depth",
    weight: WEIGHTS.content_depth,
    score: depth,
    provenance: "estimated",
    inputs: {
      wordCount,
      headingCount: headings.length,
      paragraphCount: text.split(/\n{2,}/).filter((p) => p.trim().length > 40).length,
    },
    notes: [
      "Word bands: 300→30, 600→50, 1200→70, 2000→85.",
      "+10 for five headings (or +5 for three), +5 for eight substantial paragraphs.",
    ],
  };

  /* 5. Cited statistics and quotations ---------------------------------- */
  const statCount =
    countMatches(text, /\b\d+(?:\.\d+)?\s?%/g) +
    countMatches(text, /\b\d+(?:\.\d+)?\s?(?:minutes?|hours?|nights?|rooms?|guests?|miles?|km|metres?|meters?|years?)\b/gi);
  const quotationCount =
    countMatches(text, /“[^”]{15,240}”/g) + countMatches(text, /"[^"\n]{15,240}"/g);
  const yearMentions = countMatches(lower, /\b(?:19|20)\d{2}\b/g);
  const externalLinks = (snapshot.links ?? []).filter((link) => link.external).length;

  const citations = clamp(
    Math.min(40, statCount * 8) +
      Math.min(25, quotationCount * 8) +
      Math.min(20, externalLinks * 2) +
      Math.min(15, yearMentions * 5)
  );

  const citationsComponent: CitabilityComponent = {
    id: "citations",
    label: "Cited statistics and quotations",
    weight: WEIGHTS.citations,
    score: citations,
    provenance: "estimated",
    inputs: {
      statisticMentions: statCount,
      quotationMentions: quotationCount,
      yearMentions,
      externalLinkCount: externalLinks,
    },
    notes: [
      "+8 per statistic up to 40, +8 per quotation up to 25, +2 per external link up to 20, +5 per year up to 15.",
      "Presence only: this does not verify that a cited statistic is true.",
    ],
  };

  const components = [structuredComponent, coverageComponent, entityComponent, depthComponent, citationsComponent];
  const weighted = components.reduce((sum, component) => sum + (component.weight * component.score) / 100, 0);
  const score = Math.round(clamp(weighted));

  return {
    id: "citability",
    label: "Citability score",
    score,
    provenance: "estimated",
    formula:
      "round(structured_data×0.25 + answer_coverage×0.25 + entity_signals×0.15 + content_depth×0.15 + citations×0.20)",
    components,
    version: GEO_ENGINE_VERSION,
  };
}
