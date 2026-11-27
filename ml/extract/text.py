"""Main-content text extraction.

``trafilatura`` (in ``ml/requirements-ml.txt``) is preferred: it strips
boilerplate far better than a heuristic. CI installs only the root
``requirements.txt``, so a ``bs4`` fallback does the same job well enough for
tests and for environments where the heavy dependency is unavailable.

The extracted text is what the schema writer and classifier see, so it must be
deterministic for a given input — the same HTML always yields the same text.
"""

from __future__ import annotations

import re
from typing import Any, Dict, Optional

from bs4 import BeautifulSoup

__all__ = ["extract_text", "has_trafilatura", "sentence_truncate"]

#: Elements whose text is never content: scripts, styles, and the chrome that
#: repeats on every page.
BOILERPLATE_TAGS = (
    "script",
    "style",
    "noscript",
    "template",
    "svg",
    "iframe",
    "form",
    "nav",
    "header",
    "footer",
    "aside",
)

#: Beyond this length, text is truncated at a sentence boundary so a token
#: budget is respected without cutting mid-word (see schemas/ml-example.ts).
DEFAULT_MAX_CHARS = 6000

_SENTENCE_END = re.compile(r"(?<=[.!?])\s+")
_WHITESPACE = re.compile(r"\s+")


def has_trafilatura() -> bool:
    """True when the preferred ``trafilatura`` backend is importable."""
    try:
        import trafilatura  # noqa: F401
    except Exception:
        return False
    return True


def sentence_truncate(text: str, max_chars: int = DEFAULT_MAX_CHARS) -> str:
    """Cut ``text`` to ``max_chars`` at a sentence boundary.

    Falls back to a word boundary, then to a hard cut, so an over-long single
    sentence still terminates. Never adds or rewords anything.
    """
    if max_chars <= 0 or len(text) <= max_chars:
        return text

    head = text[:max_chars]
    # Prefer the last sentence end inside the window.
    last_end = max(head.rfind(mark) for mark in (". ", "! ", "? ", ".\n", "!\n", "?\n"))
    if last_end > max_chars // 2:
        return head[: last_end + 1].strip()

    last_space = head.rfind(" ")
    if last_space > max_chars // 2:
        return head[:last_space].strip()

    return head.strip()


def _extract_with_trafilatura(html: str, url: str) -> Optional[str]:
    """Preferred path. Returns ``None`` when trafilatura finds no content,
    so the caller can fall back rather than emit an empty string."""
    import trafilatura

    extracted = trafilatura.extract(
        html,
        url=url or None,
        include_comments=False,
        include_tables=True,
        favor_precision=True,
        output_format="txt",
    )
    if not extracted:
        return None
    return extracted.strip() or None


def _extract_with_bs4(html: str) -> str:
    """Fallback path: drop boilerplate blocks, keep the remaining text."""
    soup = BeautifulSoup(html, "html.parser")

    for tag_name in BOILERPLATE_TAGS:
        for tag in soup.find_all(tag_name):
            tag.decompose()

    # Visible text only — hidden elements carry no content for a reader.
    for tag in soup.find_all(style=True):
        style = str(tag.get("style", "")).lower()
        if "display:none" in style.replace(" ", "") or "visibility:hidden" in style.replace(
            " ", ""
        ):
            tag.decompose()

    text = soup.get_text(separator=" ", strip=True)
    return _WHITESPACE.sub(" ", text).strip()


def extract_text(
    html: str, url: str = "", *, max_chars: int = DEFAULT_MAX_CHARS
) -> Dict[str, Any]:
    """Extract main-content text from an HTML document.

    Returns::

        {
          "text": str,          # truncated at `max_chars` on a sentence edge
          "fullLength": int,    # length before truncation
          "truncated": bool,
          "wordCount": int,     # measured, not estimated
          "backend": "trafilatura" | "bs4" | "none",
        }

    ``wordCount`` is a count of the extracted words — a measured fact about
    this document. It is never a traffic, ranking or volume figure.
    """
    if not html:
        return {
            "text": "",
            "fullLength": 0,
            "truncated": False,
            "wordCount": 0,
            "backend": "none",
        }

    backend = "bs4"
    text: Optional[str] = None

    if has_trafilatura():
        try:
            text = _extract_with_trafilatura(html, url)
            if text:
                backend = "trafilatura"
        except Exception:
            text = None

    if not text:
        text = _extract_with_bs4(html)
        backend = "bs4"

    full_length = len(text)
    truncated_text = sentence_truncate(text, max_chars)
    words = [w for w in _WHITESPACE.split(truncated_text) if w]

    return {
        "text": truncated_text,
        "fullLength": full_length,
        "truncated": len(truncated_text) < full_length,
        "wordCount": len(words),
        "backend": backend,
    }
