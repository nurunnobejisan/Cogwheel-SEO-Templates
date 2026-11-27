"""Retrieval layer — corpus, chunking, embeddings, vector store, classifier.

Layout (see ``ml/README.md``):

- ``ml.retrieve.chunk``     deterministic chunking with per-chunk provenance
- ``ml.retrieve.corpus``    corpus assembly behind the licence gate
- ``ml.retrieve.embed``     hashing embedder + fail-closed HTTP client
- ``ml.retrieve.store``     in-memory cosine index, pgvector export
- ``ml.retrieve.classifier`` page-type classifier (train / predict / macro-F1)

Everything imports with the root ``requirements.txt`` alone (D-014); the HTTP
and pgvector paths are lazy and optional.
"""

from __future__ import annotations

from . import chunk, classifier, corpus, embed, store

__all__ = ["chunk", "classifier", "corpus", "embed", "store"]
