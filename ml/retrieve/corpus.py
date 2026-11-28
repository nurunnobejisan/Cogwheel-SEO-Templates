"""Corpus assembly behind the licence gate.

A corpus is JSONL: one chunk record per line, the shape produced by
:func:`ml.retrieve.chunk.chunk_document`. Every record's ``source`` must be
declared in ``ml/sources.yaml`` (read through ``ml.registry``), and a record
whose source cannot enter the requested split is rejected here — the same
gate the dataset builders use, so a corpus cannot smuggle an ``avoid`` source
into training.

Standard library only; extraction reuses :mod:`ml.extract` (bs4 fallback in
CI). Network I/O is the caller's job: hand over bytes, not URLs.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple

from ml.registry import LicenceError, load_registry

from .chunk import chunk_document

__all__ = [
    "CorpusError",
    "CorpusReport",
    "validate_chunks",
    "load_corpus",
    "save_corpus",
    "build_from_html",
]

REQUIRED_FIELDS = ("id", "title", "text", "source", "tags")


class CorpusError(LicenceError):
    """A corpus record is malformed or licence-ineligible."""


@dataclass
class CorpusReport:
    """What a build pass did — recorded so a dataset card can state it."""

    documents: int = 0
    chunks: int = 0
    skipped: int = 0
    sources: Dict[str, int] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)

    def as_dict(self) -> Dict[str, Any]:
        return {
            "documents": self.documents,
            "chunks": self.chunks,
            "skipped": self.skipped,
            "sources": dict(sorted(self.sources.items())),
            "warnings": self.warnings,
        }


def validate_chunks(
    chunks: Iterable[Mapping[str, Any]], *, split: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Validate chunk records against the schema and the licence registry.

    ``split`` (``train`` / ``eval`` / ``test``) additionally runs the rule-3
    gate: an ``avoid`` or ``eval_only`` source cannot appear in a train
    corpus. Attribution-required sources must carry an ``attribution`` note
    naming the source, so the duty travels with the data.
    """
    registry = load_registry()
    out: List[Dict[str, Any]] = []
    seen_ids: set = set()

    for position, raw in enumerate(chunks):
        if not isinstance(raw, Mapping):
            raise CorpusError(f"chunk {position}: expected an object, got {type(raw).__name__}")
        missing = [f for f in REQUIRED_FIELDS if f not in raw]
        if missing:
            raise CorpusError(f"chunk {position}: missing fields {missing}")

        source_id = str(raw["source"])
        entry = registry.require(source_id)  # unknown id -> LicenceError
        if split:
            registry.assert_trainable(source_id, split)

        if entry.needs_attribution:
            notice = str(raw.get("attribution") or "")
            haystack = notice.lower()
            if entry.id.lower() not in haystack and entry.name.lower() not in haystack:
                raise CorpusError(
                    f"chunk {position}: source {source_id!r} requires attribution — "
                    "set an `attribution` note naming the source"
                )

        text = str(raw["text"])
        if not text.strip():
            raise CorpusError(f"chunk {position}: empty text")
        chunk_id = str(raw["id"])
        if chunk_id in seen_ids:
            raise CorpusError(f"chunk {position}: duplicate id {chunk_id!r}")
        seen_ids.add(chunk_id)

        url = raw.get("url")
        if url is not None and not str(url).startswith(("http://", "https://")):
            raise CorpusError(f"chunk {position}: url must be http(s), got {url!r}")

        out.append(dict(raw))
    return out


def load_corpus(path: Path, *, split: Optional[str] = None) -> List[Dict[str, Any]]:
    """Read and validate a JSONL corpus file."""
    if not path.is_file():
        raise CorpusError(f"corpus file not found: {path}")
    records: List[Dict[str, Any]] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        line = line.strip()
        if not line:
            continue
        try:
            parsed = json.loads(line)
        except json.JSONDecodeError as exc:
            raise CorpusError(f"{path}:{line_number}: invalid JSON: {exc}") from exc
        records.append(parsed)
    try:
        return validate_chunks(records, split=split)
    except LicenceError as exc:
        raise CorpusError(f"{path}: {exc}") from exc


def save_corpus(chunks: Sequence[Mapping[str, Any]], path: Path) -> None:
    """Write validated chunks as JSONL (one object per line, stable order)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        json.dumps(dict(chunk), ensure_ascii=False, sort_keys=True) for chunk in chunks
    ]
    path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")


def build_from_html(
    pages: Iterable[Mapping[str, Any]],
    *,
    source: str,
    tags: Sequence[str] = (),
    split: Optional[str] = None,
    property_id: Optional[str] = None,
    max_chars: int = 700,
    attribution: Optional[str] = None,
) -> Tuple[List[Dict[str, Any]], CorpusReport]:
    """Extract, chunk and gate a batch of already-fetched pages.

    Each page mapping needs ``url`` and ``html``; ``title`` is optional
    (read from the document when absent). ``source`` must be a registry id —
    the gate runs before any chunk is produced, so a forbidden source never
    reaches the output list.
    """
    registry = load_registry()
    entry = registry.require(source)
    if split:
        registry.assert_trainable(source, split)

    report = CorpusReport()
    chunks: List[Dict[str, Any]] = []

    for page in pages:
        url = str(page.get("url") or "").strip()
        html = page.get("html")
        if not url or not isinstance(html, str) or not html.strip():
            report.skipped += 1
            report.warnings.append("page missing url or html — skipped")
            continue

        # Local import keeps `bs4` (root requirements) as the only hard dep and
        # avoids a circular import through ml.extract.__init__.
        from ml.extract import extract_markup, extract_text

        markup = extract_markup(html, url)
        body = extract_text(html, url)
        title = str(page.get("title") or markup.get("title") or url)
        doc_id = str(page.get("id") or url)
        page_property_id = (
            str(page.get("propertyId") or page.get("property_id") or property_id or "").strip()
            or None
        )

        produced = chunk_document(
            doc_id=doc_id,
            title=title,
            text=body.get("text", ""),
            source=source,
            url=url,
            tags=list(tags),
            property_id=page_property_id,
            max_chars=max_chars,
        )
        if attribution:
            for chunk in produced:
                chunk["attribution"] = attribution
        chunks.extend(produced)
        report.documents += 1
        report.chunks += len(produced)
        report.sources[source] = report.sources.get(source, 0) + len(produced)

    # Gate the finished list too: catches a caller that injected records.
    validated = validate_chunks(chunks, split=split)
    return validated, report
