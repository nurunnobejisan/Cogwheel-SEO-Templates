import { describe, expect, it, vi } from "vitest";
import {
  buildStudioCapture,
  captureTrainingTriple,
  type StudioCaptureSection,
} from "../src/lib/training-capture";

function section(overrides: Partial<StudioCaptureSection> = {}): StudioCaptureSection {
  return {
    sectionId: "home-headline",
    label: "Home Headline",
    targetKeyword: "boutique hotel downtown",
    accepted: true,
    liveCopy: "Old headline",
    aiDraft: "Stay at the Grand Downtown",
    finalCopy: "Stay at the Grand Downtown",
    charCount: 28,
    limitLabel: "≤ 50 chars",
    overLimit: false,
    valid: true,
    keywordPresent: true,
    violations: [],
    ...overrides,
  };
}

const PROPERTY = { name: "Grand", url: "https://grand.example", brand: "Hilton Hotels & Resorts", city: "Miami", state: "FL" };

describe("buildStudioCapture", () => {
  it("returns null when nothing is accepted (never sends an empty triple)", () => {
    expect(buildStudioCapture({ property: PROPERTY, sections: [section({ accepted: false })] })).toBeNull();
    expect(buildStudioCapture({ property: PROPERTY, sections: [section({ finalCopy: "   " })] })).toBeNull();
    expect(buildStudioCapture({ property: PROPERTY, sections: [] })).toBeNull();
  });

  it("sends only accepted sections in the fix but reports every section in the audit", () => {
    const payload = buildStudioCapture({
      property: PROPERTY,
      sections: [
        section({ sectionId: "home-headline" }),
        section({ sectionId: "location", accepted: false, aiDraft: "draft", finalCopy: "draft" }),
      ],
    });
    expect(payload).not.toBeNull();
    expect(Object.keys(payload!.expertFix.sections)).toEqual(["home-headline"]);
    expect(payload!.expertFix.accepted).toEqual(["home-headline"]);
    // Rejected section still appears as a finding (the "don't change this page" signal).
    expect(payload!.audit.findings.map((f) => f.sectionId)).toEqual(["home-headline", "location"]);
  });

  it("flags sections whose final copy differs from the AI draft as edited", () => {
    const payload = buildStudioCapture({
      property: PROPERTY,
      sections: [
        section({ sectionId: "home-headline" }),
        section({ sectionId: "location", aiDraft: "AI wording", finalCopy: "Operator wording" }),
      ],
    });
    expect(payload!.expertFix.edited).toEqual(["location"]);
    expect(payload!.expertFix.sections["location"]).toBe("Operator wording");
  });

  it("carries measured checks and the draft into the audit", () => {
    const payload = buildStudioCapture({
      property: PROPERTY,
      sections: [
        section({
          charCount: 61,
          overLimit: true,
          valid: false,
          keywordPresent: false,
          violations: ["Home Headline exceeds 50 characters (61/50)"],
        }),
      ],
    });
    const finding = payload!.audit.findings[0]!;
    expect(finding).toMatchObject({ charCount: 61, overLimit: true, valid: false, keywordPresent: false });
    expect(finding.violations).toHaveLength(1);
    expect(payload!.audit.drafts["home-headline"]).toBe("Stay at the Grand Downtown");
    expect(payload!.audit.source).toBe("content-studio");
  });
});

describe("captureTrainingTriple", () => {
  it("POSTs the reviewed fix to the capture API with consent and provenance", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, id: "abc123", quality: "raw", trainingEligible: false, persistenceNote: null }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = {
      property: PROPERTY,
      sections: [section()],
    };
    const payload = buildStudioCapture(input)!;
    const res = await captureTrainingTriple({
      url: PROPERTY.url,
      audit: payload.audit,
      expertFix: payload.expertFix,
      consent: true,
      tosAccepted: true,
      provenance: "estimated",
    });

    expect(res.id).toBe("abc123");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/training-triples");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ url: PROPERTY.url, consent: true, tosAccepted: true, provenance: "estimated" });
    expect(body.expertFix.source).toBe("content-studio");

    vi.unstubAllGlobals();
  });

  it("throws the server error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: "duplicate url" }) }),
    );
    await expect(
      captureTrainingTriple({
        url: PROPERTY.url,
        audit: {},
        expertFix: {},
        consent: true,
        tosAccepted: true,
        provenance: "estimated",
      }),
    ).rejects.toThrow("duplicate url");
    vi.unstubAllGlobals();
  });
});
