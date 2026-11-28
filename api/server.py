"""SEO Studio Python service — FastAPI HTTP bridges for the ``api/`` libraries.

Run from the repository root:

    uvicorn api.server:app --host 127.0.0.1 --port 8077

or equivalently:

    python3 api/server.py --port 8077

Endpoints
---------
GET  /health                   Liveness probe (no auth, no internals).
POST /v1/content/similarity    Thin-content + duplicate audit (``content_engine``).
POST /v1/content/link-graph    Internal link graph (``content_engine``).
POST /v1/content/validate      Validate a payload against one of the five content models (``models``).
POST /v1/reports/seo-visibility  Monthly PPTX build (``seo_visibility_report.build``).

Security model (fail-closed):
- ``SEO_PY_SERVICE_TOKEN``: when set, every ``/v1/*`` request must carry
  ``Authorization: Bearer <token>`` (constant-time compare). When unset, only
  loopback peers are served — the built-in CLI refuses a non-loopback bind
  unless ``SEO_PY_SERVICE_ALLOW_REMOTE=1`` *and* a token is configured, and the
  HTTP layer itself 403s non-loopback peers on ``/v1/*`` without a token, so an
  open bind can never silently expose the service.
- Request caps (page count, document size, upload size) reject oversized
  payloads with 413/422 before any work starts.
- Uploads land in a fresh server-generated temp dir with allow-listed
  extensions; no shell is involved anywhere in this file.

Statelessness: no module-level mutable state — configuration is read from the
environment per request, so the service behaves identically regardless of how
many workers uvicorn forks.
"""

from __future__ import annotations

import argparse
import logging
import os
import re
import secrets
import json
import sys
import tempfile
from pathlib import Path
from typing import Any, Literal, Optional

# Allow `python3 api/server.py` (repo root is then not on sys.path).
if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field, ValidationError
from starlette.concurrency import run_in_threadpool

from api.content_engine import batch_similarity_audit, generate_internal_link_graph
from api.models import (
    DestinationGuideModel,
    HotelFaqModel,
    PageMetadataModel,
    RoomShowcaseModel,
    SiteManifestItemModel,
)
from api.seo_visibility_report import build as build_report

# Lazy import helper for geo_visibility (keeps startup light).
def _geo_visibility():
    from python.geo_visibility import (  # type: ignore
        normalize_text,  # noqa: F401
    )
    import python.geo_visibility.providers as providers  # type: ignore
    import python.geo_visibility.runner as runner  # type: ignore
    import python.geo_visibility.metrics as metrics  # type: ignore
    return providers, runner, metrics

logger = logging.getLogger("seo-studio.python")

_LOOPBACK_PEERS = frozenset({"127.0.0.1", "::1", "localhost"})

# Payload caps — mirrored in zod on the Node bridge (tests/python + vitest lock
# the two sides together). Reject before any computation, not during.
MAX_PAGES = 50
MAX_DOCUMENT_CHARS = 200_000
MAX_MANIFEST_ITEMS = 500
MAX_UPLOAD_BYTES = 25 * 1024 * 1024

PPTX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation"


# ─────────────────────────────────────────────────────────────────────────────
# Auth (fail-closed): bearer token when configured; loopback-only otherwise.
# ─────────────────────────────────────────────────────────────────────────────
def require_bearer(authorization: Optional[str] = Header(default=None)) -> None:
    """Enforce ``SEO_PY_SERVICE_TOKEN`` on every ``/v1/*`` route when it is set."""
    expected = os.environ.get("SEO_PY_SERVICE_TOKEN", "")
    if not expected:
        return  # No token configured: the loopback middleware already refused
        # any non-loopback peer, so only local callers reach this point.
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not secrets.compare_digest(
        token.encode("utf-8"), expected.encode("utf-8")
    ):
        raise HTTPException(status_code=401, detail="Unauthorized")


class SimilarityPage(BaseModel):
    id: str = Field(min_length=1, max_length=200)
    url: str = Field(default="", max_length=2048)
    content: str = Field(default="", max_length=MAX_DOCUMENT_CHARS)


class SimilarityRequest(BaseModel):
    pages: list[SimilarityPage] = Field(min_length=1, max_length=MAX_PAGES)
    max_similarity: float = Field(default=0.70, ge=0.0, le=1.0)
    min_words: int = Field(default=250, ge=0, le=100_000)


class ManifestItem(BaseModel):
    url: str = Field(min_length=1, max_length=2048)
    parentPage: Optional[str] = Field(default=None, max_length=2048)
    primaryKeyword: str = Field(default="", max_length=300)
    secondaryTags: list[str] = Field(default_factory=list, max_length=50)
    categoryHierarchy: list[str] = Field(default_factory=list, max_length=50)
    approvedAnchorVariations: list[str] = Field(default_factory=list, max_length=50)


class LinkGraphRequest(BaseModel):
    items: list[ManifestItem] = Field(min_length=1, max_length=MAX_MANIFEST_ITEMS)
    max_links_per_page: int = Field(default=5, ge=1, le=50)


# Content-model validation (api/models.py served over HTTP).
MAX_VALIDATION_FIELDS = 64


class ContentModelValidationRequest(BaseModel):
    kind: Literal[
        "destination-guide",
        "room-showcase",
        "hotel-faq",
        "page-metadata",
        "site-manifest-item",
    ]
    payload: dict[str, Any] = Field(default_factory=dict)


class GeoVisibilityRunRequest(BaseModel):
    provider: Literal["recorded", "openai", "perplexity", "gemini"] = "recorded"
    n_runs: int = Field(default=3, ge=1, le=10)
    intents: Optional[list[str]] = None  # intent ids; None = all in pack
    include_all_intents: bool = False


class GeoVisibilityMetricsQuery(BaseModel):
    provider: Optional[str] = None
    entity: Optional[str] = None
    week: Optional[str] = None


CONTENT_MODELS: dict[str, type[BaseModel]] = {
    "destination-guide": DestinationGuideModel,
    "room-showcase": RoomShowcaseModel,
    "hotel-faq": HotelFaqModel,
    "page-metadata": PageMetadataModel,
    "site-manifest-item": SiteManifestItemModel,
}


app = FastAPI(
    title="SEO Studio Python Service",
    version="1.0.0",
    description="HTTP bridges over api/content_engine.py and api/seo_visibility_report.py",
)


@app.middleware("http")
async def loopback_only_without_token(request: Request, call_next):
    """Fail closed: /v1/* is loopback-only unless a bearer token is configured.

    The peer address comes from the TCP connection (not from any header), so it
    cannot be spoofed. With a token set, remote peers are allowed through to
    ``require_bearer``, which still demands the bearer on every request.
    """
    if request.url.path.startswith("/v1/"):
        peer = request.client.host if request.client else ""
        if peer not in _LOOPBACK_PEERS and not os.environ.get("SEO_PY_SERVICE_TOKEN"):
            return JSONResponse(
                status_code=403,
                content={
                    "detail": (
                        "Non-loopback access requires SEO_PY_SERVICE_TOKEN to be "
                        "set on the service."
                    )
                },
            )
    return await call_next(request)


@app.get("/health")
def health() -> dict:
    """Liveness probe — status only, no configuration or version internals."""
    return {"status": "ok", "service": "seo-studio-python"}


@app.post("/v1/content/similarity")
def content_similarity(
    payload: SimilarityRequest,
    _auth: None = Depends(require_bearer),
) -> dict:
    """Thin-content + duplicate audit (TF-IDF / Jaccard, measured per pair)."""
    pages = [page.model_dump() for page in payload.pages]
    return batch_similarity_audit(
        pages,
        max_similarity=payload.max_similarity,
        min_words=payload.min_words,
    )


@app.post("/v1/content/link-graph")
def content_link_graph(
    payload: LinkGraphRequest,
    _auth: None = Depends(require_bearer),
) -> dict:
    """Internal link graph scored from parent/tag/category relationships."""
    items = [item.model_dump() for item in payload.items]
    return generate_internal_link_graph(
        items,
        max_links_per_page=payload.max_links_per_page,
    )


@app.post("/v1/content/validate")
def validate_content_model(
    payload: ContentModelValidationRequest,
    _auth: None = Depends(require_bearer),
) -> dict:
    """Validate a payload against one of the five ``api/models.py`` models.

    Pure validation — no file, network or scoring work. Returns the parsed
    model (defaults filled in) on success, or 422 with the pydantic errors.
    Unknown kinds are rejected by the ``Literal`` above; extra payload keys are
    ignored, matching the model definitions.
    """
    if len(payload.payload) > MAX_VALIDATION_FIELDS:
        raise HTTPException(
            status_code=413,
            detail=f"payload exceeds {MAX_VALIDATION_FIELDS} fields",
        )
    model_cls = CONTENT_MODELS[payload.kind]
    try:
        instance = model_cls.model_validate(payload.payload)
    except ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail={
                "valid": False,
                "kind": payload.kind,
                "errors": exc.errors(include_url=False, include_context=False),
            },
        ) from exc
    return {"valid": True, "kind": payload.kind, "data": instance.model_dump()}


async def _spool_upload(upload: UploadFile, suffix: str, dest_dir: Path) -> Path:
    """Validate and spool one upload under a server-generated name.

    Extension allow-list (suffix match on the client filename) plus a byte cap;
    the on-disk name is derived from the suffix only, so no client-controlled
    path component ever reaches the filesystem.
    """
    filename = (upload.filename or "").lower()
    if not filename.endswith(suffix):
        raise HTTPException(status_code=400, detail=f"Expected a {suffix} upload")
    data = await upload.read(MAX_UPLOAD_BYTES + 1)
    if not data:
        raise HTTPException(status_code=400, detail="Empty upload")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Upload exceeds the size limit")
    target = dest_dir / f"{suffix.lstrip('.')}_upload{suffix}"
    target.write_bytes(data)
    return target


@app.post("/v1/reports/seo-visibility")
async def seo_visibility_report(
    template: UploadFile = File(...),
    xlsx: UploadFile = File(...),
    pdf: Optional[UploadFile] = File(None),
    full_list_url: str = Form(""),
    target_url: str = Form(""),
    _auth: None = Depends(require_bearer),
) -> Response:
    """Build the monthly SEO visibility deck and return it as a pptx download."""
    with tempfile.TemporaryDirectory(prefix="seo-studio-report-") as tmp:
        tmp_dir = Path(tmp)
        template_path = await _spool_upload(template, ".pptx", tmp_dir)
        xlsx_path = await _spool_upload(xlsx, ".xlsx", tmp_dir)
        pdf_path = await _spool_upload(pdf, ".pdf", tmp_dir) if pdf is not None else None
        output_path = tmp_dir / "output.pptx"

        try:
            await run_in_threadpool(
                build_report,
                template_path,
                pdf_path,
                xlsx_path,
                output_path,
                full_list_url,
                target_url,
            )
        except Exception:
            logger.exception("SEO visibility report build failed")
            raise HTTPException(status_code=500, detail="Report build failed") from None

        data = output_path.read_bytes()

    if not data:
        raise HTTPException(status_code=500, detail="Report build produced no output")

    # Header-safe filename: strip everything outside [A-Za-z0-9_-] (no quotes,
    # no CRLF) and cap the length. Derived from the workbook name only.
    stem = Path(xlsx.filename or "report").stem
    safe = re.sub(r"[^A-Za-z0-9_-]+", "_", stem).strip("_")[:80] or "report"
    return Response(
        content=data,
        media_type=PPTX_MEDIA_TYPE,
        headers={
            "Content-Disposition": f'attachment; filename="seo_visibility_report_{safe}.pptx"'
        },
    )


import yaml as _yaml

GEO_VISIBILITY_LAST_RUN = Path("data/geo_visibility/last_run.json")
GEO_VISIBILITY_RUNS_DIR = Path("data/geo_visibility/runs")


@app.post("/v1/geo-visibility/run")
def geo_visibility_run(
    payload: GeoVisibilityRunRequest,
    _auth: None = Depends(require_bearer),
) -> dict:
    """Run an AI visibility pass and return aggregated metrics.

    Uses recorded answers when provider="recorded" (no API key needed);
    real providers require their respective env keys.
    """
    providers, runner, metrics_mod = _geo_visibility()

    root = Path(__file__).resolve().parent.parent
    intents_path = root / "src" / "packs" / "bangladesh-hotels" / "queries.yaml"
    entities_path = root / "src" / "packs" / "bangladesh-hotels" / "entities.yaml"
    all_intents = _yaml.safe_load(intents_path.read_text())["intents"]
    all_entities = _yaml.safe_load(entities_path.read_text())["entities"]

    if payload.intents:
        want = set(payload.intents)
        intents = [i for i in all_intents if i["id"] in want]
    elif payload.include_all_intents:
        intents = all_intents
    else:
        intents = all_intents[:5]

    # Provider selection.
    if payload.provider == "recorded":
        fixture_path = root / "data" / "geo_visibility" / "recorded_answers.json"
        fixture = json.loads(fixture_path.read_text()) if fixture_path.exists() else {}
        provider = providers.RecordedProvider(name="recorded", fixture=fixture)
    elif payload.provider == "openai":
        provider = providers.OpenAIProvider()
    elif payload.provider == "perplexity":
        provider = providers.PerplexityProvider()
    else:
        provider = providers.GeminiProvider()

    out_dir = root / "data" / "geo_visibility" / "runs"
    results = runner.run_visibility(provider, intents, all_entities, n=payload.n_runs,
                                    out_dir=out_dir)
    agg = metrics_mod.aggregate(results)

    import datetime as _dt
    run_id = _dt.datetime.now(_dt.timezone.utc).isoformat()
    GEO_VISIBILITY_LAST_RUN.parent.mkdir(parents=True, exist_ok=True)
    GEO_VISIBILITY_LAST_RUN.write_text(
        json.dumps({"run_id": run_id, "provider": payload.provider,
                    "metrics": agg, "n_results": len(results)}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return {"run_id": run_id, "provider": payload.provider,
            "n_results": len(results), "metrics": agg}


@app.get("/v1/geo-visibility/metrics")
def geo_visibility_metrics(
    provider: Optional[str] = None,
    entity: Optional[str] = None,
    week: Optional[str] = None,
    _auth: None = Depends(require_bearer),
) -> dict:
    """Return aggregated metrics from the last run."""
    root = Path(__file__).resolve().parent.parent
    last_path = root / "data" / "geo_visibility" / "last_run.json"
    if not last_path.exists():
        return {"metrics": [], "note": "no run yet"}
    data = json.loads(last_path.read_text())
    metrics = data.get("metrics", [])
    if provider:
        metrics = [m for m in metrics if m.get("provider") == provider]
    if entity:
        metrics = [m for m in metrics if m.get("entity") == entity]
    if week:
        metrics = [m for m in metrics if m.get("week") == week]
    return {"run_id": data.get("run_id"), "metrics": metrics}


def run(argv: Optional[list[str]] = None) -> None:
    """CLI entry point with a fail-closed bind guard."""
    parser = argparse.ArgumentParser(description="SEO Studio Python service (FastAPI)")
    parser.add_argument(
        "--host",
        default=os.environ.get("SEO_PY_SERVICE_HOST", "127.0.0.1"),
        help="Bind address (default: 127.0.0.1)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("SEO_PY_SERVICE_PORT", "8077")),
        help="Bind port (default: 8077)",
    )
    args = parser.parse_args(argv)

    token = os.environ.get("SEO_PY_SERVICE_TOKEN", "")
    allow_remote = os.environ.get("SEO_PY_SERVICE_ALLOW_REMOTE") == "1"
    if args.host not in _LOOPBACK_PEERS and not (token and allow_remote):
        sys.exit(
            f"Refusing to bind non-loopback host {args.host!r} without protection: "
            "set SEO_PY_SERVICE_TOKEN and SEO_PY_SERVICE_ALLOW_REMOTE=1, "
            "or bind 127.0.0.1 (the default)."
        )

    import uvicorn

    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    run()
