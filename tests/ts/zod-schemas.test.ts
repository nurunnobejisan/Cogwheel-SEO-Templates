import { describe, it } from "node:test";
import assert from "node:assert";
import {
  DestinationGuideZodSchema,
  RoomShowcaseZodSchema,
  HotelFaqZodSchema,
  PageMetadataZodSchema,
  SiteManifestZodSchema,
  resolveWithZod
} from "../../validators/schemas/index.ts";

describe("Vitest/TS: Zod Schema Variable Resolution & Fallbacks", () => {
  it("resolves valid Destination Guide input and applies defaults for optional fields", () => {
    const raw = {
      hotelName: "The Curtis Denver",
      cityName: "Denver",
      destinationTitle: "Ultimate Downtown Denver City Guide",
      destinationOverview: "A comprehensive guide to visiting the Mile High City with premier accommodations."
    };

    const res = resolveWithZod(DestinationGuideZodSchema, raw);
    assert.strictEqual(res.success, true);
    if (res.success) {
      assert.strictEqual(res.data.hotelName, "The Curtis Denver");
      assert.strictEqual(res.data.brand, "Independent Collection"); // default applied
      assert.strictEqual(res.data.destinationSubtitle, "Premier travel insights and local recommendations"); // default applied
      assert(res.data.bookingPerks.includes("lowest direct booking")); // default applied
    }
  });

  it("fails when required fields are missing in Destination Guide", () => {
    const invalid = {
      cityName: "Denver"
      // hotelName and destinationTitle missing!
    };

    const res = resolveWithZod(DestinationGuideZodSchema, invalid);
    assert.strictEqual(res.success, false);
    if (!res.success) {
      assert(res.errors.some((e) => e.includes("hotelName")));
    }
  });

  it("validates Room Showcase schema with default starting rate and amenities", () => {
    const raw = {
      hotelName: "The Curtis",
      cityName: "Denver",
      roomTitle: "Penthouse Suite",
      roomDescription: "Spectacular downtown skyline views with custom pop-culture furnishings."
    };

    const res = resolveWithZod(RoomShowcaseZodSchema, raw);
    assert.strictEqual(res.success, true);
    if (res.success) {
      assert.strictEqual(res.data.roomStartingRate, "Best Available Rate");
      assert(res.data.roomAmenities.includes("King pillow-top bed"));
    }
  });

  it("validates Hotel FAQ schema with default hospitality policies", () => {
    const raw = {
      hotelName: "The Curtis",
      cityName: "Denver"
    };

    const res = resolveWithZod(HotelFaqZodSchema, raw);
    assert.strictEqual(res.success, true);
    if (res.success) {
      assert(res.data.checkInOutPolicy.includes("4:00 PM"));
      assert(res.data.parkingPolicy.includes("valet parking"));
      assert(res.data.petPolicy.includes("pet-friendly"));
    }
  });

  it("validates Page Metadata schema enforcing URL format and character ceilings", () => {
    const validMeta = {
      title: "Boutique Hotel in Downtown Denver | The Curtis",
      metaDescription: "Experience boutique luxury accommodations in downtown Denver near the arts district with on-site dining and games.",
      canonicalUrl: "https://example-boutique.com/overview/"
    };

    const res = resolveWithZod(PageMetadataZodSchema, validMeta);
    assert.strictEqual(res.success, true);

    const invalidMeta = {
      title: "Short",
      metaDescription: "Short",
      canonicalUrl: "not-a-url"
    };

    const failRes = resolveWithZod(PageMetadataZodSchema, invalidMeta);
    assert.strictEqual(failRes.success, false);
  });

  it("validates Site Manifest array schema for internal link graph", () => {
    const manifest = [
      {
        url: "https://example.com/denver/",
        primaryKeyword: "Denver Hotels",
        categoryHierarchy: ["Colorado", "Denver"]
      },
      {
        url: "https://example.com/denver/suites/",
        primaryKeyword: "Luxury Suites",
        parentPage: "https://example.com/denver/"
      }
    ];

    const res = resolveWithZod(SiteManifestZodSchema, manifest);
    assert.strictEqual(res.success, true);
  });
});
