"""Metrics aggregation for AI visibility runs."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from .runner import RunResult


def _week_of(iso_date: str) -> str:
    # ISO week string, e.g. "2026-W48"
    try:
        d = datetime.fromisoformat(iso_date.replace("Z", "+00:00"))
        return f"{d.isocalendar().year}-W{d.isocalendar().week:02d}"
    except Exception:
        return ""


def aggregate(results: list[RunResult], week: str | None = None) -> list[dict[str, Any]]:
    """Aggregate RunResults into metrics per entity x provider x language.

    Metrics:
      - mention_rate: fraction of runs where the brand was mentioned
      - first_mention_share: fraction of runs where this brand was the first
        mentioned among all entities (0 if not first)
      - citation_share: fraction of runs where the official domain was cited
      - language_gap: filled later by compute_language_gap()
    """
    week = week or _week_of(datetime.now(timezone.utc).isoformat())

    # group by (provider, language, entity)
    groups: dict[tuple[str, str, str], list[RunResult]] = defaultdict(list)
    for r in results:
        for brand in r.mentions:
            groups[(r.provider, r.language, brand)].append(r)

    metrics: list[dict[str, Any]] = []
    for (provider, lang, brand), runs in groups.items():
        n = len(runs)
        mentioned = sum(1 for r in runs if r.mentions[brand].mentioned)
        cited = sum(1 for r in runs if r.mentions[brand].cited)
        # first-mention: brand's first_offset is min among mentioned entities
        first_count = 0
        for r in runs:
            offsets = {b: m.first_offset for b, m in r.mentions.items() if m.mentioned}
            if offsets and offsets.get(brand, -1) >= 0:
                if offsets[brand] == min(offsets.values()):
                    first_count += 1
        metrics.append({
            "entity": brand,
            "provider": provider,
            "language": lang,
            "week": week,
            "n_runs": n,
            "mention_rate": round(mentioned / n, 4) if n else 0.0,
            "first_mention_share": round(first_count / n, 4) if n else 0.0,
            "citation_share": round(cited / n, 4) if n else 0.0,
        })

    # language gap: for each (provider, entity, intent?) compute bn vs en vs banglish.
    # Here we attach a per-entity language_gap comparing mention_rate across langs.
    by_entity_provider: dict[tuple[str, str], dict[str, float]] = defaultdict(dict)
    for m in metrics:
        by_entity_provider[(m["entity"], m["provider"])][m["language"]] = m["mention_rate"]

    for m in metrics:
        rates = by_entity_provider[(m["entity"], m["provider"])]
        en = rates.get("en", 0.0)
        bn = rates.get("bn", 0.0)
        bl = rates.get("banglish", 0.0)
        # language gap = max - min across the three scripts
        vals = [v for v in (en, bn, bl) if v is not None]
        gap = round(max(vals) - min(vals), 4) if vals else 0.0
        m["language_gap"] = gap
        m["rates_by_language"] = {"en": en, "bn": bn, "banglish": bl}

    return metrics
