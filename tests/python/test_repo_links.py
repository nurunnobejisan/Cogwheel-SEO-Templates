"""Repository link and scaffolding health checks.

CI already runs ``pytest tests/python -q``, so these checks make a stale
documentation link or a missing contributor template fail the build instead of
surfacing for a new contributor. Root-absolute links are treated as Next.js
app routes (``src/app/<route>/page.tsx``) or public assets, not as filesystem
paths.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]

SKIP_DIRS = {
    ".git",
    ".next",
    ".venv",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "output",
    "vendor",
}

LINK_RE = re.compile(r"!?\[[^\]]*\]\(([^)\s]+)")
FENCE_RE = re.compile(r"^\s*(```|~~~)")
HTML_COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)
EXTERNAL_PREFIXES = ("http://", "https://", "mailto:", "tel:", "data:", "//", "#")


def _markdown_files() -> list[Path]:
    return sorted(
        path
        for path in ROOT.rglob("*.md")
        if not any(part in SKIP_DIRS for part in path.relative_to(ROOT).parts)
    )


def _visible_text(path: Path) -> str:
    text = HTML_COMMENT_RE.sub("", path.read_text(encoding="utf-8", errors="ignore"))
    lines: list[str] = []
    in_fence = False
    for line in text.splitlines():
        if FENCE_RE.match(line):
            in_fence = not in_fence
            continue
        if not in_fence:
            lines.append(line)
    return "\n".join(lines)


def _links(path: Path) -> list[tuple[str, str]]:
    """Return (raw label, target) for every inline link outside code fences."""
    result: list[tuple[str, str]] = []
    for line in _visible_text(path).splitlines():
        for match in LINK_RE.finditer(line):
            target = match.group(1).strip().strip("<>")
            if target.startswith(EXTERNAL_PREFIXES) or "{" in target:
                continue
            result.append((line, target.split("#", 1)[0].split("?", 1)[0]))
    return result


def _app_route_exists(relative: str) -> bool:
    route = relative.strip("/")
    if not route:
        return True
    app_root = ROOT / "src" / "app" / route
    candidates = [
        app_root / "page.tsx",
        app_root / "route.ts",
        app_root / "page.mdx",
        ROOT / "src" / "app" / f"{route}.tsx",
        ROOT / "public" / route,
    ]
    return any(candidate.exists() for candidate in candidates)


def test_markdown_scan_covers_repository() -> None:
    files = _markdown_files()
    assert len(files) >= 20, f"expected a broad docs set, scanned only {len(files)} files"


def test_relative_markdown_links_resolve() -> None:
    broken: list[str] = []
    for path in _markdown_files():
        for _line, target in _links(path):
            if target.startswith("/") or not target:
                continue
            if not (path.parent / target).exists():
                broken.append(f"{path.relative_to(ROOT)} -> {target}")
    assert not broken, "broken relative Markdown links:\n" + "\n".join(sorted(set(broken)))


def test_root_absolute_links_are_app_routes_or_public_assets() -> None:
    broken: list[str] = []
    for path in _markdown_files():
        for _line, target in _links(path):
            if not target.startswith("/"):
                continue
            if not _app_route_exists(target):
                broken.append(f"{path.relative_to(ROOT)} -> {target}")
    assert not broken, "root-absolute links without a route or asset:\n" + "\n".join(sorted(set(broken)))


@pytest.mark.parametrize(
    "relative_path",
    [
        "CONTRIBUTING.md",
        "CODE_OF_CONDUCT.md",
        "README.md",
        ".github/pull_request_template.md",
        ".github/ISSUE_TEMPLATE/bug_report.md",
        ".github/ISSUE_TEMPLATE/feature_request.md",
        ".github/workflows/ci.yml",
        ".github/workflows/auto-release.yml",
    ],
)
def test_contributor_scaffolding_exists(relative_path: str) -> None:
    assert (ROOT / relative_path).is_file(), f"missing {relative_path}"


def test_daily_session_route_is_documented_and_present() -> None:
    """Guard the one root-absolute doc link against accidental route deletion."""
    assert (ROOT / "src" / "app" / "daily-session" / "page.tsx").is_file()
    assert "/daily-session" in (ROOT / "docs" / "DAILY_SESSION.md").read_text(encoding="utf-8")
