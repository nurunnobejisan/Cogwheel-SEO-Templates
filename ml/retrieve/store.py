"""Vector store: in-memory cosine index with pgvector export.

Scoring mirrors the TypeScript knowledge base (``ai/rag/knowledge-base.ts``):
hybrid ``0.7 * cosine + 0.3 * keyword-overlap``, so a query answered by the
Python pipeline and the same query answered by the app rank chunks the same
way.

pgvector is optional and lazy (D-014): the CI job never installs ``psycopg``,
so :func:`write_pgvector` raises an actionable error instead of failing at
import time. Nothing here talks to the network.
"""

from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple

__all__ = ["VectorStore", "ScoredChunk", "cosine", "PGVECTOR_DDL", "export_rows", "write_pgvector"]

KEYWORD_WEIGHT = 0.3
EMBEDDING_WEIGHT = 0.7
_TOKEN_SPLIT = re.compile(r"[a-z0-9]+")


def cosine(a: Sequence[float], b: Sequence[float]) -> float:
    """Cosine similarity over the shared prefix; 0 when either side is null."""
    dot = 0.0
    norm_a = 0.0
    norm_b = 0.0
    for left, right in zip(a, b):
        dot += left * right
        norm_a += left * left
        norm_b += right * right
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (math.sqrt(norm_a) * math.sqrt(norm_b))


@dataclass
class ScoredChunk:
    chunk: Dict[str, Any]
    score: float

    def as_dict(self) -> Dict[str, Any]:
        return {**self.chunk, "score": self.score}


@dataclass
class VectorStore:
    """In-memory index keyed by chunk id."""

    embedder_id: str = ""
    dimensions: int = 0
    _vectors: Dict[str, Tuple[Dict[str, Any], List[float]]] = field(default_factory=dict)

    def __len__(self) -> int:
        return len(self._vectors)

    @property
    def size(self) -> int:
        return len(self._vectors)

    def upsert(
        self, chunks: Sequence[Mapping[str, Any]], vectors: Sequence[Sequence[float]]
    ) -> None:
        if len(chunks) != len(vectors):
            raise ValueError(f"{len(chunks)} chunks but {len(vectors)} vectors")
        for chunk, vector in zip(chunks, vectors):
            chunk_id = str(chunk["id"])
            values = [float(value) for value in vector]
            if not self.dimensions:
                self.dimensions = len(values)
            elif len(values) != self.dimensions:
                raise ValueError(
                    f"vector width {len(values)} does not match store width {self.dimensions}"
                )
            self._vectors[chunk_id] = (dict(chunk), values)

    def remove(self, chunk_id: str) -> None:
        self._vectors.pop(chunk_id, None)

    def all(self) -> List[Dict[str, Any]]:
        return [chunk for chunk, _ in self._vectors.values()]

    def search(
        self,
        query_vector: Sequence[float],
        *,
        query: str = "",
        top_k: int = 4,
        tags: Optional[Sequence[str]] = None,
        min_score: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """Hybrid rank: embeddings + keyword overlap, best first.

        ``min_score`` defaults to no threshold — a hybrid score can be
        negative (cosine of unrelated vectors), so a 0-default would silently
        drop weakly-related chunks that ``top_k`` was asked for. Pass an
        explicit value to filter.
        """
        tokens = _TOKEN_SPLIT.findall(query.lower()) if query else []
        scored: List[ScoredChunk] = []
        for chunk, vector in self._vectors.values():
            if tags and not any(tag in chunk.get("tags", []) for tag in tags):
                continue
            cos = cosine(query_vector, vector)
            haystack = f"{chunk.get('title', '')} {chunk.get('text', '')}".lower()
            keyword = (
                sum(1 for token in tokens if token in haystack) / len(tokens) if tokens else 0.0
            )
            score = round(EMBEDDING_WEIGHT * cos + KEYWORD_WEIGHT * keyword, 6)
            if min_score is not None and score < min_score:
                continue
            scored.append(ScoredChunk(chunk=chunk, score=score))
        scored.sort(key=lambda item: item.score, reverse=True)
        return [item.as_dict() for item in scored[:top_k]]

    def search_text(
        self,
        query: str,
        embedder: Any,
        *,
        top_k: int = 4,
        tags: Optional[Sequence[str]] = None,
        min_score: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """Embed ``query`` with ``embedder`` then rank."""
        vector = embedder.embed(query)
        return self.search(
            vector, query=query, top_k=top_k, tags=tags, min_score=min_score
        )

    # ------------------------------------------------------------ persist ----

    def to_dict(self) -> Dict[str, Any]:
        return {
            "version": 1,
            "embedderId": self.embedder_id,
            "dimensions": self.dimensions,
            "chunks": [
                {"chunk": chunk, "vector": vector}
                for chunk, vector in self._vectors.values()
            ],
        }

    @classmethod
    def from_dict(cls, payload: Mapping[str, Any]) -> "VectorStore":
        store = cls(
            embedder_id=str(payload.get("embedderId", "")),
            dimensions=int(payload.get("dimensions", 0)),
        )
        for entry in payload.get("chunks", []):
            store.upsert([entry["chunk"]], [entry["vector"]])
        return store

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.to_dict(), sort_keys=True), encoding="utf-8")

    @classmethod
    def load(cls, path: Path) -> "VectorStore":
        return cls.from_dict(json.loads(path.read_text(encoding="utf-8")))


# ------------------------------------------------------------- pgvector ------

#: Table DDL for a pgvector-backed corpus. ``%(dims)s`` is filled with the
#: store's dimension at export time.
PGVECTOR_DDL = """
CREATE TABLE IF NOT EXISTS ml_chunks (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  text        TEXT NOT NULL,
  source      TEXT NOT NULL,
  url         TEXT,
  tags        TEXT[] NOT NULL DEFAULT '{}',
  embedding   vector(%(dims)s)
);
CREATE INDEX IF NOT EXISTS ml_chunks_embedding_idx
  ON ml_chunks USING hnsw (embedding vector_cosine_ops);
"""


def export_rows(store: VectorStore) -> List[Dict[str, Any]]:
    """Rows shaped for ``psycopg``'s ``executemany`` / ``COPY``."""
    rows: List[Dict[str, Any]] = []
    for chunk, vector in store._vectors.values():  # noqa: SLF001 - same package
        rows.append(
            {
                "id": str(chunk["id"]),
                "title": str(chunk.get("title", "")),
                "text": str(chunk.get("text", "")),
                "source": str(chunk.get("source", "")),
                "url": chunk.get("url"),
                "tags": list(chunk.get("tags", [])),
                "embedding": vector,
            }
        )
    return rows


def write_pgvector(store: VectorStore, dsn: str) -> int:
    """Copy the store into a pgvector table. Requires ``psycopg[binary]``.

    Not exercised in CI (D-014): the import is lazy and the error names the
    extra to install rather than failing at module import.
    """
    try:
        import psycopg  # type: ignore[import-not-found]
    except ImportError as exc:  # pragma: no cover - exercised only offline
        raise RuntimeError(
            "pgvector export needs psycopg — install ml/requirements-ml.txt"
        ) from exc

    rows = export_rows(store)
    with psycopg.connect(dsn) as connection:
        with connection.cursor() as cursor:
            cursor.execute(PGVECTOR_DDL % {"dims": store.dimensions or 1536})
            cursor.execute("DELETE FROM ml_chunks")
            for row in rows:
                cursor.execute(
                    """
                    INSERT INTO ml_chunks (id, title, text, source, url, tags, embedding)
                    VALUES (%(id)s, %(title)s, %(text)s, %(source)s,
                            %(url)s, %(tags)s, %(embedding)s)
                    """,
                    row,
                )
    return len(rows)
