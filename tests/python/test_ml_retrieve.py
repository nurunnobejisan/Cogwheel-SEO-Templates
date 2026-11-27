#!/usr/bin/env python3
"""Tests for the retrieval layer (ml/retrieve/).

Chunking provenance, licence-gated corpora, hashing/HTTP embedders with the
SSRF guard, the in-memory vector store, and the page-type classifier.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Dict, List

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml.registry import LicenceError  # noqa: E402
from ml.retrieve import chunk as chunk_mod  # noqa: E402
from ml.retrieve import classifier  # noqa: E402
from ml.retrieve import corpus as corpus_mod  # noqa: E402
from ml.retrieve import embed as embed_mod  # noqa: E402
from ml.retrieve import store as store_mod  # noqa: E402

# ------------------------------------------------------------------ chunk --


def test_chunk_text_respects_budget_and_overlaps() -> None:
    text = " ".join(f"Sentence number {i} about hotel schema." for i in range(40))
    pieces = chunk_mod.chunk_text(text, max_chars=200, overlap=50)
    assert pieces
    assert all(len(piece) <= 200 for piece in pieces)
    # Consecutive chunks share a boundary tail so facts stay retrievable.
    assert any(pieces[i][-30:] in pieces[i + 1] for i in range(len(pieces) - 1))


def test_chunk_text_clamps_pathological_overlap() -> None:
    # Overlap >= max_chars must not loop forever.
    text = "One. Two. Three. Four. Five."
    pieces = chunk_mod.chunk_text(text, max_chars=10, overlap=9_999)
    assert pieces and all(len(p) <= 10 for p in pieces)


def test_chunk_text_rejects_nonpositive_budget() -> None:
    with pytest.raises(ValueError):
        chunk_mod.chunk_text("hello", max_chars=0)


def test_chunk_document_carries_provenance_and_offsets() -> None:
    text = "First sentence here. Second sentence follows. Third one ends it."
    chunks = chunk_mod.chunk_document(
        doc_id="doc-1",
        title="Page title",
        text=text,
        source="google-search-central",
        url="https://developers.google.com/search/docs",
        tags=["schema"],
        max_chars=40,
        overlap=10,
    )
    assert chunks
    for position, item in enumerate(chunks, start=1):
        assert item["id"] == f"doc-1#{position}"
        assert item["source"] == "google-search-central"
        assert item["url"] == "https://developers.google.com/search/docs"
        assert item["tags"] == ["schema"]
        assert item["charStart"] <= item["charEnd"]
        assert text[item["charStart"] : item["charEnd"]] == item["text"]


def test_chunk_document_empty_text_returns_no_chunks() -> None:
    assert chunk_mod.chunk_document(doc_id="d", title="t", text="   ", source="s") == []


def test_chunk_id_is_stable_and_content_addressed() -> None:
    assert chunk_mod.chunk_id("doc", "text") == chunk_mod.chunk_id("doc", "text")
    assert chunk_mod.chunk_id("doc", "text") != chunk_mod.chunk_id("doc", "other")


# ----------------------------------------------------------------- corpus --

VALID_SOURCE = "google-search-central"


def _chunk(source: str = VALID_SOURCE, **overrides: Any) -> Dict[str, Any]:
    record: Dict[str, Any] = {
        "id": f"c-{id(overrides)}-{len(overrides)}",
        "title": "Title",
        "text": "Some licence-clean text about structured data.",
        "source": source,
        "tags": ["schema"],
        "url": "https://example.com/page",
    }
    if source == VALID_SOURCE:
        # google-search-central is train_attribution: the notice must name it.
        record["attribution"] = f"Documentation from {VALID_SOURCE} (CC BY 4.0)"
    record.update(overrides)
    return record


def test_validate_chunks_accepts_registered_source() -> None:
    validated = corpus_mod.validate_chunks([_chunk()])
    assert len(validated) == 1


def test_validate_chunks_rejects_unknown_source() -> None:
    with pytest.raises(LicenceError):
        corpus_mod.validate_chunks([_chunk(source="not-a-real-source")])


def test_validate_chunks_rejects_missing_fields_and_empty_text() -> None:
    with pytest.raises(corpus_mod.CorpusError):
        corpus_mod.validate_chunks([{"id": "x"}])
    with pytest.raises(corpus_mod.CorpusError):
        corpus_mod.validate_chunks([_chunk(text="   ")])


def test_validate_chunks_rejects_duplicate_ids() -> None:
    first = _chunk()
    second = dict(first)
    with pytest.raises(corpus_mod.CorpusError):
        corpus_mod.validate_chunks([first, second])


def test_validate_chunks_rejects_non_http_url() -> None:
    with pytest.raises(corpus_mod.CorpusError):
        corpus_mod.validate_chunks([_chunk(url="ftp://example.com/x")])


def test_train_split_gate_blocks_non_trainable_source() -> None:
    # An eval_only/avoid source must not enter a train corpus even if someone
    # writes it into the file by hand.
    from ml.registry import load_registry

    registry = load_registry()
    non_trainable = [sid for sid in registry.ids() if not registry.get(sid).trainable]
    if not non_trainable:
        pytest.skip("registry has no non-trainable sources to test against")
    with pytest.raises(LicenceError):
        corpus_mod.validate_chunks([_chunk(source=non_trainable[0])], split="train")


def test_attribution_required_source_needs_a_naming_notice() -> None:
    from ml.registry import load_registry

    registry = load_registry()
    attributed = [
        sid
        for sid in registry.ids()
        if registry.get(sid).needs_attribution and registry.get(sid).trainable
    ]
    if not attributed:
        pytest.skip("registry has no attribution-required trainable sources")
    source = attributed[0]
    without_notice = _chunk(source=source)
    without_notice.pop("attribution", None)
    with pytest.raises(corpus_mod.CorpusError):
        corpus_mod.validate_chunks([without_notice])
    ok = corpus_mod.validate_chunks(
        [_chunk(source=source, attribution=f"Content from {source} (licence)")]
    )
    assert ok


def test_save_and_load_corpus_roundtrip(tmp_path: Path) -> None:
    path = tmp_path / "corpus.jsonl"
    corpus_mod.save_corpus([_chunk()], path)
    loaded = corpus_mod.load_corpus(path)
    assert loaded[0]["source"] == VALID_SOURCE


def test_load_corpus_reports_bad_json_with_line_number(tmp_path: Path) -> None:
    path = tmp_path / "bad.jsonl"
    path.write_text('{"id": "ok"}\nnot-json\n', encoding="utf-8")
    with pytest.raises(corpus_mod.CorpusError, match=":2:"):
        corpus_mod.load_corpus(path)


def test_build_from_html_extracts_and_gates(tmp_path: Path) -> None:
    html = (
        "<html><head><title>Hotel page</title></head><body>"
        "<p>Welcome to our hotel with booking.</p></body></html>"
    )
    pages = [{"url": "https://example.com/hotel", "html": html}]
    chunks, report = corpus_mod.build_from_html(
        pages,
        source=VALID_SOURCE,
        tags=["hotel"],
        split="train",
        attribution=f"Content from {VALID_SOURCE} (CC BY 4.0)",
    )
    assert report.documents == 1
    assert report.chunks >= 1
    assert chunks[0]["url"] == "https://example.com/hotel"
    assert chunks[0]["source"] == VALID_SOURCE
    assert VALID_SOURCE in chunks[0]["attribution"]


def test_build_from_html_skips_pages_without_html() -> None:
    chunks, report = corpus_mod.build_from_html(
        [{"url": "https://example.com/x"}], source=VALID_SOURCE
    )
    assert chunks == []
    assert report.skipped == 1


def test_build_from_html_refuses_forbidden_source_before_extracting() -> None:
    with pytest.raises(LicenceError):
        corpus_mod.build_from_html(
            [{"url": "https://example.com/x", "html": "<html></html>"}],
            source="definitely-not-registered",
        )


# ------------------------------------------------------------------- embed --


def test_hashing_embedder_is_deterministic_and_normalised() -> None:
    embedder = embed_mod.HashingEmbedder(dimensions=64)
    a = embedder.embed("hotel structured data")
    b = embedder.embed("hotel structured data")
    assert a == b
    assert len(a) == 64
    norm = sum(v * v for v in a) ** 0.5
    assert abs(norm - 1.0) < 1e-9
    # Different text, different vector.
    assert embedder.embed("spa menu prices") != a


def test_hashing_embedder_rejects_bad_dimensions() -> None:
    with pytest.raises(ValueError):
        embed_mod.HashingEmbedder(dimensions=0)


def test_hashing_embedder_batch_matches_single() -> None:
    embedder = embed_mod.HashingEmbedder(dimensions=32)
    batch = embedder.embed_batch(["alpha", "beta"])
    assert batch[0] == embedder.embed("alpha")
    assert batch[1] == embedder.embed("beta")


@pytest.mark.parametrize(
    "endpoint",
    [
        "file:///etc/passwd",
        "ftp://example.com/x",
        "not a url",
        "http://localhost:8080",
        "http://127.0.0.1",
        "http://10.1.2.3",
        "http://169.254.169.254/latest/meta-data",
        "http://[::1]/",
        "http://service.internal",
        "https://user:pass@example.com",
        "http://db.local",
    ],
)
def test_is_safe_endpoint_rejects_unsafe_targets(endpoint: str) -> None:
    assert not embed_mod.is_safe_endpoint(endpoint)


@pytest.mark.parametrize(
    "endpoint",
    ["https://api.example.com/v1/embeddings", "http://embeddings.example.org"],
)
def test_is_safe_endpoint_accepts_public_targets(endpoint: str) -> None:
    assert embed_mod.is_safe_endpoint(endpoint)


def test_embedder_from_env_switches_on_endpoint() -> None:
    hashing = embed_mod.embedder_from_env({})
    assert isinstance(hashing, embed_mod.HashingEmbedder)
    http = embed_mod.embedder_from_env({"EMBEDDINGS_ENDPOINT": "https://api.example.com/e"})
    assert isinstance(http, embed_mod.HttpEmbedder)


def test_embedder_from_env_fails_closed_on_unsafe_endpoint() -> None:
    with pytest.raises(embed_mod.EmbeddingError):
        embed_mod.embedder_from_env({"EMBEDDINGS_ENDPOINT": "http://localhost:9999"})


def _transport(
    width: int = 4, status: int = 200, body: str | None = None
) -> tuple:
    calls: List[Dict[str, Any]] = []

    def send(url: str, payload: bytes, headers: Dict[str, str], timeout: float) -> bytes:
        calls.append({"url": url, "payload": json.loads(payload), "headers": headers})
        if status >= 400:
            raise embed_mod.EmbeddingError(f"embeddings endpoint returned HTTP {status}")
        if body is not None:
            return body.encode("utf-8")
        inputs = json.loads(payload)["input"]
        return json.dumps(
            {"data": [{"embedding": [float(len(t) + i % 7) for i in range(width)]} for t in inputs]}
        ).encode("utf-8")

    return send, calls


def test_http_embedder_parses_openai_shape() -> None:
    transport, calls = _transport(width=5)
    client = embed_mod.HttpEmbedder("https://api.example.com/embed", transport=transport)
    vectors = client.embed_batch(["hello", "world"])
    assert len(vectors) == 2
    assert len(vectors[0]) == 5
    assert client.dimensions == 5  # advisory 1536 replaced by actual width
    assert calls[0]["payload"]["input"] == ["hello", "world"]


def test_http_embedder_sends_bearer_only_with_key() -> None:
    transport, calls = _transport()
    embed_mod.HttpEmbedder(
        "https://api.example.com/embed", api_key="secret", transport=transport
    ).embed("x")
    assert calls[0]["headers"]["authorization"] == "Bearer secret"

    transport2, calls2 = _transport()
    embed_mod.HttpEmbedder("https://api.example.com/embed", transport=transport2).embed("x")
    assert "authorization" not in calls2[0]["headers"]


def test_http_embedder_caches_repeated_texts() -> None:
    transport, calls = _transport()
    client = embed_mod.HttpEmbedder("https://api.example.com/embed", transport=transport)
    client.embed("same")
    client.embed("same")
    assert len(calls) == 1


def test_http_embedder_fails_closed_on_count_mismatch() -> None:
    transport, _ = _transport(body=json.dumps({"data": []}))
    client = embed_mod.HttpEmbedder("https://api.example.com/embed", transport=transport)
    with pytest.raises(embed_mod.EmbeddingError, match="0 vectors for 1"):
        client.embed("x")


def test_http_embedder_fails_closed_on_invalid_json() -> None:
    transport, _ = _transport(body="<html>nope</html>")
    client = embed_mod.HttpEmbedder("https://api.example.com/embed", transport=transport)
    with pytest.raises(embed_mod.EmbeddingError, match="invalid JSON"):
        client.embed("x")


def test_http_embedder_fails_closed_on_width_drift() -> None:
    widths = iter([4, 8])

    def send(url: str, payload: bytes, headers: Dict[str, str], timeout: float) -> bytes:
        width = next(widths)
        return json.dumps(
            {"data": [{"embedding": [1.0] * width}]}
        ).encode("utf-8")

    client = embed_mod.HttpEmbedder("https://api.example.com/embed", transport=send)
    client.embed("x")
    with pytest.raises(embed_mod.EmbeddingError, match="refusing to mix vector spaces"):
        client.embed("y")


def test_http_embedder_rejects_unsafe_endpoint_at_construction() -> None:
    with pytest.raises(embed_mod.EmbeddingError):
        embed_mod.HttpEmbedder("http://127.0.0.1:8080")


# ------------------------------------------------------------------- store --


def _store_with(store_mod_: Any = store_mod) -> Any:
    embedder = embed_mod.HashingEmbedder(dimensions=32)
    chunks = [
        {
            "id": "a", "title": "Schema", "text": "Use Hotel JSON-LD.",
            "source": "s", "tags": ["schema"],
        },
        {
            "id": "b", "title": "Robots", "text": "Allow AI crawlers.",
            "source": "s", "tags": ["technical"],
        },
    ]
    vectors = embedder.embed_batch([f"{c['title']}. {c['text']}" for c in chunks])
    store = store_mod.VectorStore(embedder_id=embedder.id, dimensions=32)
    store.upsert(chunks, vectors)
    return store, embedder


def test_store_search_ranks_relevant_chunk_first() -> None:
    store, embedder = _store_with()
    results = store.search_text("Hotel JSON-LD structured data", embedder, top_k=2)
    assert len(results) == 2
    assert results[0]["id"] == "a"
    assert results[0]["score"] >= results[1]["score"]


def test_store_tag_filter_and_min_score() -> None:
    store, embedder = _store_with()
    only_tech = store.search_text("AI crawlers", embedder, tags=["technical"])
    assert [r["id"] for r in only_tech] == ["b"]
    empty = store.search_text("zzz", embedder, min_score=0.999999)
    assert empty == []


def test_store_upsert_rejects_width_mismatch() -> None:
    store, _ = _store_with()
    with pytest.raises(ValueError):
        store.upsert([{"id": "z", "tags": []}], [[1.0, 2.0]])


def test_store_upsert_count_mismatch() -> None:
    store = store_mod.VectorStore()
    with pytest.raises(ValueError):
        store.upsert([{"id": "a"}], [])


def test_store_save_load_roundtrip(tmp_path: Path) -> None:
    store, embedder = _store_with()
    path = tmp_path / "store.json"
    store.save(path)
    restored = store_mod.VectorStore.load(path)
    assert restored.size == store.size
    assert restored.embedder_id == store.embedder_id
    a = restored.search_text("Hotel JSON-LD", embedder, top_k=1)
    b = store.search_text("Hotel JSON-LD", embedder, top_k=1)
    assert a[0]["id"] == b[0]["id"]


def test_store_remove_and_all() -> None:
    store, _ = _store_with()
    assert store.size == 2
    store.remove("a")
    assert store.size == 1
    assert [c["id"] for c in store.all()] == ["b"]


def test_export_rows_shape_and_pgvector_ddl_mentions_dims() -> None:
    store, _ = _store_with()
    rows = store_mod.export_rows(store)
    assert len(rows) == 2
    assert set(rows[0]) == {"id", "title", "text", "source", "url", "tags", "embedding"}
    assert "vector(%(dims)s)" in store_mod.PGVECTOR_DDL


def test_write_pgvector_needs_psycopg_with_actionable_error(tmp_path: Path) -> None:
    import importlib.util

    if importlib.util.find_spec("psycopg") is not None:
        pytest.skip("psycopg installed — export path not error-tested")
    store, _ = _store_with()
    with pytest.raises(RuntimeError, match="ml/requirements-ml.txt"):
        store_mod.write_pgvector(store, "postgresql://localhost/x")


# ------------------------------------------------------------- classifier --


def _example(page_type: str, measured: Dict[str, Any], url: str, text: str) -> Dict[str, Any]:
    return {
        "id": f"ex-{page_type}-{url}",
        "task": "page_classification",
        "source": "wdc-2024",
        "split": "train",
        "synthetic": False,
        "input": {"url": url, "text": text, "measured": measured},
        "output": {"pageType": page_type},
    }


TRAIN_ROWS = [
    _example(
        "hotel_homepage",
        {"jsonLdTypes": ["Hotel"], "h1Count": 1, "hasBookingWidget": True, "wordCount": 380},
        "https://example.com/",
        "Welcome to our luxury hotel downtown. Book a room today. "
        "Our suites overlook the river. Restaurant open daily.",
    ),
    _example(
        "hotel_homepage",
        {
            "jsonLdTypes": ["Hotel", "Organization"], "h1Count": 1,
            "hasBookingWidget": True, "wordCount": 250,
        },
        "https://example.com/hotel",
        "Luxury hotel with spa and pool. Book direct for best rates. "
        "Guests love our central location.",
    ),
    _example(
        "spa",
        {
            "jsonLdTypes": ["HealthAndBeautyBusiness"], "h1Count": 1,
            "hasBookingWidget": False, "wordCount": 300,
        },
        "https://example.com/spa",
        "Massage therapy and facial treatments. Relax in our sauna. "
        "Therapists trained in hot stone massage.",
    ),
    _example(
        "spa",
        {"jsonLdTypes": [], "h1Count": 2, "hasBookingWidget": False, "wordCount": 180},
        "https://example.com/wellness",
        "Spa services include aromatherapy and body wraps. "
        "Book a treatment with our therapists.",
    ),
    _example(
        "faq",
        {"jsonLdTypes": ["FAQPage"], "h1Count": 1, "hasBookingWidget": False, "wordCount": 500},
        "https://example.com/faq",
        "Frequently asked questions about check in and parking. "
        "Do you allow pets? What time is check in? Is parking free?",
    ),
    _example(
        "faq",
        {
            "jsonLdTypes": ["FAQPage", "Question"], "h1Count": 1,
            "hasBookingWidget": False, "wordCount": 420,
        },
        "https://example.com/help",
        "Questions about reservations and cancellations. "
        "How do I cancel? What is the refund policy? When is check out?",
    ),
]


def test_extract_features_reads_only_measured_inputs() -> None:
    example = TRAIN_ROWS[0]
    features = classifier.extract_features(example["input"])
    assert features["ld:Hotel"] == 1.0
    assert features["h1:one"] == 1.0
    assert features["widget:1"] == 1.0
    assert any(k.startswith("words:") for k in features)
    assert any(k.startswith("path:") for k in features)
    assert any(k.startswith("tok:") for k in features)
    # The label must never leak into the features.
    assert not any("pageType" in k for k in features)


def test_extract_features_handles_missing_measurements() -> None:
    features = classifier.extract_features({})
    assert features == {}


def test_train_predict_roundtrip_separates_page_types() -> None:
    pairs = [
        (classifier.extract_features(row["input"]), row["output"]["pageType"])
        for row in TRAIN_ROWS
    ]
    model = classifier.train(pairs, epochs=120)
    assert set(model["labels"]) == {"faq", "hotel_homepage", "spa"}
    assert model["trainedRows"] == len(TRAIN_ROWS)

    # Held-in sanity: the model must fit the data it was trained on — this is
    # a determinism/smoke check, not a generalisation claim.
    predictions = [classifier.predict(model, row["input"]) for row in TRAIN_ROWS]
    assert predictions == [row["output"]["pageType"] for row in TRAIN_ROWS]

    # Deterministic: same rows, same weights.
    again = classifier.train(pairs, epochs=120)
    assert again["weights"] == model["weights"]


def test_train_requires_at_least_two_labels() -> None:
    one_label = [(classifier.extract_features(r["input"]), "faq") for r in TRAIN_ROWS[:1]] * 2
    with pytest.raises(ValueError):
        classifier.train(one_label)


def test_train_rejects_empty_rows() -> None:
    with pytest.raises(ValueError):
        classifier.train([])


def test_predict_proba_is_a_probability_dict() -> None:
    pairs = [
        (classifier.extract_features(row["input"]), row["output"]["pageType"])
        for row in TRAIN_ROWS
    ]
    model = classifier.train(pairs, epochs=60)
    scores = classifier.predict_proba(model, TRAIN_ROWS[0]["input"])
    assert set(scores) == set(model["labels"])
    assert all(0.0 <= v <= 1.0 for v in scores.values())


def test_macro_f1_perfect_and_empty() -> None:
    labels = ["a", "b", "a", "b"]
    assert classifier.macro_f1(labels, labels) == 1.0
    assert classifier.macro_f1([], []) == 0.0
    with pytest.raises(ValueError):
        classifier.macro_f1(["a"], ["a", "b"])


def test_macro_f1_partial_is_between_zero_and_one() -> None:
    score = classifier.macro_f1(["a", "a", "b", "b"], ["a", "b", "b", "b"])
    assert 0.0 < score < 1.0


def test_confusion_matrix_shape_and_totals() -> None:
    matrix = classifier.confusion_matrix(["a", "b", "a"], ["a", "a", "b"])
    assert set(matrix) == {"a", "b"}
    assert matrix["a"]["a"] == 1
    assert matrix["a"]["b"] == 1
    assert matrix["b"]["a"] == 1  # truth b, predicted a
    assert matrix["b"]["b"] == 0
    assert sum(sum(row.values()) for row in matrix.values()) == 3


def test_model_save_load_roundtrip(tmp_path: Path) -> None:
    pairs = [
        (classifier.extract_features(row["input"]), row["output"]["pageType"])
        for row in TRAIN_ROWS
    ]
    model = classifier.train(pairs, epochs=40)
    path = tmp_path / "model.json"
    classifier.save_model(model, path)
    restored = classifier.load_model(path)
    assert restored["labels"] == model["labels"]
    assert classifier.predict(restored, TRAIN_ROWS[0]["input"]) == classifier.predict(
        model, TRAIN_ROWS[0]["input"]
    )


def test_load_model_rejects_unknown_version(tmp_path: Path) -> None:
    path = tmp_path / "model.json"
    path.write_text(json.dumps({"version": 99}), encoding="utf-8")
    with pytest.raises(ValueError, match="version"):
        classifier.load_model(path)


def test_cli_train_and_eval_gated(tmp_path: Path) -> None:
    rows_path = tmp_path / "rows.jsonl"
    rows_path.write_text(
        "\n".join(json.dumps(row) for row in TRAIN_ROWS) + "\n", encoding="utf-8"
    )
    model_path = tmp_path / "model.json"
    assert classifier.main(["train", "--in", str(rows_path), "--out", str(model_path)]) == 0
    assert model_path.is_file()
    assert classifier.main(["eval", "--in", str(rows_path), "--model", str(model_path)]) == 0


def test_cli_train_refuses_synthetic_rows(tmp_path: Path) -> None:
    rows = [dict(TRAIN_ROWS[0], synthetic=True), dict(TRAIN_ROWS[1], synthetic=True)]
    rows_path = tmp_path / "rows.jsonl"
    rows_path.write_text("\n".join(json.dumps(r) for r in rows) + "\n", encoding="utf-8")
    with pytest.raises(LicenceError, match="synthetic"):
        classifier.main(["train", "--in", str(rows_path), "--out", str(tmp_path / "m.json")])


def test_cli_train_refuses_non_trainable_source(tmp_path: Path) -> None:
    from ml.registry import load_registry

    registry = load_registry()
    blocked = [sid for sid in registry.ids() if not registry.get(sid).trainable]
    if not blocked:
        pytest.skip("registry has no non-trainable sources")
    rows = [dict(TRAIN_ROWS[0], source=blocked[0]), dict(TRAIN_ROWS[1], source=blocked[0])]
    rows_path = tmp_path / "rows.jsonl"
    rows_path.write_text("\n".join(json.dumps(r) for r in rows) + "\n", encoding="utf-8")
    with pytest.raises(LicenceError):
        classifier.main(["train", "--in", str(rows_path), "--out", str(tmp_path / "m.json")])
