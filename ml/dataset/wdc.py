"""Web Data Commons subset selection.

`ml/sources.yaml` admits only the Hotel / LodgingBusiness / Restaurant /
FAQPage / BreadcrumbList subsets of the WDC corpus, and only for
``schema_generation`` and ``page_classification``. This module encodes that
allow-list as code so a broad pull cannot quietly widen it.

Standard library only. No network: the caller downloads and hands over bytes.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, Iterator, List, Mapping, Optional, Sequence, Set

__all__ = [
    "ALLOWED_TYPES",
    "ALLOWED_TABLE_TYPES",
    "allowed_type",
    "filter_records",
    "select_subset",
    "SubsetReport",
]

#: The only ``@type`` values this plan admits from the JSON-LD / Microdata
#: corpus. Mirrors the `feeds` note on `wdc-2024` in ml/sources.yaml.
ALLOWED_TYPES: Set[str] = {
    "Hotel",
    "LodgingBusiness",
    "Restaurant",
    "FAQPage",
    "BreadcrumbList",
}

#: The table corpus is admitted for schema field coverage only.
ALLOWED_TABLE_TYPES: Set[str] = {"Hotel", "LodgingBusiness", "Restaurant", "FAQPage"}


@dataclass
class SubsetReport:
    """What a filter pass did — recorded so a dataset card can state it."""

    total: int = 0
    kept: int = 0
    kept_by_type: Dict[str, int] = field(default_factory=dict)
    rejected_unknown_type: int = 0
    rejected_malformed: int = 0
    warnings: List[str] = field(default_factory=list)

    def as_dict(self) -> Dict[str, Any]:
        return {
            "total": self.total,
            "kept": self.kept,
            "keptByType": dict(sorted(self.kept_by_type.items())),
            "rejectedUnknownType": self.rejected_unknown_type,
            "rejectedMalformed": self.rejected_malformed,
            "warnings": self.warnings,
        }


def _types_of(record: Mapping[str, Any]) -> List[str]:
    """Every ``@type`` on a record, including inside ``@graph``."""
    found: List[str] = []

    def walk(node: Any) -> None:
        if isinstance(node, list):
            for item in node:
                walk(item)
            return
        if not isinstance(node, Mapping):
            return
        raw = node.get("@type")
        values = raw if isinstance(raw, list) else [raw]
        for value in values:
            if isinstance(value, str) and value not in found:
                found.append(value)
        graph = node.get("@graph")
        if graph is not None:
            walk(graph)

    walk(record)
    return found


def allowed_type(record: Mapping[str, Any], *, table_corpus: bool = False) -> bool:
    """True when the record's ``@type`` is on the plan's allow-list."""
    allowed = ALLOWED_TABLE_TYPES if table_corpus else ALLOWED_TYPES
    return any(value in allowed for value in _types_of(record))


def filter_records(
    records: Iterable[Mapping[str, Any]], *, table_corpus: bool = False
) -> "tuple[List[Dict[str, Any]], SubsetReport]":
    """Keep only allow-listed records, and report what happened.

    Malformed records are counted and skipped rather than raised: a corpus
    always contains a few, and aborting on them would lose the batch.
    """
    report = SubsetReport()
    kept: List[Dict[str, Any]] = []

    for record in records:
        report.total += 1
        if not isinstance(record, Mapping):
            report.rejected_malformed += 1
            continue
        if not allowed_type(record, table_corpus=table_corpus):
            report.rejected_unknown_type += 1
            continue

        # Keep the whole record: the schema writer needs every field that the
        # page actually asserted, not just the type.
        kept.append(dict(record))
        report.kept += 1
        for value in _types_of(record):
            if value in (ALLOWED_TABLE_TYPES if table_corpus else ALLOWED_TYPES):
                report.kept_by_type[value] = report.kept_by_type.get(value, 0) + 1

    return kept, report


def select_subset(
    payload: Any, *, table_corpus: bool = False
) -> "tuple[List[Dict[str, Any]], SubsetReport]":
    """Select the allowed subset from a parsed WDC dump.

    Accepts either a list of records or an object with a ``records`` /
    ``items`` key, which is how the WDC releases are usually wrapped.
    """
    if isinstance(payload, Mapping):
        for key in ("records", "items", "data", "examples"):
            if key in payload and isinstance(payload[key], list):
                return filter_records(payload[key], table_corpus=table_corpus)
        # A single record rather than a wrapper.
        return filter_records([payload], table_corpus=table_corpus)

    if isinstance(payload, list):
        return filter_records(payload, table_corpus=table_corpus)

    report = SubsetReport()
    report.warnings.append(f"unsupported payload shape: {type(payload).__name__}")
    return [], report


def parse_lines(payload: bytes) -> "tuple[List[Dict[str, Any]], int]":
    """Parse a JSONL dump, skipping bad lines.

    Returns ``(records, malformed_count)``. WDC ships JSONL; one corrupt line
    must not discard the rest of the file.
    """
    records: List[Dict[str, Any]] = []
    malformed = 0
    for line in payload.decode("utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            parsed = json.loads(line)
        except json.JSONDecodeError:
            malformed += 1
            continue
        if isinstance(parsed, dict):
            records.append(parsed)
        else:
            malformed += 1
    return records, malformed
