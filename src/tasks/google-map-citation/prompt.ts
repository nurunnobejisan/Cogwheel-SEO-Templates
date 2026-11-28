import type {
  GoogleMapCitationDraft,
  GoogleMapCitationInput,
} from "./schema";

export function buildGoogleMapCitationPrompt(opts: {
  input: GoogleMapCitationInput;
  feedback?: string[];
}): { system: string; prompt: string } {
  const system = `You are a Principal Local SEO & Google Business Profile Specialist at SEO Studio.
Audit Name, Address, Phone (NAP) citation consistency, local directory coverage, and Google Business Profile category alignment for hotel properties.
Never fabricate citation listings. Output strictly valid JSON conforming to the schema.`;

  const prompt = `Hotel Property Details (Source of Truth):
Name: ${opts.input.property.name}
Brand: ${opts.input.property.brand}
Address: ${opts.input.property.address || "Main Street"}
City: ${opts.input.property.city}, State: ${opts.input.property.state} Zip: ${opts.input.property.zip ?? "N/A"}
Phone: ${opts.input.property.phone || "N/A"}
Website: ${opts.input.property.url}

${opts.feedback && opts.feedback.length > 0 ? `PREVIOUS VALIDATION ERRORS:\n${opts.feedback.join("\n")}\n` : ""}

Generate a Google Map Citation & NAP audit report across the top 10-15 major local and hospitality directories (e.g., Google Maps, Apple Maps, Bing Places, TripAdvisor, Yelp, YellowPages, Chamber of Commerce, Visit Local CVB).
Output JSON:
{
  "napConsistencyScore": number (0-100),
  "gbpCategoryRecommendation": {
    "primaryCategory": string (e.g., "Hotel", "Boutique Hotel", "Resort Hotel"),
    "secondaryCategories": string[] (e.g., "Wedding Venue", "Restaurant", "Conference Center"),
    "categoryRationale": string
  },
  "citationDirectoryAudits": [
    {
      "directoryName": string,
      "domain": string,
      "domainAuthority": integer (0-100) or null,
      "status": "verified_consistent" | "nap_discrepancy" | "missing_listing" | "unclaimed",
      "currentName": string,
      "currentAddress": string,
      "currentPhone": string,
      "fixAction": string
    }
  ],
  "napDiscrepancies": [
    {
      "directory": string,
      "discrepancyType": "name" | "address" | "phone" | "url",
      "foundValue": string,
      "expectedValue": string
    }
  ],
  "immediateFixChecklist": string[]
}`;

  return { system, prompt };
}

export function parseGoogleMapCitationDraft(
  rawText: string,
): GoogleMapCitationDraft {
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ?? [null, rawText];
  const cleaned = jsonMatch[1]?.trim() ?? rawText.trim();
  return JSON.parse(cleaned);
}
