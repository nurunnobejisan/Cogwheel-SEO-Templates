/**
 * Task 6.1 — Universal Studio branding & manifest update.
 *
 * Done criterion: user-facing text is Universal SEO & GEO Studio with hotel
 * as Pack #1, and the extension manifest name/description are updated.
 * Locks the suite-level surfaces so hotel-only framing cannot creep back:
 * site metadata, extension manifest, README tagline, options consent copy.
 * (Hotel-specific *content* — the templates catalog, brand presets, mock
 * competitor fixtures — is Pack #1 material and stays hotel-labeled.)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { metadata as homeMeta } from "../src/app/page";
import { metadata as templatesMeta } from "../src/app/templates/page";
import { metadata as archMeta } from "../src/app/architecture/page";
import manifest from "../chrome-extension/public/manifest.json";

/** Words that frame the *suite* as hotel-only rather than naming Pack #1. */
const HOTEL_SUITE_WORDS = /hospitality|lodging|marriott|hilton|ihg|hyatt/i;

const root = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

describe("Task 6.1 — universal suite branding", () => {
  it("root layout metadata is universal with six vertical packs", () => {
    const source = read("src/app/layout.tsx");
    // Scope to the exported metadata: the file also contains internal color
    // tokens (e.g. `to-hilton`) that are not user-facing text.
    const metadataBlock = source.slice(
      source.indexOf("export const metadata"),
      source.indexOf("export default")
    );
    expect(metadataBlock).not.toContain("Hotel Search Engine Suite");
    expect(metadataBlock).not.toMatch(HOTEL_SUITE_WORDS);
    expect(metadataBlock).toContain("six vertical packs, hotel first");
  });

  it("home page metadata drops hotel-only suite framing", () => {
    const title = String(homeMeta.title);
    const desc = String(homeMeta.description);
    expect(title).not.toMatch(/hotel/i);
    expect(desc).not.toMatch(HOTEL_SUITE_WORDS);
    expect(desc).toContain("six vertical packs, hotel first");
    // Still under the strict route rules enforced in route-metadata.test.
    expect(title.length).toBeGreaterThanOrEqual(50);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(desc.length).toBeGreaterThanOrEqual(145);
    expect(desc.length).toBeLessThanOrEqual(155);
  });

  it("architecture metadata carries no hotel-only framing", () => {
    expect(String(archMeta.title)).not.toMatch(/hotel/i);
    expect(String(archMeta.description)).not.toMatch(HOTEL_SUITE_WORDS);
  });

  it("templates catalog is framed as Hotel Pack #1 of six verticals", () => {
    const title = String(templatesMeta.title);
    const desc = String(templatesMeta.description);
    expect(title).toContain("Hotel Pack #1");
    expect(desc).toContain("Pack #1 of six verticals");
    // Franchise-list framing belonged to the old hotel-only copy.
    expect(desc).not.toMatch(/marriott|hilton|ihg|hyatt/i);
    expect(title.length).toBeGreaterThanOrEqual(50);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(desc.length).toBeGreaterThanOrEqual(145);
    expect(desc.length).toBeLessThanOrEqual(155);
  });

  it("extension manifest name and description are universal", () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toContain("SEO & GEO Studio");
    expect(manifest.description).not.toMatch(HOTEL_SUITE_WORDS);
    expect(manifest.description).not.toMatch(/hotel/i);
    expect(manifest.description).toContain("six vertical packs");
    // Chrome caps MV3 descriptions at 132 characters.
    expect(manifest.description.length).toBeLessThanOrEqual(132);
  });

  it("README leads with the universal tagline and hotel as Pack #1", () => {
    const readme = read("README.md");
    expect(readme).not.toContain("Hospitality SEO auditing");
    expect(readme).toContain("**Universal SEO auditing");
    expect(readme).toContain("six vertical packs");
    expect(readme).toContain("Pack #1");
  });

  it("options consent copy is vertical-neutral", () => {
    const options = read("chrome-extension/src/options/OptionsApp.tsx");
    expect(options).not.toContain("hotel search optimization");
    expect(options).not.toContain("allowlisted hotel domains");
  });
});
