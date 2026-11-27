"""PII stripping — the Python twin of ``stripPii`` in ``src/core/training/dataset.ts``.

Same patterns, same placeholders, so a record redacted in TypeScript and the
same record redacted in Python are byte-identical. PII is stripped before
storage and again before export.

Standard library only.
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict

__all__ = ["strip_pii", "assert_no_pii", "pii_counts", "EMAIL_RE", "PHONE_RE", "SECRET_RE"]

# --- patterns, kept byte-identical in intent to src/core/training/dataset.ts --

EMAIL_RE = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.IGNORECASE)

# Same shape as PHONE in src/core/training/dataset.ts: optional country code,
# an area code in digits or parens, then two more groups. The digit branch
# carries its own `\b` because a leading `\b` cannot match before `(` — that
# was a real leak (`(503) 555 0123` went unredacted on both sides). Changing
# one side without the other breaks the parity guarantee.
PHONE_RE = re.compile(
    r"(?:\+?\d{1,3}[-.\s]?)?(?:\(\d{2,4}\)|\b\d{2,4})[-.\s]\d{3,4}[-.\s]\d{3,4}\b"
)

# Token-shaped secrets: sk-, pk-, ghp-, gho-, xoxb/a/p/r/s-.
SECRET_RE = re.compile(r"\b(?:sk|pk|ghp|gho|xox[baprs])[-_][A-Za-z0-9_-]{12,}\b")

# Google API keys and PEM blocks, from prepare_unified_training_data.py.
GOOGLE_KEY_RE = re.compile(r"AIzaSy[A-Za-z0-9_-]{33}")
PEM_RE = re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----")

PLACEHOLDERS = {
    "email": "[REDACTED_EMAIL]",
    "phone": "[REDACTED_PHONE]",
    "secret": "[REDACTED_SECRET]",
    "google_key": "[REDACTED_KEY]",
    "private_key": "[REDACTED_PRIVATE_KEY]",
}


def strip_pii(value: Any) -> Any:
    """Recursively redact emails, phone numbers and credentials.

    Structured input (dict / list / scalar) in, same shape out. Nothing is
    dropped — only replaced in place — so the record stays structurally valid.
    """
    if isinstance(value, str):
        out = EMAIL_RE.sub(PLACEHOLDERS["email"], value)
        out = PHONE_RE.sub(PLACEHOLDERS["phone"], out)
        out = SECRET_RE.sub(PLACEHOLDERS["secret"], out)
        out = GOOGLE_KEY_RE.sub(PLACEHOLDERS["google_key"], out)
        out = PEM_RE.sub(PLACEHOLDERS["private_key"], out)
        return out
    if isinstance(value, list):
        return [strip_pii(item) for item in value]
    if isinstance(value, tuple):
        return tuple(strip_pii(item) for item in value)
    if isinstance(value, dict):
        return {key: strip_pii(item) for key, item in value.items()}
    return value


def pii_counts(value: Any) -> Dict[str, int]:
    """Count PII hits by kind in any nested structure.

    Used by tests and by the export gate: a non-zero count means the data has
    not been stripped yet.
    """
    counts = {"email": 0, "phone": 0, "secret": 0, "google_key": 0, "private_key": 0}

    def walk(item: Any) -> None:
        if isinstance(item, str):
            counts["email"] += len(EMAIL_RE.findall(item))
            counts["phone"] += len(PHONE_RE.findall(item))
            counts["secret"] += len(SECRET_RE.findall(item))
            counts["google_key"] += len(GOOGLE_KEY_RE.findall(item))
            counts["private_key"] += len(PEM_RE.findall(item))
        elif isinstance(item, dict):
            for sub in item.values():
                walk(sub)
        elif isinstance(item, (list, tuple)):
            for sub in item:
                walk(sub)

    walk(value)
    return counts


def assert_no_pii(value: Any) -> None:
    """Raise ``ValueError`` when any PII pattern still matches."""
    counts = pii_counts(value)
    hits = {kind: n for kind, n in counts.items() if n}
    if hits:
        detail = ", ".join(f"{kind}={n}" for kind, n in sorted(hits.items()))
        raise ValueError(f"PII still present after stripping: {detail}")


