"""Lighthouse labelling — technical SEO labels from our own crawl.

The ``lighthouse-labels`` source in ``ml/sources.yaml`` is Apache-2.0 and
produces labels from a crawl **we** run, cross-checked against the rules
engine. That cross-check is the point: a label the rules engine disagrees
with is discarded rather than trusted.

Standard library only. Lighthouse itself is invoked by the caller
(``npx lighthouse --output=json``); this module turns its JSON report into
labels and performs the disagreement check. Scores are reported as
``provenance: "measured"`` only because they come from an actual run on an
actual page — never synthesised.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple

__all__ = ["LighthouseLabels", "labels_from_report", "cross_check", "to_example_input"]

#: Lighthouse categories we keep. Only these become labels.
CATEGORIES = ("performance", "accessibility", "best-practices", "seo")

#: Lighthouse audit ids whose failure maps onto a rules-engine issue id. This
#: is the bridge used by :func:`cross_check`.
AUDIT_TO_ISSUE: Dict[str, str] = {
    "document-title": "iss_title_missing",
    "meta-description": "iss_meta_description_missing",
    "canonical": "iss_canonical_missing",
    "viewport": "iss_viewport_missing",
    "image-alt": "iss_img_alt_missing",
    "html-has-lang": "iss_html_lang_missing",
    "robots-txt": "iss_robots_txt_missing",
    "hreflang": "iss_hreflang_missing",
    "structured-data": "iss_schema_missing",
}


@dataclass
class LighthouseLabels:
    """Labels extracted from one Lighthouse run."""

    scores: Dict[str, Optional[float]] = field(default_factory=dict)
    failed_audits: List[str] = field(default_factory=list)
    #: rules-engine issue ids implied by the failed audits
    implied_issues: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    fetched_at: str = ""
    final_url: str = ""

    def as_dict(self) -> Dict[str, Any]:
        return {
            "scores": self.scores,
            "failedAudits": self.failed_audits,
            "impliedIssues": self.implied_issues,
            "warnings": self.warnings,
            "fetchedAt": self.fetched_at,
            "finalUrl": self.final_url,
        }


def labels_from_report(report: Mapping[str, Any]) -> LighthouseLabels:
    """Convert a Lighthouse JSON report into labels.

    Never raises on a partial report: missing categories become ``None``
    rather than a fabricated 0, because ``0`` would be an invented metric.
    """
    labels = LighthouseLabels()

    categories = report.get("categories")
    if not isinstance(categories, Mapping):
        labels.warnings.append("report has no `categories` object; scores omitted")
        categories = {}

    for name in CATEGORIES:
        entry = categories.get(name)
        if isinstance(entry, Mapping) and isinstance(entry.get("score"), (int, float)):
            # Lighthouse scores are 0-1; keep them 0-1 and let the caller scale.
            labels.scores[name] = float(entry["score"])
        else:
            labels.scores[name] = None
            labels.warnings.append(f"category {name!r} has no numeric score")

    audits = report.get("audits")
    if not isinstance(audits, Mapping):
        labels.warnings.append("report has no `audits` object; no failure labels")
        audits = {}

    for audit_id, issue_id in AUDIT_TO_ISSUE.items():
        audit = audits.get(audit_id)
        if not isinstance(audit, Mapping):
            continue
        score = audit.get("score")
        # Lighthouse: 0 = fail, 1 = pass, None = not applicable / error.
        if score == 0:
            labels.failed_audits.append(audit_id)
            labels.implied_issues.append(issue_id)

    labels.final_url = str(report.get("finalDisplayedUrl") or report.get("finalUrl") or "")
    labels.fetched_at = str(report.get("fetchTime") or "")
    if not labels.final_url:
        labels.warnings.append("report has no final URL")
    return labels


def cross_check(
    labels: LighthouseLabels, rules_issue_ids: Sequence[str]
) -> Tuple[List[str], List[str]]:
    """Compare Lighthouse-implied issues against real rules-engine findings.

    Returns ``(agreed, discarded)``.

    ``agreed`` are implied issues the rules engine also reported — these are
    safe to keep as labels. ``discarded`` are implied issues the rules engine
    did **not** report; they are dropped, because the rules engine is the only
    source of scores (rule 2) and a Lighthouse disagreement is not evidence
    against it.
    """
    actual = set(rules_issue_ids)
    agreed: List[str] = []
    discarded: List[str] = []
    for issue_id in labels.implied_issues:
        (agreed if issue_id in actual else discarded).append(issue_id)
    return agreed, discarded


def to_example_input(
    labels: LighthouseLabels, *, domain: str, url: Optional[str] = None
) -> Dict[str, Any]:
    """Shape labels into the ``input`` half of an ``MlExample``.

    ``provenance`` is decided by the caller; this only assembles the dict.
    ``domainHash`` is used instead of the raw domain so a split grouping key
    never leaks the domain itself.
    """
    import hashlib

    payload: Dict[str, Any] = {
        "domainHash": hashlib.sha256(domain.encode("utf-8")).hexdigest()[:16],
        "measured": {
            "lighthouseScores": labels.scores,
            "failedLighthouseAudits": sorted(labels.failed_audits),
        },
    }
    if url:
        payload["url"] = url
    if labels.final_url and not url:
        payload["url"] = labels.final_url
    return payload


def parse_report(text: str) -> LighthouseLabels:
    """Parse Lighthouse JSON output from a string (convenience wrapper)."""
    try:
        report = json.loads(text)
    except json.JSONDecodeError as exc:
        labels = LighthouseLabels()
        labels.warnings.append(f"invalid Lighthouse JSON: {exc}")
        return labels
    if not isinstance(report, Mapping):
        labels = LighthouseLabels()
        labels.warnings.append("Lighthouse report is not a JSON object")
        return labels
    return labels_from_report(report)
