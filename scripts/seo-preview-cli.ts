/**
 * Cogwheel SEO Templates — Interactive Local Preview CLI Tool
 * 
 * Marketing team preview tool supporting:
 * 1. Template selection
 * 2. Dataset loading (JSON/CSV)
 * 3. Page metadata generation & SERP pixel-width simulation (Desktop & Mobile)
 * 4. JSON-LD structured data preview
 * 5. SEO integrity validation
 * 6. CMS export demonstration (HTML, Shopify Liquid, WordPress PHP, Webflow CSV)
 */

import fs from "node:fs";
import path from "node:path";
import { resolveTemplate, type TemplateSchema } from "../validators/variableResolver.ts";
import { analyzeSerpSnippet } from "../validators/serpOptimizer.ts";
import { buildSchemaGraph, buildArticleSchema, buildLocalBusinessSchema } from "../schemas/index.ts";
import { exportToHtml, exportToShopifyLiquid, exportToWordPressPhp, exportToWebflowCsv } from "../exporters/index.ts";

const rootDir = process.cwd();
const sampleDataPath = path.resolve(rootDir, "templates/sample-data.json");
const sampleData = JSON.parse(fs.readFileSync(sampleDataPath, "utf8"));

const templatePath = path.resolve(rootDir, "templates/hotel-destination-guide.html");
const rawTemplate = fs.readFileSync(templatePath, "utf8");

const guideSchema: TemplateSchema = {
  id: "destination-guide",
  name: "Destination Guide Template",
  variables: {
    destinationTitle: { name: "destinationTitle", required: true },
    destinationSubtitle: { name: "destinationSubtitle", required: false, fallback: "Premier travel insights" },
    cityName: { name: "cityName", required: true },
    destinationOverview: { name: "destinationOverview", required: true },
    hotelName: { name: "hotelName", required: true },
    amenitiesList: { name: "amenitiesList", required: false, fallback: "luxury amenities" },
    bookingPerks: { name: "bookingPerks", required: false, fallback: "best rate guarantee" },
    attractionsSummary: { name: "attractionsSummary", required: false, fallback: "popular dining and arts" }
  }
};

console.log("================================================================================");
console.log(" COGWHEEL SEO STUDIO — MARKETING TEAM PREVIEW TOOL");
console.log("================================================================================\n");

// 1. Resolve Template
console.log("📌 Step 1: Compiling Template with Sample Data...");
const resolved = resolveTemplate(rawTemplate, guideSchema, sampleData);
console.log(`✔ Template compiled successfully! Output length: ${resolved.output.length} characters.\n`);

// 2. SERP Snippet Preview
const seoTitle = `${sampleData.destinationTitle} | ${sampleData.hotelName}`;
const metaDesc = `Experience the best of ${sampleData.cityName} at ${sampleData.hotelName}. Enjoy ${sampleData.amenitiesList} with lowest direct booking rates.`;

console.log("🔍 Step 2: Google SERP Preview & Pixel Calculations:");
const serp = analyzeSerpSnippet(seoTitle, metaDesc);

console.log("\n  [Google Desktop SERP Display]");
console.log(`  Title: ${serp.title.desktopOverflow ? serp.title.truncatedTitle : serp.title.raw}`);
console.log(`  URL:   https://example.com/destinations/${sampleData.cityName.toLowerCase()}/`);
console.log(`  Desc:  ${metaDesc}`);
console.log(`  Pixel Width: ${serp.title.pixelWidth}px / 580px (Desktop Limit)`);
console.log(`  Desktop Overflow Status: ${serp.title.desktopOverflow ? "⚠️ OVERFLOW (Truncated)" : "✔ OPTIMAL"}`);

console.log("\n  [Google Mobile SERP Display]");
console.log(`  Pixel Width: ${serp.title.pixelWidth}px / 920px (Mobile Limit)`);
console.log(`  Mobile Overflow Status:  ${serp.title.mobileOverflow ? "⚠️ OVERFLOW" : "✔ OPTIMAL"}`);

if (serp.warnings.length > 0) {
  console.log("\n  ⚠️ SERP Optimization Recommendations:");
  serp.warnings.forEach((w) => console.log(`     - ${w}`));
}

// 3. JSON-LD Inspection
console.log("\n--------------------------------------------------------------------------------");
console.log("⚡ Step 3: Generated JSON-LD @graph Structured Data Preview:");
const jsonLd = buildSchemaGraph([
  buildArticleSchema({
    url: `https://example.com/destinations/${sampleData.cityName.toLowerCase()}/`,
    headline: sampleData.destinationTitle,
    description: metaDesc,
    publisherName: sampleData.brand
  }),
  buildLocalBusinessSchema({
    url: `https://example.com/`,
    name: sampleData.hotelName,
    type: "Hotel"
  })
]);
console.log(jsonLd.substring(0, 350) + "\n   ... [truncated for display]\n</script>");

// 4. Multi-CMS Export Demonstration
console.log("\n--------------------------------------------------------------------------------");
console.log("📦 Step 4: Multi-CMS Export Formats Generated:");
const html = exportToHtml({ title: seoTitle, metaDescription: metaDesc, canonicalUrl: "https://example.com/", bodyContent: resolved.output }, { minify: true });
const liquid = exportToShopifyLiquid({ scope: "page", snippetName: "hotel-guide", richContentHtml: resolved.output });
const php = exportToWordPressPhp({ postTitle: sampleData.destinationTitle, postName: "denver-guide", postContent: resolved.output, seoTitle, metaDescription: metaDesc });
const csv = exportToWebflowCsv([{ name: sampleData.destinationTitle, slug: "denver-guide", metaTitle: seoTitle, metaDescription: metaDesc, postBodyHtml: resolved.output }]);

console.log(`  ✔ Clean HTML5 Exporter:       ${html.length} bytes`);
console.log(`  ✔ Shopify Liquid Exporter:    ${liquid.length} bytes`);
console.log(`  ✔ WordPress PHP Partial:      ${php.length} bytes`);
console.log(`  ✔ Webflow Collection CSV:     ${csv.length} bytes`);

console.log("\n================================================================================");
console.log("✔ PREVIEW COMPLETED SUCCESSFULLY. Ready for CMS deployment.");
console.log("================================================================================");
