import { describe, it } from "node:test";
import assert from "node:assert";
import {
  buildArticleSchema,
  buildProductSchema,
  buildFAQPageSchema,
  buildLocalBusinessSchema,
  buildBreadcrumbSchema,
  JsonLdGraphBuilder,
  buildSchemaGraph
} from "../schemas/index.ts";

describe("Day 4: Composable JSON-LD @graph Schema Builder", () => {
  it("builds a valid Article schema", () => {
    const article = buildArticleSchema({
      url: "https://example.com/blog/denver-hotel-guide/",
      headline: "Top Denver Hotel Guide for Business Travelers",
      description: "Discover luxury business amenities in downtown Denver.",
      authorName: "John Doe",
      datePublished: "2026-01-15T08:00:00Z"
    });

    assert.strictEqual(article["@type"], "Article");
    assert.strictEqual(article["headline"], "Top Denver Hotel Guide for Business Travelers");
    assert.strictEqual(article["author"]["name"], "John Doe");
    assert(article["@id"].includes("#article"));
  });

  it("builds a valid Product schema with Offer and AggregateRating", () => {
    const product = buildProductSchema({
      name: "Presidential Suite",
      description: "Penthouse luxury suite with mountain views.",
      url: "https://example.com/rooms/presidential-suite/",
      price: 499,
      priceCurrency: "USD",
      ratingValue: 4.9,
      reviewCount: 42
    });

    assert.strictEqual(product["@type"], "Product");
    assert.strictEqual(product["offers"]["price"], "499");
    assert.strictEqual(product["aggregateRating"]["ratingValue"], 4.9);
    assert.strictEqual(product["aggregateRating"]["reviewCount"], 42);
  });

  it("builds FAQPage schema from questions and answers", () => {
    const faq = buildFAQPageSchema({
      url: "https://example.com/faq/",
      items: [
        { question: "What is check-in time?", answer: "Check-in is at 3:00 PM." },
        { question: "Is valet parking available?", answer: "Yes, 24/7 valet parking is available." }
      ]
    });

    assert.strictEqual(faq["@type"], "FAQPage");
    assert.strictEqual(faq["mainEntity"].length, 2);
    assert.strictEqual(faq["mainEntity"][0]["name"], "What is check-in time?");
  });

  it("builds LocalBusiness / Hotel schema with geo and address", () => {
    const hotel = buildLocalBusinessSchema({
      name: "The Curtis Denver",
      url: "https://example-boutique.com/",
      type: "Hotel",
      telephone: "+1-303-571-0300",
      address: {
        streetAddress: "1405 Curtis Street",
        addressLocality: "Denver",
        addressRegion: "CO",
        postalCode: "80202"
      },
      geo: {
        latitude: 39.746,
        longitude: -104.997
      },
      amenities: ["Free WiFi", "Pet Friendly", "Fitness Center"]
    });

    assert.strictEqual(hotel["@type"], "Hotel");
    assert.strictEqual(hotel["address"]["addressLocality"], "Denver");
    assert.strictEqual(hotel["geo"]["latitude"], 39.746);
    assert.strictEqual(hotel["amenityFeature"].length, 3);
  });

  it("builds BreadcrumbList with correct positions and URLs", () => {
    const breadcrumb = buildBreadcrumbSchema({
      items: [
        { name: "Home", url: "https://example.com/" },
        { name: "Hotels", url: "https://example.com/hotels/" },
        { name: "Denver", url: "https://example.com/hotels/denver/" }
      ]
    });

    assert.strictEqual(breadcrumb["@type"], "BreadcrumbList");
    assert.strictEqual(breadcrumb["itemListElement"].length, 3);
    assert.strictEqual(breadcrumb["itemListElement"][1]["position"], 2);
  });

  it("composes multiple schemas into unified @graph with schema.org @context", () => {
    const builder = new JsonLdGraphBuilder();
    builder.add(buildLocalBusinessSchema({ name: "Grand Hotel", url: "https://grand.com/" }));
    builder.add(buildFAQPageSchema({ items: [{ question: "Pool?", answer: "Yes" }] }));

    const graphObj = builder.toObject();
    assert.strictEqual(graphObj["@context"], "https://schema.org");
    assert.strictEqual(graphObj["@graph"].length, 2);
    assert.strictEqual(graphObj["@graph"][0]["@type"], "Hotel");
    assert.strictEqual(graphObj["@graph"][1]["@type"], "FAQPage");

    const scriptTag = builder.toHtmlScript();
    assert(scriptTag.startsWith('<script type="application/ld+json">'));
    assert(scriptTag.endsWith("</script>"));
    assert(!scriptTag.includes("undefined"));
  });

  it("safely escapes quotes, newlines and script closing tags in JSON-LD", () => {
    const raw = buildArticleSchema({
      headline: 'Article with "quotes" and \n newlines and </script> test',
      description: "Description with 'single quotes' & ampersands.",
      url: "https://example.com/post/"
    });

    const output = buildSchemaGraph([raw]);
    assert(!output.includes("</script> "));
    assert(output.includes("<\\/script>"));
  });
});
