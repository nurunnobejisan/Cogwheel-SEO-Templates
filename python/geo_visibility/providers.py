"""Provider protocol and adapters for AI visibility queries."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol


@dataclass
class Answer:
    text: str
    citations: list[str] = field(default_factory=list)  # domains/urls cited
    raw: dict = field(default_factory=dict)


class Provider(Protocol):
    name: str

    def query(self, prompt: str) -> Answer:
        ...


class RecordedProvider:
    """Provider that returns canned answers from a fixture dict.

    Fixture shape: { "<intent_id>|<lang>|<run>": { "text": ..., "citations": [...] } }
    Falls back to a default answer when a key is missing.
    """

    def __init__(self, name: str, fixture: dict, default_text: str = ""):
        self.name = name
        self.fixture = fixture
        self.default_text = default_text

    def query(self, prompt: str) -> Answer:
        # The runner passes an extra key via a side channel? We key by prompt hash fallback.
        key = prompt
        entry = self.fixture.get(key)
        if entry is None:
            return Answer(text=self.default_text, citations=[], raw={"prompt": prompt})
        return Answer(text=entry.get("text", ""), citations=entry.get("citations", []),
                     raw={"prompt": prompt})


class OpenAIProvider:
    """OpenAI adapter using the web search tool. Requires OPENAI_API_KEY."""

    def __init__(self, model: str = "gpt-4o-mini"):
        self.name = "openai"
        self.model = model

    def query(self, prompt: str) -> Answer:
        import os

        api_key = os.environ.get("OPENAI_API_KEY", "")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY not set")
        try:
            from openai import OpenAI  # type: ignore
        except Exception as exc:
            raise RuntimeError(f"openai sdk missing: {exc}")
        client = OpenAI(api_key=api_key)
        resp = client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            tools=[{"type": "web_search"}] if False else None,
        )
        text = resp.choices[0].message.content or ""
        citations: list[str] = []
        # Best-effort citation extraction from tool calls is model-specific;
        # left empty here and filled by callers when available.
        return Answer(text=text, citations=citations, raw={"model": self.model})


class PerplexityProvider:
    """Perplexity Sonar adapter (OpenAI-compatible). Requires PERPLEXITY_API_KEY."""

    def __init__(self, model: str = "sonar"):
        self.name = "perplexity"
        self.model = model

    def query(self, prompt: str) -> Answer:
        import os

        api_key = os.environ.get("PERPLEXITY_API_KEY", "")
        if not api_key:
            raise RuntimeError("PERPLEXITY_API_KEY not set")
        try:
            from openai import OpenAI  # type: ignore
        except Exception as exc:
            raise RuntimeError(f"openai sdk missing: {exc}")
        client = OpenAI(api_key=api_key, base_url="https://api.perplexity.ai")
        resp = client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
        )
        text = resp.choices[0].message.content or ""
        citations = getattr(resp, "citations", []) or []
        return Answer(text=text, citations=list(citations), raw={"model": self.model})


class GeminiProvider:
    """Gemini with Search grounding. Requires GEMINI_API_KEY."""

    def __init__(self, model: str = "gemini-2.0-flash"):
        self.name = "gemini"
        self.model = model

    def query(self, prompt: str) -> Answer:
        import os

        api_key = os.environ.get("GEMINI_API_KEY", "")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY not set")
        # Minimal: use REST to keep deps light.
        import json as _json
        import urllib.request as _u

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={api_key}"
        body = _json.dumps({
            "contents": [{"parts": [{"text": prompt}]}],
            "tools": [{"google_search": {}}],
        }).encode()
        req = _u.Request(url, data=body, method="POST")
        req.add_header("Content-Type", "application/json")
        with _u.urlopen(req, timeout=60) as resp:
            data = _json.loads(resp.read())
        text = ""
        citations: list[str] = []
        try:
            cand = data["candidates"][0]
            text = cand["content"]["parts"][0]["text"]
            for gm in cand.get("groundingMetadata", {}).get("groundingChunks", []):
                if "web" in gm and gm["web"].get("uri"):
                    citations.append(gm["web"]["uri"])
        except Exception:
            pass
        return Answer(text=text, citations=citations, raw=data)
