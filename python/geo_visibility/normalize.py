"""Thin normalization interface for geo_visibility.

Uses banglish-normalizer when available; falls back to basic lowercasing.
"""

from __future__ import annotations

try:
    import banglish_normalizer  # type: ignore
    _HAS_BN = True
except Exception:  # pragma: no cover
    _HAS_BN = False


def normalize_text(text: str) -> str:
    if not text:
        return ""
    if _HAS_BN:
        try:
            return banglish_normalizer.normalize(
                banglish_normalizer.transliterate(text), digits_to="bn"
            )
        except Exception:
            pass
    return " ".join(text.lower().split())


def normalize_alias(alias: str) -> str:
    return normalize_text(alias).lower()
