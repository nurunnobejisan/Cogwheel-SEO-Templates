"""Tests for the FastAPI Python service (`api/server.py`).

Covers the fail-closed security model (bearer token, loopback-only peers,
payload caps, upload allow-list), the measured content-engine endpoints, the
content-model validation endpoint (`api/models.py` served at
`/v1/content/validate`), and a real end-to-end PPTX build through
`/v1/reports/seo-visibility`.
"""

import sys
from pathlib import Path
from typing import get_args

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import pytest
from fastapi.testclient import TestClient

from api.server import CONTENT_MODELS, ContentModelValidationRequest, app

TOKEN = "test-token"


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv("SEO_PY_SERVICE_TOKEN", TOKEN)
    with TestClient(app) as test_client:
        yield test_client


def auth(token: str = TOKEN) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ─────────────────────────────────────────────────────────────────────────────
# Security model (fail-closed)
# ─────────────────────────────────────────────────────────────────────────────
def test_health_needs_no_auth(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "service": "seo-studio-python"}


def test_v1_requires_bearer_when_token_is_configured(client):
    assert client.post("/v1/content/similarity", json={"pages": []}).status_code == 401
    assert (
        client.post(
            "/v1/content/similarity",
            json={"pages": []},
            headers=auth("wrong-token"),
        ).status_code
    ) == 401


def test_v1_rejects_non_loopback_peers_when_no_token_is_set(monkeypatch):
    """No token + non-loopback peer (TestClient's peer is 'testclient') → 403."""
    monkeypatch.delenv("SEO_PY_SERVICE_TOKEN", raising=False)
    with TestClient(app) as bare_client:
        resp = bare_client.post(
            "/v1/content/similarity",
            json={"pages": [{"id": "a", "content": "some words here"}]},
        )
        assert resp.status_code == 403
        assert "SEO_PY_SERVICE_TOKEN" in resp.json()["detail"]
        # Health stays reachable for probes.
        assert bare_client.get("/health").status_code == 200


def test_payload_caps_reject_oversized_requests(client):
    too_many_pages = [{"id": f"p{i}", "content": "x"} for i in range(51)]
    resp = client.post(
        "/v1/content/similarity",
        json={"pages": too_many_pages},
        headers=auth(),
    )
    assert resp.status_code == 422

    huge_document = [{"id": "p1", "content": "x" * 200_001}]
    resp = client.post(
        "/v1/content/similarity",
        json={"pages": huge_document},
        headers=auth(),
    )
    assert resp.status_code == 422


def test_wrong_upload_extension_is_rejected(client):
    files = {
        "template": ("notes.txt", b"not a pptx", "text/plain"),
        "xlsx": ("keywords.xlsx", b"not an xlsx", "application/octet-stream"),
    }
    resp = client.post("/v1/reports/seo-visibility", files=files, headers=auth())
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Expected a .pptx upload"


def test_report_endpoint_requires_auth(client):
    files = {
        "template": ("template.pptx", b"x", "application/octet-stream"),
        "xlsx": ("keywords.xlsx", b"x", "application/octet-stream"),
    }
    assert client.post("/v1/reports/seo-visibility", files=files).status_code == 401


def test_cli_refuses_non_loopback_bind_without_protection(monkeypatch):
    monkeypatch.delenv("SEO_PY_SERVICE_TOKEN", raising=False)
    monkeypatch.delenv("SEO_PY_SERVICE_ALLOW_REMOTE", raising=False)
    from api.server import run

    with pytest.raises(SystemExit) as excinfo:
        run(["--host", "0.0.0.0"])
    assert "Refusing to bind non-loopback host" in str(excinfo.value)


def test_cli_binds_non_loopback_only_with_token_and_opt_in(monkeypatch):
    monkeypatch.setenv("SEO_PY_SERVICE_TOKEN", TOKEN)
    monkeypatch.setenv("SEO_PY_SERVICE_ALLOW_REMOTE", "1")
    import uvicorn

    from api.server import run

    captured = {}
    monkeypatch.setattr(uvicorn, "run", lambda _app, host, port: captured.update(host=host, port=port))
    run(["--host", "0.0.0.0", "--port", "9001"])
    assert captured == {"host": "0.0.0.0", "port": 9001}


# ─────────────────────────────────────────────────────────────────────────────
# Content engine endpoints (measured TF-IDF / Jaccard, deterministic)
# ─────────────────────────────────────────────────────────────────────────────
def test_similarity_audit_flags_duplicates_and_thin_pages(client):
    base = (
        "The Curtis Denver provides pop culture themed guest rooms with retro "
        "arcade games and dining. "
    ) * 30
    pages = [
        {"id": "page-1", "url": "https://example.com/1/", "content": base},
        {"id": "page-2", "url": "https://example.com/2/", "content": base + "Book online."},
        {"id": "page-thin", "url": "https://example.com/thin/", "content": "Thin content."},
    ]
    resp = client.post(
        "/v1/content/similarity",
        json={"pages": pages, "min_words": 100},
        headers=auth(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["all_passed"] is False

    by_id = {row["id"]: row for row in data["results"]}
    assert by_id["page-1"]["is_duplicate_blocked"] is True
    assert by_id["page-1"]["highest_similarity"] > 0.70
    assert by_id["page-1"]["most_similar_page_id"] == "page-2"
    assert by_id["page-thin"]["is_thin_content"] is True
    # Results are computed, not invented: similarity is symmetric.
    assert by_id["page-2"]["most_similar_page_id"] == "page-1"


def test_similarity_audit_passes_distinct_pages(client):
    pages = [
        {"id": "a", "content": "Unique page about alpine hiking trails and cable cars. " * 40},
        {"id": "b", "content": "Distinct page covering coastal bird watching reserves. " * 40},
    ]
    resp = client.post(
        "/v1/content/similarity",
        json={"pages": pages, "min_words": 50},
        headers=auth(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["all_passed"] is True
    assert all(row["highest_similarity"] <= 0.70 for row in data["results"])


def test_link_graph_scores_parent_and_shared_tag_relationships(client):
    items = [
        {"url": "https://example.com/", "primaryKeyword": "home"},
        {
            "url": "https://example.com/rooms",
            "parentPage": "https://example.com/",
            "primaryKeyword": "rooms",
            "secondaryTags": ["suites"],
        },
        {
            "url": "https://example.com/suites",
            "parentPage": "https://example.com/",
            "primaryKeyword": "suites",
            "secondaryTags": ["suites"],
        },
    ]
    resp = client.post(
        "/v1/content/link-graph",
        json={"items": items},
        headers=auth(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["totalPages"] == 3

    # Output carries relationship + anchor only; score drives the ordering
    # (parent 50 > sibling 40 from shared parent + shared tag), so the order
    # itself is the measurable assertion.
    rooms_targets = data["graph"]["https://example.com/rooms"]
    assert [t["relationship"] for t in rooms_targets] == ["parent", "sibling"]
    assert rooms_targets[0]["targetUrl"] == "https://example.com/"
    assert rooms_targets[0]["anchorText"] == "home"
    assert rooms_targets[1]["targetUrl"] == "https://example.com/suites"

    # A page with no relationships contributes an empty edge list, not a crash.
    assert data["graph"]["https://example.com/suites"]


# ─────────────────────────────────────────────────────────────────────────────
# End-to-end report build (real python-pptx / openpyxl, no network)
# ─────────────────────────────────────────────────────────────────────────────
def _make_template(path: Path) -> None:
    from pptx import Presentation
    from pptx.util import Inches

    prs = Presentation()
    for _ in range(4):
        prs.slides.add_slide(prs.slide_layouts[6])  # Blank
    # Slide 2 (index 1): tracked-keyword table — build() requires ≥4 columns.
    prs.slides[1].shapes.add_table(2, 4, Inches(0.5), Inches(1.5), Inches(9), Inches(3))
    # Slide 3 (index 2): ancillary table — build() requires ≥3 columns.
    prs.slides[2].shapes.add_table(2, 3, Inches(0.5), Inches(1.5), Inches(9), Inches(3))
    prs.save(str(path))


def _make_workbook(path: Path) -> None:
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.append(["Keyword", "Position", "Volume"])
    rows = [
        ("denver hotel packages", 3, 480),
        ("denver downtown hotel", 5, 390),
        ("colorado resort deals", 8, 260),
        ("pet friendly hotel denver", 12, 170),
        ("luxury suites denver", 15, 130),
        ("weekend hotel denver", 19, 90),
        ("hotel near union station", 21, 70),
        ("boutique hotel denver", 24, 60),
        ("denver hotel with pool", 27, 55),
        ("family hotel denver", 30, 50),
        ("denver lodging deals", 33, 45),
        ("cheap rooms denver", 36, 40),
    ]
    for row in rows:
        ws.append(list(row))
    wb.save(str(path))


def test_report_endpoint_builds_a_real_deck(client, tmp_path):
    template_path = tmp_path / "template.pptx"
    workbook_path = tmp_path / "Test Property keywords.xlsx"
    _make_template(template_path)
    _make_workbook(workbook_path)

    resp = client.post(
        "/v1/reports/seo-visibility",
        files={
            "template": (
                "template.pptx",
                template_path.read_bytes(),
                "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            ),
            "xlsx": (
                "Test Property keywords.xlsx",
                workbook_path.read_bytes(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ),
        },
        headers=auth(),
    )
    assert resp.status_code == 200, resp.text
    # A real pptx is a ZIP container.
    assert resp.content[:2] == b"PK"
    disposition = resp.headers["content-disposition"]
    assert disposition == (
        'attachment; filename="seo_visibility_report_Test_Property_keywords.pptx"'
    )
    # Header value is sanitised (no quotes/CRLF beyond the wrapping ones).
    assert "\n" not in disposition and "\r" not in disposition


def test_report_endpoint_rejects_oversized_upload(client):
    resp = client.post(
        "/v1/reports/seo-visibility",
        files={
            "template": ("template.pptx", b"x" * (25 * 1024 * 1024 + 1), "application/octet-stream"),
            "xlsx": ("keywords.xlsx", b"x", "application/octet-stream"),
        },
        headers=auth(),
    )
    assert resp.status_code == 413


# ─────────────────────────────────────────────────────────────────────────────
# Content-model validation (api/models.py served at /v1/content/validate)
# ─────────────────────────────────────────────────────────────────────────────

VALID_DESTINATION_GUIDE = {
    "hotelName": "The Curtis Denver",
    "cityName": "Denver",
    "destinationTitle": "Ultimate Denver Guide",
    "destinationOverview": "Discover Denver culture and hospitality.",
}

MINIMAL_PAYLOADS = {
    "destination-guide": VALID_DESTINATION_GUIDE,
    "room-showcase": {
        "hotelName": "The Curtis Denver",
        "cityName": "Denver",
        "roomTitle": "Pop Art King",
        "roomDescription": "A bright king room.",
    },
    "hotel-faq": {"hotelName": "The Curtis Denver", "cityName": "Denver"},
    "page-metadata": {
        "title": "Boutique Hotels Denver | The Curtis",
        "metaDescription": "Stay at The Curtis in Denver.",
        "canonicalUrl": "https://thecurtis.com/rooms",
    },
    "site-manifest-item": {
        "url": "https://thecurtis.com/rooms",
        "primaryKeyword": "boutique hotels denver",
    },
}


def _validate(client, kind, payload, headers=None):
    return client.post(
        "/v1/content/validate",
        json={"kind": kind, "payload": payload},
        headers=headers if headers is not None else auth(),
    )


def test_validate_content_model_returns_parsed_model_with_defaults(client):
    resp = _validate(client, "destination-guide", VALID_DESTINATION_GUIDE)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["valid"] is True
    assert body["kind"] == "destination-guide"
    assert body["data"]["hotelName"] == "The Curtis Denver"
    # Defaults from api/models.py are filled in.
    assert body["data"]["brand"] == "Independent Collection"
    assert "lowest direct booking" in body["data"]["bookingPerks"]


def test_validate_content_model_reports_missing_required_fields(client):
    resp = _validate(client, "destination-guide", {"hotelName": "Only this"})
    assert resp.status_code == 422
    detail = resp.json()["detail"]
    assert detail["valid"] is False
    assert detail["kind"] == "destination-guide"
    missing = {tuple(err["loc"]) for err in detail["errors"]}
    assert ("cityName",) in missing
    assert ("destinationTitle",) in missing


def test_validate_content_model_rejects_unknown_kind(client):
    resp = _validate(client, "not-a-model", {})
    assert resp.status_code == 422


def test_validate_content_model_accepts_every_registered_kind(client):
    for kind, minimal in MINIMAL_PAYLOADS.items():
        resp = _validate(client, kind, minimal)
        assert resp.status_code == 200, (kind, resp.text)
        assert resp.json()["valid"] is True


def test_validate_content_model_ignores_extra_payload_keys(client):
    payload = {**VALID_DESTINATION_GUIDE, "notAModelField": "x" * 100}
    resp = _validate(client, "destination-guide", payload)
    assert resp.status_code == 200
    assert "notAModelField" not in resp.json()["data"]


def test_validate_content_model_caps_field_count(client):
    payload = {f"key{i}": "x" for i in range(65)}
    resp = _validate(client, "destination-guide", payload)
    assert resp.status_code == 413


def test_validate_content_model_requires_bearer_when_token_is_configured(client):
    resp = client.post("/v1/content/validate", json={"kind": "hotel-faq", "payload": {}})
    assert resp.status_code == 401
    resp = _validate(client, "hotel-faq", {}, headers=auth("wrong-token"))
    assert resp.status_code == 401


def test_content_model_kinds_match_the_models_registry():
    kinds = get_args(ContentModelValidationRequest.model_fields["kind"].annotation)
    assert set(kinds) == set(CONTENT_MODELS)
