"""Extraction layer — structured markup and main-content text.

Two backends per capability, chosen at call time:

- **preferred** (``extruct`` for markup, ``trafilatura`` for text) when the
  optional dependency is importable — it is in ``ml/requirements-ml.txt``;
- **fallback** (``bs4``, which is in the root ``requirements.txt``) otherwise.

The CI Python job installs only the root requirements, so every test exercises
the fallback, and the preferred path is exercised only in a full ML
environment. That is deliberate: a pipeline that only works with its heavy
deps installed cannot be verified in CI.
"""

from __future__ import annotations

from typing import Any, Dict, List, Mapping, Optional

from .markup import extract_markup, has_extruct
from .text import extract_text, has_trafilatura

__all__ = [
    "extract_markup",
    "extract_text",
    "has_extruct",
    "has_trafilatura",
    "extract_all",
]


def extract_all(html: str, url: str) -> Dict[str, Any]:
    """Extract markup + text in one call, recording which backend ran.

    The returned ``backend`` field is part of the record so a dataset row can
    say how it was produced — important when comparing runs across
    environments where the optional dependencies differ.
    """
    markup = extract_markup(html, url)
    text = extract_text(html, url)
    return {
        "url": url,
        "markup": markup,
        "text": text,
        "backend": {
            "markup": "extruct" if has_extruct() else "bs4",
            "text": "trafilatura" if has_trafilatura() else "bs4",
        },
    }
