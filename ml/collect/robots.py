"""robots.txt parsing and crawl politeness.

Standard library only. The parser implements the subset of the Robots
Exclusion Protocol that actually matters for a dataset build:

- ``User-agent`` groups, with ``*`` as the catch-all;
- ``Disallow`` / ``Allow`` with the **longest-match-wins** rule Google uses;
- ``*`` and ``$`` wildcards in paths;
- ``Crawl-delay``.

There is no fetching here on purpose: callers fetch (behind the SSRF guard)
and hand over bytes, so one politeness policy serves every collector.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Tuple
from urllib.parse import urlparse

__all__ = ["RobotsRules", "parse_robots", "path_matches"]


def _pattern_to_regex(path: str) -> "re.Pattern[str]":
    """Convert a robots path pattern to a regex.

    ``*`` matches any run of characters, ``$`` anchors the end. Everything
    else is escaped, because a path is literal text, not a regex.
    """
    out = []
    for i, ch in enumerate(path):
        if ch == "*":
            out.append(".*")
        elif ch == "$" and i == len(path) - 1:
            out.append("$")
        else:
            out.append(re.escape(ch))
    return re.compile("".join(out))


def path_matches(pattern: str, path: str) -> bool:
    """True when ``path`` is covered by a robots ``Allow``/``Disallow`` rule."""
    if not pattern:
        return False  # an empty Disallow means "allow everything"
    return _pattern_to_regex(pattern).search(path) is not None


@dataclass
class RobotsRules:
    """Parsed rules for one origin."""

    #: agent -> list of (allow?, path), in file order
    rules: Dict[str, List[Tuple[bool, str]]] = field(default_factory=dict)
    crawl_delay: Dict[str, float] = field(default_factory=dict)
    sitemaps: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    def _group_for(self, user_agent: str) -> List[Tuple[bool, str]]:
        """Most specific matching group, falling back to ``*``."""
        ua = user_agent.lower()
        # Prefer the longest agent token that appears in our user-agent string.
        best: Optional[str] = None
        for agent in self.rules:
            if agent == "*":
                continue
            if agent in ua:
                if best is None or len(agent) > len(best):
                    best = agent
        if best is not None:
            return self.rules[best]
        return self.rules.get("*", [])

    def allowed(self, user_agent: str, url_or_path: str) -> bool:
        """Longest-match-wins decision for one URL.

        Google's rule: among all matching rules, the most specific (longest)
        pattern wins; ties go to ``Allow``. An empty rule set allows.
        """
        parsed = urlparse(url_or_path)
        path = parsed.path or "/"
        if parsed.query:
            path = f"{path}?{parsed.query}"

        candidates: List[Tuple[int, bool]] = []
        for is_allow, pattern in self._group_for(user_agent):
            if path_matches(pattern, path):
                candidates.append((len(pattern), is_allow))

        if not candidates:
            return True
        longest = max(length for length, _ in candidates)
        winners = [is_allow for length, is_allow in candidates if length == longest]
        # A tie goes to Allow.
        return any(winners)

    def delay_for(self, user_agent: str) -> float:
        """``Crawl-delay`` for this agent, or 0.0 when unspecified."""
        ua = user_agent.lower()
        for agent, delay in self.crawl_delay.items():
            if agent != "*" and agent in ua:
                return delay
        return self.crawl_delay.get("*", 0.0)


def parse_robots(payload: bytes) -> RobotsRules:
    """Parse robots.txt bytes into :class:`RobotsRules`.

    Never raises: a malformed file yields warnings, because refusing to crawl
    on a typo would silently shrink a dataset — the opposite of the failure
    we want to notice.
    """
    rules = RobotsRules()
    try:
        text = payload.decode("utf-8", errors="replace")
    except Exception as exc:  # pragma: no cover - decode with replace cannot fail
        rules.warnings.append(f"cannot decode robots.txt: {exc}")
        return rules

    current_agents: List[str] = []
    seen_directive = False

    for raw_line in text.splitlines():
        line = raw_line.split("#", 1)[0].strip()
        if not line:
            continue
        if ":" not in line:
            rules.warnings.append(f"unparseable line skipped: {line[:60]!r}")
            continue

        field_name, _, value = line.partition(":")
        field_name = field_name.strip().lower()
        value = value.strip()

        if field_name == "user-agent":
            # A new group starts when directives already followed the last agent.
            if seen_directive:
                current_agents = []
                seen_directive = False
            agent = value.lower() or "*"
            current_agents.append(agent)
            rules.rules.setdefault(agent, [])
            continue

        if not current_agents:
            # Directives before any User-agent apply to everyone.
            current_agents = ["*"]
            rules.rules.setdefault("*", [])

        seen_directive = True

        if field_name in {"disallow", "allow"}:
            is_allow = field_name == "allow"
            for agent in current_agents:
                rules.rules.setdefault(agent, []).append((is_allow, value))
        elif field_name == "crawl-delay":
            try:
                delay = float(value)
            except ValueError:
                rules.warnings.append(f"non-numeric Crawl-delay: {value!r}")
                continue
            for agent in current_agents:
                rules.crawl_delay[agent] = delay
        elif field_name == "sitemap" and value:
            if value not in rules.sitemaps:
                rules.sitemaps.append(value)
        # `Host` and unknown directives are ignored deliberately.

    return rules
