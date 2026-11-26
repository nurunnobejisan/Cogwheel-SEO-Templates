/**
 * Expert-in-the-loop training capture (Studio → training triple).
 *
 * The operator reviews AI-proposed copy in the Content Studio, accepts/rejects
 * each section and edits the ones that need it. The accepted, edited result is
 * the *expert fix*; the deterministic per-section validation is the *audit*.
 * That pair is what the LoRA export trains on (`buildLoraExample`).
 *
 * This module is deliberately pure/client-safe: `buildStudioCapture` has no
 * side effects (unit-testable without a DOM), and `captureTrainingTriple` is a
 * thin typed wrapper over the existing capture API.
 *
 * Provenance: the audit here is derived from operator-supplied inputs, not a
 * live crawl, so we mark it `estimated` — never `measured`. Nothing in the
 * payload invents search volume, CPC, rankings or traffic.
 */

import { postJson } from "./api";

export type CaptureProvenance = "measured" | "estimated" | "unavailable";

export interface StudioCaptureProperty {
  name: string;
  url: string;
  brand: string;
  city: string;
  state: string;
}

export interface StudioCaptureSection {
  sectionId: string;
  label: string;
  targetKeyword: string | null;
  /** Operator opt-in: accepted sections only are contributed. */
  accepted: boolean;
  /** Existing copy the operator pasted for the page. */
  liveCopy: string;
  /** The model's original proposal, kept so a preference/edit signal is visible. */
  aiDraft: string;
  /** The operator's final copy (AI draft, possibly edited). */
  finalCopy: string;
  /** Measured from the strings above by `validateSection`. */
  charCount: number;
  limitLabel: string;
  overLimit: boolean;
  valid: boolean;
  keywordPresent: boolean;
  violations: string[];
}

export interface StudioCaptureInput {
  property: StudioCaptureProperty;
  sections: StudioCaptureSection[];
}

export interface StudioCapturePayload {
  /** What the page looked like + the draft the model produced. */
  audit: {
    source: "content-studio";
    property: StudioCaptureProperty;
    drafts: Record<string, string>;
    findings: Array<{
      sectionId: string;
      label: string;
      targetKeyword: string | null;
      charCount: number;
      limitLabel: string;
      overLimit: boolean;
      valid: boolean;
      keywordPresent: boolean;
      liveCopyPresent: boolean;
      violations: string[];
    }>;
  };
  /** The operator's accepted, edited copy — the expert fix. */
  expertFix: {
    source: "content-studio";
    sections: Record<string, string>;
    accepted: string[];
    edited: string[];
  };
}

/**
 * Build the audit + expert-fix pair from the Studio review state.
 *
 * Returns `null` when there is nothing to contribute (no accepted section with
 * copy), so callers can disable the action rather than send an empty triple.
 * Rejected sections are omitted from the fix but still reported in the audit so
 * the "don't change this page" signal is preserved.
 */
export function buildStudioCapture(input: StudioCaptureInput): StudioCapturePayload | null {
  const accepted = input.sections.filter((s) => s.accepted && s.finalCopy.trim().length > 0);
  if (accepted.length === 0) return null;

  const drafts: Record<string, string> = {};
  for (const section of accepted) drafts[section.sectionId] = section.aiDraft;

  const sections: Record<string, string> = {};
  const edited: string[] = [];
  for (const section of accepted) {
    sections[section.sectionId] = section.finalCopy;
    if (section.finalCopy !== section.aiDraft) edited.push(section.sectionId);
  }

  return {
    audit: {
      source: "content-studio",
      property: input.property,
      drafts,
      findings: input.sections.map((section) => ({
        sectionId: section.sectionId,
        label: section.label,
        targetKeyword: section.targetKeyword,
        charCount: section.charCount,
        limitLabel: section.limitLabel,
        overLimit: section.overLimit,
        valid: section.valid,
        keywordPresent: section.keywordPresent,
        liveCopyPresent: section.liveCopy.trim().length > 0,
        violations: section.violations,
      })),
    },
    expertFix: {
      source: "content-studio",
      sections,
      accepted: accepted.map((section) => section.sectionId),
      edited,
    },
  };
}

export interface TrainingCaptureRequest {
  url: string;
  audit: unknown;
  expertFix: unknown;
  consent: true;
  tosAccepted: true;
  provenance: CaptureProvenance;
}

export interface TrainingCaptureResponse {
  success: boolean;
  id: string;
  quality: string;
  trainingEligible: boolean;
  persistenceNote: string | null;
}

/** POST a reviewed fix to the capture API. Throws with the server message on failure. */
export function captureTrainingTriple(request: TrainingCaptureRequest): Promise<TrainingCaptureResponse> {
  return postJson<TrainingCaptureResponse>("/api/training-triples", request);
}
