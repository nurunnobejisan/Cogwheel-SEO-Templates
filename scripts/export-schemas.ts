/**
 * Cogwheel SEO Templates — JSON Schema Exporter
 * Exports Zod schemas to /shared/schemas/ so TypeScript & Python share one identical contract.
 */

import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const targetDir = path.resolve(rootDir, "shared/schemas");
fs.mkdirSync(targetDir, { recursive: true });

// 1. Destination Guide JSON Schema
const destinationGuideJsonSchema = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "DestinationGuide",
  "type": "object",
  "required": ["hotelName", "cityName", "destinationTitle", "destinationOverview"],
  "properties": {
    "hotelName": { "type": "string", "minLength": 1 },
    "brand": { "type": "string", "default": "Independent Collection" },
    "cityName": { "type": "string", "minLength": 1 },
    "destinationTitle": { "type": "string", "minLength": 5 },
    "destinationSubtitle": { "type": "string", "default": "Premier travel insights and local recommendations" },
    "destinationOverview": { "type": "string", "minLength": 20 },
    "amenitiesList": { "type": "string", "default": "modern luxury amenities, on-site dining, and 24/7 guest services" },
    "bookingPerks": { "type": "string", "default": "lowest direct booking rate guarantee and flexible cancellations" },
    "attractionsSummary": { "type": "string", "default": "convenient access to cultural attractions, dining districts, and local transit" }
  }
};

// 2. Room Showcase JSON Schema
const roomShowcaseJsonSchema = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "RoomShowcase",
  "type": "object",
  "required": ["hotelName", "cityName", "roomTitle", "roomDescription"],
  "properties": {
    "hotelName": { "type": "string", "minLength": 1 },
    "cityName": { "type": "string", "minLength": 1 },
    "roomTitle": { "type": "string", "minLength": 3 },
    "roomStartingRate": { "type": "string", "default": "Best Available Rate" },
    "roomDescription": { "type": "string", "minLength": 20 },
    "roomAmenities": { "type": "string", "default": "King pillow-top bed, high-speed WiFi, smart television, and luxury bath amenities" }
  }
};

// 3. Hotel FAQ JSON Schema
const hotelFaqJsonSchema = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "HotelFaq",
  "type": "object",
  "required": ["hotelName", "cityName"],
  "properties": {
    "hotelName": { "type": "string", "minLength": 1 },
    "cityName": { "type": "string", "minLength": 1 },
    "checkInOutPolicy": { "type": "string", "default": "Check-in begins at 4:00 PM; check-out is by 11:00 AM." },
    "parkingPolicy": { "type": "string", "default": "On-site valet parking is available 24/7 for all registered guests." },
    "petPolicy": { "type": "string", "default": "Designated pet-friendly rooms are available upon request." }
  }
};

// 4. Page Metadata JSON Schema
const pageMetadataJsonSchema = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "PageMetadata",
  "type": "object",
  "required": ["title", "metaDescription", "canonicalUrl"],
  "properties": {
    "title": { "type": "string", "minLength": 10, "maxLength": 70 },
    "metaDescription": { "type": "string", "minLength": 50, "maxLength": 160 },
    "canonicalUrl": { "type": "string", "format": "uri" },
    "robotsDirective": { "type": "string", "default": "index, follow" },
    "focusKeyword": { "type": "string" }
  }
};

// 5. Site Manifest JSON Schema
const siteManifestJsonSchema = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "SiteManifest",
  "type": "array",
  "items": {
    "type": "object",
    "required": ["url", "primaryKeyword"],
    "properties": {
      "url": { "type": "string", "format": "uri" },
      "primaryKeyword": { "type": "string", "minLength": 2 },
      "secondaryTags": { "type": "array", "items": { "type": "string" }, "default": [] },
      "parentPage": { "type": "string", "format": "uri" },
      "categoryHierarchy": { "type": "array", "items": { "type": "string" }, "default": [] },
      "approvedAnchorVariations": { "type": "array", "items": { "type": "string" }, "default": [] }
    }
  }
};

fs.writeFileSync(path.join(targetDir, "destination-guide.schema.json"), JSON.stringify(destinationGuideJsonSchema, null, 2) + "\n");
fs.writeFileSync(path.join(targetDir, "room-showcase.schema.json"), JSON.stringify(roomShowcaseJsonSchema, null, 2) + "\n");
fs.writeFileSync(path.join(targetDir, "hotel-faq.schema.json"), JSON.stringify(hotelFaqJsonSchema, null, 2) + "\n");
fs.writeFileSync(path.join(targetDir, "page-metadata.schema.json"), JSON.stringify(pageMetadataJsonSchema, null, 2) + "\n");
fs.writeFileSync(path.join(targetDir, "site-manifest.schema.json"), JSON.stringify(siteManifestJsonSchema, null, 2) + "\n");

console.log("✔ Successfully exported 5 JSON Schema contracts to /shared/schemas/");
