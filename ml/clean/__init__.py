"""Cleaning layer — PII stripping, normalisation, MinHash dedup.

Mirrors the TypeScript side so both halves of the pipeline agree:

- :func:`strip_pii` is the Python twin of ``stripPii`` in
  ``src/core/training/dataset.ts`` — same patterns, same placeholders;
- :func:`content_hash` matches ``contentHash`` there (canonical JSON, SHA-256).

Standard library only, so it runs in CI and before any heavy dependency is
imported. PII is stripped **before storage and again before export**.
"""

from __future__ import annotations

from .dedup import is_duplicate, jaccard, minhash_signature
from .normalise import canonical, content_hash
from .pii import EMAIL_RE, PHONE_RE, SECRET_RE, assert_no_pii, pii_counts, strip_pii

__all__ = [
    "strip_pii",
    "assert_no_pii",
    "pii_counts",
    "content_hash",
    "canonical",
    "minhash_signature",
    "jaccard",
    "is_duplicate",
    "EMAIL_RE",
    "PHONE_RE",
    "SECRET_RE",
]
