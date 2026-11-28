"""Live heading extraction must be explicit, scoped and status-aware."""

from __future__ import annotations

import ast
import urllib.request
from pathlib import Path

import pytest

from python.generators.heading_optimizer import HeadingOptimizer

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "python" / "generators" / "heading_optimizer.py"

LIVE_HTML = """
<html><body>
  <h1>Live Rooms Overview</h1>
  <h2>Live Amenities Guide</h2>
</body></html>
"""


class FakeResponse:
    def __init__(self, html: str, status: int = 200) -> None:
        self._html = html.encode("utf-8")
        self.status = status

    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, *_args: object) -> bool:
        return False

    def read(self) -> bytes:
        return self._html


def _patch_urlopen(monkeypatch: pytest.MonkeyPatch, response: FakeResponse | Exception) -> dict:
    captured: dict = {}

    def fake_urlopen(request: object, timeout: int | None = None) -> FakeResponse:
        captured["url"] = getattr(request, "full_url", "")
        captured["timeout"] = timeout
        if isinstance(response, Exception):
            raise response
        return response

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
    return captured


def test_urllib_request_is_an_explicit_dependency() -> None:
    """The module must not rely on urllib.request being imported transitively."""
    tree = ast.parse(SOURCE.read_text(encoding="utf-8"))
    imports = {
        alias.name
        for node in ast.walk(tree)
        if isinstance(node, ast.Import)
        for alias in node.names
    }
    assert "urllib.request" in imports


def test_live_headings_are_extracted(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    captured = _patch_urlopen(monkeypatch, FakeResponse(LIVE_HTML))
    optimizer = HeadingOptimizer("https://example.com", output_base_dir=str(tmp_path))

    result = optimizer._fetch_live_page_headings("https://example.com/rooms")

    assert result == [("H1", "Live Rooms Overview"), ("H2", "Live Amenities Guide")]
    assert captured["url"] == "https://example.com/rooms"
    assert captured["timeout"] == 5


def test_non_200_response_falls_back(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _patch_urlopen(monkeypatch, FakeResponse("<h1>Not found</h1><h2>404</h2>", status=404))
    optimizer = HeadingOptimizer("https://example.com", output_base_dir=str(tmp_path))

    assert optimizer._fetch_live_page_headings("https://example.com/missing") is None


def test_network_error_falls_back(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _patch_urlopen(monkeypatch, OSError("offline"))
    optimizer = HeadingOptimizer("https://example.com", output_base_dir=str(tmp_path))

    assert optimizer._fetch_live_page_headings("https://example.com/rooms") is None


def test_optimize_all_uses_live_headings(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _patch_urlopen(monkeypatch, FakeResponse(LIVE_HTML))
    optimizer = HeadingOptimizer("https://example.com", output_base_dir=str(tmp_path))
    optimizer.brand_name = "Example"
    optimizer.location = "Dhaka"

    audits = optimizer.optimize_all(
        [{"url": "https://example.com/rooms", "path": "/rooms", "title": "Rooms"}]
    )

    assert len(audits) == 1
    assert any("Live Amenities Guide" in item.old_headline for item in audits[0].headings)
