"""Bangla AI Visibility — measurement of brand presence in AI answers."""

from .normalize import normalize_text, normalize_alias
from .providers import Provider, Answer
from .mentions import detect_mentions, MentionResult
from .runner import run_visibility, RunResult

__all__ = [
    "normalize_text", "normalize_alias", "Provider", "Answer",
    "detect_mentions", "MentionResult", "run_visibility", "RunResult",
]
__version__ = "0.1.0"
