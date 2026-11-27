"""Canonicalisation and content hashing.

Mirrors ``canonical()`` / ``contentHash()`` in
``src/core/training/dataset.ts`` so a record hashed in TypeScript and the same
record hashed in Python produce the same digest. If these two drift, duplicate
detection silently stops working across the boundary.

Standard library only.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

__all__ = ["canonical", "content_hash"]




def canonical(value: Any) -> str:
    """Canonical JSON: sorted keys, compact separators, arrays order-sensitive.

    Must stay in step with ``canonical()`` in ``src/core/training/dataset.ts``
    so a triple hashed in TypeScript and the same triple hashed in Python
    produce the same digest.
    """
    if isinstance(value, list):
        return "[" + ",".join(canonical(item) for item in value) + "]"
    if isinstance(value, tuple):
        return "[" + ",".join(canonical(item) for item in value) + "]"
    if isinstance(value, dict):
        body = ",".join(
            f"{json.dumps(str(key))}:{canonical(value[key])}" for key in sorted(value)
        )
        return "{" + body + "}"
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return json.dumps(value)
    if isinstance(value, str):
        return json.dumps(value)
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def content_hash(audit: Any, expert_fix: Any) -> str:
    """SHA-256 of ``canonical({"audit": ..., "expertFix": ...})``.

    The duplicate key. Two records with the same hash are duplicates.
    """
    payload = canonical({"audit": audit, "expertFix": expert_fix})
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


