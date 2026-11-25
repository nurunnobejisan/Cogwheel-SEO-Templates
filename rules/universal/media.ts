/**
 * Universal Rule Engine — Pillar 3: Media & Accessibility
 *
 * Image alt-text coverage, next-gen asset formats, explicit dimensions (CLS)
 * and oversizing detection.
 */

import type { AuditIssue, AuditRule, ImageAsset } from "../types.ts";
import { makeIssue } from "../issues.ts";

export const LEGACY_IMAGE_FORMATS = new Set(["jpg", "jpeg", "png", "gif", "bmp", "tiff"]);
export const NEXT_GEN_IMAGE_FORMATS = new Set(["webp", "avif", "svg"]);
export const OVERSIZE_RATIO = 2;

function imageFormat(image: ImageAsset): string {
  if (image.format) {
    return image.format.toLowerCase().replace(/^\./, "");
  }
  const match = /\.([a-z0-9]+)(?:\?|#|$)/i.exec(image.src);
  return match && match[1] ? match[1].toLowerCase() : "";
}

export const imageAltTextRule: AuditRule = {
  id: "universal/media/image-alt-text",
  pillar: "accessibility",
  description: "Flag images with missing or empty alt attributes.",
  evaluate({ snapshot }) {
    const issues: AuditIssue[] = [];
    for (const image of snapshot.images) {
      if (image.alt !== null && image.alt.trim().length > 0) {
        continue;
      }
      issues.push(
        makeIssue({
          issueId: "iss_img_alt_missing",
          category: "accessibility",
          severity: "medium",
          cmsTargetField: "image_alt_text",
          currentValue: image.alt,
          selector: `img[src="${shorten(image.src)}"]`,
          imageSrc: image.src,
          recommendedAction:
            "Generate concise, descriptive alt text describing the image content and context.",
        })
      );
    }
    return issues;
  },
};

export const imageFormatRule: AuditRule = {
  id: "universal/media/image-format",
  pillar: "media",
  description: "Recommend next-gen image formats (WebP/AVIF) over legacy formats.",
  evaluate({ snapshot }) {
    const issues: AuditIssue[] = [];
    for (const image of snapshot.images) {
      const format = imageFormat(image);
      if (!format || !LEGACY_IMAGE_FORMATS.has(format)) {
        continue;
      }
      issues.push(
        makeIssue({
          issueId: "iss_img_legacy_format",
          category: "media",
          severity: "low",
          cmsTargetField: "image_url",
          currentValue: format,
          selector: `img[src="${shorten(image.src)}"]`,
          imageSrc: image.src,
          recommendedAction:
            "Convert the asset to WebP or AVIF and serve it via a responsive srcset.",
        })
      );
    }
    return issues;
  },
};

export const imageDimensionsRule: AuditRule = {
  id: "universal/media/image-dimensions",
  pillar: "media",
  description: "Images need explicit width/height to prevent layout shift (CLS).",
  evaluate({ snapshot }) {
    const issues: AuditIssue[] = [];
    for (const image of snapshot.images) {
      if (image.width !== null && image.height !== null) {
        continue;
      }
      issues.push(
        makeIssue({
          issueId: "iss_img_missing_dimensions",
          category: "media",
          severity: "low",
          cmsTargetField: "image_dimensions",
          currentValue: `width=${image.width ?? "auto"}, height=${image.height ?? "auto"}`,
          selector: `img[src="${shorten(image.src)}"]`,
          imageSrc: image.src,
          recommendedAction:
            "Declare intrinsic width and height attributes (or an aspect-ratio) on the element.",
        })
      );
    }
    return issues;
  },
};

export const imageOversizeRule: AuditRule = {
  id: "universal/media/image-oversize",
  pillar: "media",
  description: `Flag assets wider than ${OVERSIZE_RATIO}x their rendered size.`,
  evaluate({ snapshot }) {
    const issues: AuditIssue[] = [];
    for (const image of snapshot.images) {
      if (
        image.width === null ||
        image.renderedWidth === null ||
        image.renderedWidth === undefined ||
        image.renderedWidth <= 0
      ) {
        continue;
      }
      if (image.width <= image.renderedWidth * OVERSIZE_RATIO) {
        continue;
      }
      issues.push(
        makeIssue({
          issueId: "iss_img_oversized",
          category: "media",
          severity: "medium",
          cmsTargetField: "image_url",
          currentValue: `${image.width}px intrinsic / ${image.renderedWidth}px rendered`,
          selector: `img[src="${shorten(image.src)}"]`,
          imageSrc: image.src,
          recommendedAction: `Serve a variant at ~${image.renderedWidth}px or generate a responsive srcset.`,
        })
      );
    }
    return issues;
  },
};

function shorten(src: string): string {
  return src.length > 80 ? `${src.slice(0, 77)}...` : src;
}

export const MEDIA_RULES: AuditRule[] = [
  imageAltTextRule,
  imageFormatRule,
  imageDimensionsRule,
  imageOversizeRule,
];
