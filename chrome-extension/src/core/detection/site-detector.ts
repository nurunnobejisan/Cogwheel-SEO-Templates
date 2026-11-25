import { PageAuditData } from "../../types/extension";
import { EngineMode, SiteType } from "../config/site-config";

export interface DetectionResult {
  detectedType: SiteType;
  engineRoute: "hospitality" | "universal";
  confidence: number; // 0.0 - 1.0
  overriddenByManualMode: boolean;
  signals: string[];
}

const HOSPITALITY_SCHEMA_REGEX = /\b(hotel|lodgingbusiness|resort|motel|hostel|bedandbreakfast)\b/i;
const HOSPITALITY_TEXT_REGEX =
  /\b(hotel|resort|guestroom|king suite|queen suite|check-in|checkout time|concierge|oceanfront|beachfront|valet parking|book direct|night stay|room rate)\b/gi;

const ECOMMERCE_SCHEMA_REGEX = /\b(product|offer|aggregateoffer|itemlist|store)\b/i;
const ECOMMERCE_TEXT_REGEX =
  /\b(add to cart|buy now|checkout|free shipping|sku|in stock|out of stock|wishlist|shopping bag|cart)\b/gi;

const SAAS_TEXT_REGEX =
  /\b(saas|api documentation|pricing plans|free trial|request a demo|book a demo|developer docs|integrations|workflow automation|enterprise plan|sign up free)\b/gi;

const EDITORIAL_SCHEMA_REGEX = /\b(article|newsarticle|blogposting|scholarlyarticle)\b/i;
const EDITORIAL_TEXT_REGEX =
  /\b(published on|min read|written by|editorial|subscribe to newsletter|table of contents)\b/gi;

const LOCAL_SCHEMA_REGEX = /\b(localbusiness|restaurant|dentist|autorepair|professionalservice|medicalclinic)\b/i;
const LOCAL_TEXT_REGEX =
  /\b(opening hours|business hours|directions|call today|service area|free estimate|mon-fri|book appointment)\b/gi;

/**
 * Detects the website type from DOM/audit signals with confidence scoring.
 * Rule:
 * - Manual mode ("hospitality" or "universal") ALWAYS overrides automatic detection.
 * - In "auto" mode, routes to "hospitality" only when hospitality signals are confidently detected (>= 0.65);
 *   otherwise routes to "universal".
 */
export function detectSiteTypeWithConfidence(
  pageData: Partial<PageAuditData>,
  manualMode: EngineMode = "auto",
  preferredSiteType?: SiteType
): DetectionResult {
  if (manualMode === "hospitality") {
    return {
      detectedType: "hospitality",
      engineRoute: "hospitality",
      confidence: 1.0,
      overriddenByManualMode: true,
      signals: ["manual-mode:hospitality"],
    };
  }

  if (manualMode === "universal") {
    const resolvedType =
      preferredSiteType && preferredSiteType !== "hospitality" ? preferredSiteType : inferUniversalSubtype(pageData).type;
    return {
      detectedType: resolvedType,
      engineRoute: "universal",
      confidence: 1.0,
      overriddenByManualMode: true,
      signals: [`manual-mode:universal(${resolvedType})`],
    };
  }

  const schemaTypes = (pageData.schemas || [])
    .map((s) => String(s["@type"] || ""))
    .join(" ");
  const textCorpus = [
    pageData.url || "",
    pageData.title || "",
    pageData.metaDesc || "",
    ...(pageData.h1Elements || []),
    ...(pageData.h2Elements || []),
    ...(pageData.extractedAmenities || []),
  ].join(" ");

  // 1. Check Hospitality signals
  const hospitalitySignals: string[] = [];
  let hospitalityScore = 0;

  if (HOSPITALITY_SCHEMA_REGEX.test(schemaTypes)) {
    hospitalityScore += 0.55;
    hospitalitySignals.push("schema:Hotel/LodgingBusiness");
  }
  const hospMatches = textCorpus.match(HOSPITALITY_TEXT_REGEX) || [];
  if (hospMatches.length > 0) {
    hospitalityScore += Math.min(0.4, hospMatches.length * 0.15);
    hospitalitySignals.push(`keywords:hospitality(${hospMatches.length})`);
  }
  if (pageData.extractedFacts?.roomTypes && pageData.extractedFacts.roomTypes.length > 0) {
    hospitalityScore += 0.25;
    hospitalitySignals.push("facts:roomTypes");
  }
  if (pageData.extractedFacts?.checkInTime || pageData.extractedFacts?.checkOutTime) {
    hospitalityScore += 0.2;
    hospitalitySignals.push("facts:checkInOut");
  }

  if (hospitalityScore >= 0.65) {
    return {
      detectedType: "hospitality",
      engineRoute: "hospitality",
      confidence: Math.min(0.99, Number(hospitalityScore.toFixed(2))),
      overriddenByManualMode: false,
      signals: hospitalitySignals,
    };
  }

  // 2. Otherwise classify into Universal subtypes
  const inferred = inferUniversalSubtype(pageData);
  return {
    detectedType: inferred.type,
    engineRoute: "universal",
    confidence: inferred.confidence,
    overriddenByManualMode: false,
    signals: inferred.signals,
  };
}

function inferUniversalSubtype(pageData: Partial<PageAuditData>): {
  type: SiteType;
  confidence: number;
  signals: string[];
} {
  const schemaTypes = (pageData.schemas || [])
    .map((s) => String(s["@type"] || ""))
    .join(" ");
  const textCorpus = [
    pageData.url || "",
    pageData.title || "",
    pageData.metaDesc || "",
    ...(pageData.h1Elements || []),
    ...(pageData.h2Elements || []),
  ].join(" ");

  // E-commerce
  const ecomSignals: string[] = [];
  let ecomScore = 0;
  if (pageData.ecommerce?.isEcommerce) {
    ecomScore += 0.5;
    ecomSignals.push("dom:ecommerce");
  }
  if (ECOMMERCE_SCHEMA_REGEX.test(schemaTypes)) {
    ecomScore += 0.4;
    ecomSignals.push("schema:Product/Offer");
  }
  const ecomMatches = textCorpus.match(ECOMMERCE_TEXT_REGEX) || [];
  if (ecomMatches.length > 0) {
    ecomScore += Math.min(0.35, ecomMatches.length * 0.15);
    ecomSignals.push(`keywords:ecommerce(${ecomMatches.length})`);
  }
  if (ecomScore >= 0.4) {
    return { type: "ecommerce", confidence: Math.min(0.98, Number(ecomScore.toFixed(2))), signals: ecomSignals };
  }

  // SaaS
  const saasMatches = textCorpus.match(SAAS_TEXT_REGEX) || [];
  if (/softwareapplication|webapplication/i.test(schemaTypes) || saasMatches.length >= 1) {
    const score = Math.min(0.95, 0.45 + saasMatches.length * 0.15);
    return {
      type: "saas",
      confidence: Number(score.toFixed(2)),
      signals: [`keywords:saas(${saasMatches.length})`],
    };
  }

  // Editorial / Blog
  const edMatches = textCorpus.match(EDITORIAL_TEXT_REGEX) || [];
  if (EDITORIAL_SCHEMA_REGEX.test(schemaTypes) || /\/blog\/|\/articles?\//i.test(pageData.pathname || "") || edMatches.length >= 1) {
    const score = Math.min(0.95, (EDITORIAL_SCHEMA_REGEX.test(schemaTypes) ? 0.55 : 0.4) + edMatches.length * 0.15);
    return {
      type: "editorial",
      confidence: Number(score.toFixed(2)),
      signals: ["signals:editorial"],
    };
  }

  // Local Business
  const localMatches = textCorpus.match(LOCAL_TEXT_REGEX) || [];
  if (LOCAL_SCHEMA_REGEX.test(schemaTypes) || pageData.detectedNap?.address || localMatches.length >= 1) {
    const score = Math.min(0.95, (LOCAL_SCHEMA_REGEX.test(schemaTypes) ? 0.55 : 0.4) + localMatches.length * 0.15);
    return {
      type: "local_business",
      confidence: Number(score.toFixed(2)),
      signals: ["signals:local_business"],
    };
  }

  // Corporate vs General
  if (/\/(about|careers|investors|enterprise|solutions|company)\b/i.test(pageData.pathname || "")) {
    return { type: "corporate", confidence: 0.65, signals: ["url:corporate"] };
  }

  return { type: "general", confidence: 0.6, signals: ["fallback:general"] };
}
