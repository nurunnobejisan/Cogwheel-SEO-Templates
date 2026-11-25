/**
 * Universal Rule Engine — Pillar 1: Metadata & Headings
 *
 * Title tag, meta description and heading structure evaluation applied to any
 * web property in Universal Mode.
 */

import type { AuditIssue, AuditRule } from "../types.ts";
import { makeIssue } from "../issues.ts";
import { calculatePixelWidth } from "../../validators/serpOptimizer.ts";

export const TITLE_MIN_CHARS = 40;
export const TITLE_MAX_CHARS = 60;
export const TITLE_MAX_PX = 580;
export const META_DESC_MIN_CHARS = 120;
export const META_DESC_MAX_CHARS = 160;
export const META_DESC_MAX_PX = 920;

export const titlePresenceRule: AuditRule = {
  id: "universal/metadata/title-presence",
  pillar: "metadata",
  description: "Every indexable page must declare a non-empty <title>.",
  evaluate({ snapshot }) {
    if (snapshot.title.trim().length > 0) {
      return [];
    }
    return [
      makeIssue({
        issueId: "iss_title_missing",
        category: "metadata",
        severity: "critical",
        cmsTargetField: "title",
        currentValue: "",
        selector: "head > title",
        recommendedAction:
          "Write a unique 40–60 character title that states the primary topic and brand.",
      }),
    ];
  },
};

export const titleLengthRule: AuditRule = {
  id: "universal/metadata/title-length",
  pillar: "metadata",
  description: "Title tags should stay within 40–60 characters and the 580px SERP ceiling.",
  evaluate({ snapshot }) {
    const title = snapshot.title.trim();
    if (!title) {
      return [];
    }
    const charCount = title.length;
    const pixelWidth = calculatePixelWidth(title);
    const issues: AuditIssue[] = [];

    if (charCount < TITLE_MIN_CHARS) {
      issues.push(
        makeIssue({
          issueId: "iss_title_too_short",
          category: "metadata",
          severity: "medium",
          cmsTargetField: "title",
          currentValue: charCount,
          selector: "head > title",
          recommendedAction: `Expand the title to at least ${TITLE_MIN_CHARS} characters with a clear value proposition.`,
        })
      );
    } else if (charCount > TITLE_MAX_CHARS || pixelWidth > TITLE_MAX_PX) {
      issues.push(
        makeIssue({
          issueId: "iss_title_too_long",
          category: "metadata",
          severity: "medium",
          cmsTargetField: "title",
          currentValue: `${charCount} chars / ${pixelWidth}px`,
          selector: "head > title",
          recommendedAction: `Trim the title to ${TITLE_MAX_CHARS} characters (≤${TITLE_MAX_PX}px) without cutting mid-word.`,
        })
      );
    }

    return issues;
  },
};

export const metaDescriptionPresenceRule: AuditRule = {
  id: "universal/metadata/meta-description-presence",
  pillar: "metadata",
  description: "Every indexable page should declare a meta description.",
  evaluate({ snapshot }) {
    if (snapshot.metaDescription.trim().length > 0) {
      return [];
    }
    return [
      makeIssue({
        issueId: "iss_meta_desc_missing",
        category: "metadata",
        severity: "high",
        cmsTargetField: "meta_description",
        currentValue: "",
        selector: "head > meta[name='description']",
        recommendedAction:
          "Generate a compelling 140-character meta description containing the target entity and a call to action.",
      }),
    ];
  },
};

export const metaDescriptionLengthRule: AuditRule = {
  id: "universal/metadata/meta-description-length",
  pillar: "metadata",
  description: "Meta descriptions should be 120–160 characters to avoid SERP truncation.",
  evaluate({ snapshot }) {
    const description = snapshot.metaDescription.trim();
    if (!description) {
      return [];
    }
    const charCount = description.length;

    if (charCount < META_DESC_MIN_CHARS) {
      return [
        makeIssue({
          issueId: "iss_meta_desc_too_short",
          category: "metadata",
          severity: "low",
          cmsTargetField: "meta_description",
          currentValue: charCount,
          selector: "head > meta[name='description']",
          recommendedAction: `Extend the meta description to at least ${META_DESC_MIN_CHARS} characters.`,
        }),
      ];
    }

    if (charCount > META_DESC_MAX_CHARS) {
      return [
        makeIssue({
          issueId: "iss_meta_desc_too_long",
          category: "metadata",
          severity: "low",
          cmsTargetField: "meta_description",
          currentValue: `${charCount} chars / ${calculatePixelWidth(description)}px`,
          selector: "head > meta[name='description']",
          recommendedAction: `Shorten the meta description to ${META_DESC_MAX_CHARS} characters so it is not truncated.`,
        }),
      ];
    }

    return [];
  },
};

export const h1PresenceRule: AuditRule = {
  id: "universal/metadata/h1-presence",
  pillar: "metadata",
  description: "Enforce exactly one non-empty primary <h1> per page.",
  evaluate({ snapshot }) {
    const h1s = snapshot.headings.filter((h) => h.level === 1);
    const issues: AuditIssue[] = [];

    if (h1s.length === 0) {
      issues.push(
        makeIssue({
          issueId: "iss_h1_missing",
          category: "metadata",
          severity: "critical",
          cmsTargetField: "h1",
          currentValue: null,
          selector: "h1",
          recommendedAction:
            "Add a single descriptive <h1> reflecting the page's primary topic.",
        })
      );
    } else if (h1s.length > 1) {
      issues.push(
        makeIssue({
          issueId: "iss_h1_multiple",
          category: "metadata",
          severity: "medium",
          cmsTargetField: "h1",
          currentValue: h1s.length,
          selector: "h1",
          recommendedAction:
            "Keep one primary <h1> and convert the remaining H1s to <h2>.",
        })
      );
    }

    const emptyHeadings = snapshot.headings.filter((h) => !h.text.trim());
    if (emptyHeadings.length > 0) {
      issues.push(
        makeIssue({
          issueId: "iss_heading_empty",
          category: "metadata",
          severity: "low",
          cmsTargetField: "heading_text",
          currentValue: emptyHeadings.length,
          selector: `h${emptyHeadings[0]!.level}`,
          recommendedAction:
            "Populate empty heading tags with descriptive text or remove them.",
        })
      );
    }

    return issues;
  },
};

export const headingHierarchyRule: AuditRule = {
  id: "universal/metadata/heading-hierarchy",
  pillar: "metadata",
  description: "Heading levels must descend logically without skipped ranks.",
  evaluate({ snapshot }) {
    let previousLevel = 0;
    let skipSelector = "";
    let skipFrom = 0;
    let skipTo = 0;

    for (const heading of snapshot.headings) {
      if (previousLevel !== 0 && heading.level > previousLevel + 1) {
        skipFrom = previousLevel;
        skipTo = heading.level;
        skipSelector = `h${heading.level}`;
        break;
      }
      previousLevel = heading.level;
    }

    if (!skipSelector) {
      return [];
    }

    return [
      makeIssue({
        issueId: "iss_heading_hierarchy_skip",
        category: "metadata",
        severity: "medium",
        cmsTargetField: "heading_structure",
        currentValue: `h${skipFrom} → h${skipTo}`,
        selector: skipSelector,
        recommendedAction: `Insert the missing h${skipFrom + 1} level so the hierarchy descends one rank at a time.`,
      }),
    ];
  },
};

export const METADATA_RULES: AuditRule[] = [
  titlePresenceRule,
  titleLengthRule,
  metaDescriptionPresenceRule,
  metaDescriptionLengthRule,
  h1PresenceRule,
  headingHierarchyRule,
];
