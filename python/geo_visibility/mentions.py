"""Mention detection across scripts (Bangla, English, Banglish)."""

from __future__ import annotations

from dataclasses import dataclass, field
from .normalize import normalize_text, normalize_alias
from .providers import Answer


@dataclass
class MentionResult:
    mentioned: bool
    first_offset: int  # -1 if not mentioned
    cited: bool
    competing_domains: list[str] = field(default_factory=list)


def _contains(haystack: str, needle: str) -> int:
    """Return offset of first occurrence of needle in haystack, or -1."""
    if not needle:
        return -1
    h = haystack.lower()
    n = needle.lower()
    # try normalized (script-aware) match first
    idx = h.find(n)
    if idx >= 0:
        return idx
    # try normalized forms
    nh = normalize_text(haystack).lower()
    nn = normalize_text(needle).lower()
    idx = nh.find(nn)
    if idx >= 0:
        return idx
    return -1


def detect_mentions(answer: Answer, brand: str, domain: str,
                    aliases: dict[str, list[str]] | None = None) -> MentionResult:
    aliases = aliases or {}
    # Build candidate needles (brand + all aliases across scripts).
    needles: list[str] = [brand]
    for script_aliases in aliases.values():
        needles.extend(script_aliases)
    # Also normalized brand.
    needles.append(normalize_text(brand))

    best_offset = -1
    for needle in needles:
        off = _contains(answer.text, needle)
        if off >= 0 and (best_offset == -1 or off < best_offset):
            best_offset = off

    mentioned = best_offset >= 0

    # citation check: official domain present in citations
    cited = any(domain.lower() in (c or "").lower() for c in answer.citations)

    # competing domains: cited domains that are not the official one
    competitors = []
    for c in answer.citations:
        if not c:
            continue
        dom = c.lower()
        if domain.lower() not in dom:
            competitors.append(c)

    return MentionResult(
        mentioned=mentioned,
        first_offset=best_offset,
        cited=cited,
        competing_domains=competitors,
    )
