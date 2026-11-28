"""Deterministic document chunking with per-chunk provenance.

Every chunk carries ``source`` and ``url`` so a citation in a generated
explanation can be traced back to the document it came from — the
``explainer_citation`` check in ``ml/eval/run_eval.py`` depends on this.

Standard library only. Chunking is a pure function: the same document always
yields the same chunks, ids and offsets.
"""

from __future__ import annotations

import hashlib
import re
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence

__all__ = ["split_sentences", "chunk_text", "chunk_document", "DEFAULT_MAX_CHARS"]

DEFAULT_MAX_CHARS = 700
DEFAULT_OVERLAP = 150

_SENTENCE_END = re.compile(r"(?<=[.!?])\s+")
_WHITESPACE = re.compile(r"\s+")


def split_sentences(text: str) -> List[str]:
    """Split ``text`` into sentences, keeping punctuation with the sentence.

    Deliberately simple and dependency-free: a heading or list item without
    terminal punctuation becomes its own sentence rather than being merged
    into the next line, which is what a chunker wants.
    """
    normalized = _WHITESPACE.sub(" ", text).strip()
    if not normalized:
        return []
    sentences: List[str] = []
    current = ""
    for piece in _SENTENCE_END.split(normalized):
        piece = piece.strip()
        if not piece:
            continue
        if current:
            sentences.append(current)
        current = piece
    if current:
        sentences.append(current)
    return sentences


def chunk_text(
    text: str, *, max_chars: int = DEFAULT_MAX_CHARS, overlap: int = DEFAULT_OVERLAP
) -> List[str]:
    """Pack ``text`` into chunks of at most ``max_chars``, sentence-aligned.

    ``overlap`` characters of the previous chunk are repeated at the start of
    the next so a fact straddling a boundary is still retrievable. Overlap is
    clamped below ``max_chars`` so progress is always made (an unclamped value
    could loop forever on pathological input).
    """
    if max_chars <= 0:
        raise ValueError("max_chars must be positive")
    overlap = max(0, min(overlap, max_chars - 1))

    sentences = split_sentences(text)
    if not sentences:
        return []

    chunks: List[str] = []
    current = ""
    for sentence in sentences:
        # A single sentence longer than the budget is hard-split so it cannot
        # stall the packer.
        pieces = (
            [sentence[i : i + max_chars] for i in range(0, len(sentence), max_chars)]
            if len(sentence) > max_chars
            else [sentence]
        )
        for piece in pieces:
            candidate = f"{current} {piece}".strip() if current else piece
            if len(candidate) <= max_chars:
                current = candidate
                continue
            if current:
                chunks.append(current)
            # Repeat up to `overlap` chars of the tail, clamped so the new
            # chunk still fits the budget (an unclamped tail would either
            # exceed max_chars or, with overlap >= max_chars, never progress).
            room = max_chars - 1 - len(piece)
            tail = current[-min(overlap, room) :] if overlap and room > 0 else ""
            current = f"{tail} {piece}".strip() if tail else piece
    if current:
        chunks.append(current)
    return [c for c in chunks if c.strip()]


def chunk_document(
    *,
    doc_id: str,
    title: str,
    text: str,
    source: str,
    url: Optional[str] = None,
    tags: Sequence[str] = (),
    property_id: Optional[str] = None,
    max_chars: int = DEFAULT_MAX_CHARS,
    overlap: int = DEFAULT_OVERLAP,
) -> List[Dict[str, Any]]:
    """Split a document into ingest-ready chunk records.

    Ids are ``<doc_id>#<part>`` (matching the TypeScript chunker in
    ``ai/rag/knowledge-base.ts``) and ``charStart``/``charEnd`` record where
    the chunk came from, so a citation can be verified against the original.
    Optional ``property_id`` scopes client-owned chunks for isolated retrieval.
    """
    pieces = chunk_text(text, max_chars=max_chars, overlap=overlap)
    if not pieces:
        pieces = [text.strip()] if text.strip() else []

    normalized_property_id = (property_id or "").strip() or None
    chunks: List[Dict[str, Any]] = []
    cursor = 0
    for part, piece in enumerate(pieces, start=1):
        # Overlapping chunks re-use text from before `cursor`, so search a
        # window that reaches back far enough to find the true offset.
        start = text.find(piece, max(0, cursor - len(piece)))
        if start < 0:
            start = cursor
        end = start + len(piece)
        cursor = end
        record: Dict[str, Any] = {
            "id": f"{doc_id}#{part}",
            "title": title,
            "text": piece,
            "source": source,
            "url": url,
            "tags": list(tags),
            "chunkIndex": part,
            "charStart": start,
            "charEnd": end,
        }
        if normalized_property_id:
            record["propertyId"] = normalized_property_id
        chunks.append(record)
    return chunks


def chunk_id(doc_id: str, text: str) -> str:
    """Stable content id for a chunk, used for de-duplication across builds."""
    digest = hashlib.sha256(f"{doc_id}\n{text}".encode("utf-8")).hexdigest()
    return digest[:16]
