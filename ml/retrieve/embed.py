"""Embeddings: deterministic hashing embedder + fail-closed HTTP client.

Two implementations behind one shape:

- :class:`HashingEmbedder` — offline, deterministic across processes (blake2b
  with per-token personalisation; Python randomises ``hash()``, so using it
  would silently break reproducibility). This is what CI and local runs use.
- :class:`HttpEmbedder` — OpenAI-compatible ``POST {input: [...]}`` client for
  ``EMBEDDINGS_ENDPOINT``. Fail-closed: a non-2xx, malformed body, count
  mismatch or width drift raises :class:`EmbeddingError` instead of falling
  back to hashing. Mixing hashing query vectors with HTTP chunk vectors would
  corrupt retrieval without any visible error (D-018).

The endpoint passes a syntactic SSRF check at construction and a DNS-aware
check (resolve, then reject private/reserved addresses) at request time;
``urllib`` redirects are disabled so a ``Location`` header cannot escape the
guard.
"""

from __future__ import annotations

import hashlib
import ipaddress
import json
import math
import os
import re
import socket
from typing import Any, Callable, Dict, List, Mapping, Optional, Sequence
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

__all__ = [
    "EmbeddingError",
    "HashingEmbedder",
    "HttpEmbedder",
    "is_safe_endpoint",
    "embedder_from_env",
]

_DIMENSIONS = 256
_CACHE_LIMIT = 4096
_TOKEN_SPLIT = re.compile(r"[a-z0-9]+")


class EmbeddingError(Exception):
    """The embeddings endpoint rejected a request or returned garbage."""


# --------------------------------------------------------------- SSRF guard --

_PRIVATE_SUFFIXES = (".localhost", ".local", ".internal", ".lan")


def _is_private_host(host: str) -> bool:
    host = host.lower().strip("[]")
    if host == "localhost" or host.endswith(_PRIVATE_SUFFIXES):
        return True
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        return False  # a hostname — resolved and re-checked at request time
    return bool(
        address.is_private
        or address.is_loopback
        or address.is_link_local
        or address.is_reserved
        or address.is_unspecified
    )


def is_safe_endpoint(raw: str) -> bool:
    """Syntactic SSRF check: http(s) only, no credentials, no private hosts."""
    try:
        parsed = urlparse(raw)
    except ValueError:
        return False
    if parsed.scheme not in ("http", "https"):
        return False
    if not parsed.hostname:
        return False
    if parsed.username or parsed.password:
        return False
    return not _is_private_host(parsed.hostname)


def _assert_resolves_public(host: str, port: int) -> None:
    """DNS-aware check: every resolved address must be globally routable."""
    if _is_private_host(host):
        raise EmbeddingError(f"embeddings endpoint host is private: {host}")
    try:
        infos = socket.getaddrinfo(host, port or None, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise EmbeddingError(f"could not resolve embeddings endpoint host: {host}") from exc
    addresses = {info[4][0] for info in infos}
    if not addresses:
        raise EmbeddingError(f"could not resolve embeddings endpoint host: {host}")
    for raw in addresses:
        try:
            address = ipaddress.ip_address(raw)
        except ValueError:
            continue
        if (
            address.is_private
            or address.is_loopback
            or address.is_link_local
            or address.is_reserved
            or address.is_unspecified
        ):
            raise EmbeddingError(
                "embeddings endpoint resolves to a private or internal address"
            )


# ------------------------------------------------------- hashing embedder ----


class HashingEmbedder:
    """Deterministic offline embedder (hashing trick, unigram + bigram)."""

    def __init__(self, dimensions: int = _DIMENSIONS) -> None:
        if dimensions <= 0:
            raise ValueError("dimensions must be positive")
        self.dimensions = dimensions
        self.id = f"hashing-{dimensions}"

    def _accumulate(self, vector: List[float], token: str, weight: float) -> None:
        digest = hashlib.blake2b(
            token.encode("utf-8"), digest_size=8, person=b"seo-studio-embed"
        ).digest()
        value = int.from_bytes(digest, "big")
        index = value % self.dimensions
        sign = 1.0 if (value >> 63) == 0 else -1.0
        vector[index] += sign * weight

    def embed(self, text: str) -> List[float]:
        tokens = _TOKEN_SPLIT.findall(text.lower())
        vector = [0.0] * self.dimensions
        for position, token in enumerate(tokens):
            self._accumulate(vector, token, 1.0)
            if position > 0:
                self._accumulate(vector, f"{tokens[position - 1]} {token}", 0.6)
        norm = math.sqrt(sum(value * value for value in vector))
        if norm == 0:
            return vector
        return [value / norm for value in vector]

    def embed_batch(self, texts: Sequence[str]) -> List[List[float]]:
        return [self.embed(text) for text in texts]


# ------------------------------------------------------------ HTTP client ----

#: Injected transport: ``(url, body_bytes, headers, timeout) -> response_bytes``.
Transport = Callable[[str, bytes, Dict[str, str], float], bytes]


class _NoRedirect(HTTPRedirectHandler):
    """Refuse redirects so the SSRF guard cannot be bypassed mid-request."""

    def redirect_request(self, *args: Any, **kwargs: Any) -> None:  # type: ignore[override]
        return None


def _default_transport(url: str, body: bytes, headers: Dict[str, str], timeout: float) -> bytes:
    parsed = urlparse(url)
    _assert_resolves_public(parsed.hostname or "", parsed.port or 0)
    request = Request(url, data=body, headers=headers, method="POST")
    opener = build_opener(_NoRedirect)
    try:
        with opener.open(request, timeout=timeout) as response:
            return response.read()
    except HTTPError as exc:
        # 3xx lands here because redirects are disabled — treat any non-2xx
        # as a failure without reading or following the body.
        raise EmbeddingError(f"embeddings endpoint returned HTTP {exc.code}") from exc
    except URLError as exc:
        raise EmbeddingError(f"embeddings endpoint request failed: {exc.reason}") from exc


class HttpEmbedder:
    """OpenAI-compatible embeddings client. Fail-closed (D-018)."""

    def __init__(
        self,
        endpoint: str,
        *,
        api_key: Optional[str] = None,
        timeout: float = 10.0,
        dimensions: int = 1536,
        transport: Optional[Transport] = None,
    ) -> None:
        if not is_safe_endpoint(endpoint):
            raise EmbeddingError(
                "embeddings endpoint failed the SSRF guard "
                f"(https required, no private hosts): {endpoint}"
            )
        self.endpoint = endpoint
        self.api_key = api_key
        self.timeout = timeout
        self.dimensions = dimensions
        self._width_locked = False
        self._transport = transport
        self._cache: Dict[str, List[float]] = {}
        host = urlparse(endpoint).hostname or "endpoint"
        self.id = f"http-{host}"

    def _request(self, texts: Sequence[str]) -> List[List[float]]:
        headers = {"content-type": "application/json"}
        if self.api_key:
            headers["authorization"] = f"Bearer {self.api_key}"
        body = json.dumps({"input": list(texts)}).encode("utf-8")

        if self._transport is not None:
            raw = self._transport(self.endpoint, body, headers, self.timeout)
        else:
            raw = _default_transport(self.endpoint, body, headers, self.timeout)

        try:
            parsed = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise EmbeddingError("embeddings endpoint returned invalid JSON") from exc

        vectors = _extract_vectors(parsed, len(texts))
        for vector in vectors:
            if not vector or not all(isinstance(v, (int, float)) for v in vector):
                raise EmbeddingError("embeddings endpoint returned a non-numeric vector")
            if not self._width_locked:
                self.dimensions = len(vector)
                self._width_locked = True
            elif len(vector) != self.dimensions:
                raise EmbeddingError(
                    f"embeddings endpoint returned width {len(vector)}, "
                    f"expected {self.dimensions} — refusing to mix vector spaces"
                )
        return vectors

    def embed_batch(self, texts: Sequence[str]) -> List[List[float]]:
        out: List[Optional[List[float]]] = [None] * len(texts)
        misses: List[tuple] = []
        for index, text in enumerate(texts):
            cached = self._cache.get(text)
            if cached is not None:
                out[index] = cached
            else:
                misses.append((index, text))
        if misses:
            fetched = self._request([text for _, text in misses])
            for (index, text), vector in zip(misses, fetched):
                out[index] = vector
                if len(self._cache) >= _CACHE_LIMIT:
                    self._cache.pop(next(iter(self._cache)))
                self._cache[text] = vector
        return [vector for vector in out if vector is not None]

    def embed(self, text: str) -> List[float]:
        return self.embed_batch([text])[0]


def _extract_vectors(parsed: Any, expected: int) -> List[List[float]]:
    """Accept ``{data:[{embedding}]}``, ``{embeddings:[[]]}`` and bare ``[[]]``."""
    vectors: Optional[List[List[float]]] = None
    if isinstance(parsed, list):
        vectors = parsed
    elif isinstance(parsed, Mapping):
        data = parsed.get("data")
        if isinstance(data, list):
            vectors = []
            for entry in data:
                embedding = entry.get("embedding") if isinstance(entry, Mapping) else None
                if not isinstance(embedding, list):
                    raise EmbeddingError("embeddings endpoint `data` entry has no `embedding`")
                vectors.append(embedding)
        elif isinstance(parsed.get("embeddings"), list):
            vectors = parsed["embeddings"]
    if vectors is None or len(vectors) != expected:
        found = len(vectors) if vectors is not None else 0
        raise EmbeddingError(f"embeddings endpoint returned {found} vectors for {expected} inputs")
    return [[float(value) for value in vector] for vector in vectors]


def embedder_from_env(
    env: Optional[Mapping[str, str]] = None, *, dimensions: int = _DIMENSIONS
) -> Any:
    """``EMBEDDINGS_ENDPOINT`` set → :class:`HttpEmbedder`; unset → hashing.

    Construction raises on an unsafe endpoint — there is deliberately no
    silent fallback to hashing once an endpoint is configured (D-018).
    """
    source = os.environ if env is None else env
    endpoint = (source.get("EMBEDDINGS_ENDPOINT") or "").strip()
    if not endpoint:
        return HashingEmbedder(dimensions)
    return HttpEmbedder(endpoint, api_key=source.get("EMBEDDINGS_API_KEY") or None)
