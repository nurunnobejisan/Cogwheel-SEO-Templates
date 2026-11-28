"""Tests for the v2 DPO pair builder (ml/train/build_dpo.py).

Covers the WP2 rules:
- the three producer sources load and pair correctly;
- a rejected review-queue row never becomes a train row;
- first-party rows without consent/tenantId are refused;
- chosen == rejected is refused (before and after PII stripping);
- golden-set content and golden hosts are refused;
- deterministic host split, PII stripping, counts report;
- dpo.py defaults to the builder output and gates per-row sources.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from ml.train.build_dpo import (  # noqa: E402
    DEFAULT_OUT,
    build_dpo_v2,
    load_decision_records,
    pair_decisions,
)
from ml.train.dpo import DEFAULT_PAIRS, load_pairs, prepare  # noqa: E402
from ml.train.errors import DatasetError  # noqa: E402

GOLDEN = REPO_ROOT / "ml" / "eval" / "golden" / "cases.jsonl"


def _write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "\n".join(json.dumps(r, sort_keys=True) for r in rows) + ("\n" if rows else ""),
        encoding="utf-8",
    )


def _review_row(overrides: dict | None = None) -> dict:
    row = {
        "id": "rq_1",
        "source": "shadow_disagreement",
        "task": "metadata_generation",
        "input": {"pageType": "hotel_homepage", "text": "Hotel Aurora, 12 rooms.", "url": "https://aurora.example/"},
        "candidateOutput": {"title": "Hotel Aurora | Book Direct"},
        "gateResults": [],
        "sourceLicence": "Own data + consent",
        "enqueuedAt": "2026-11-29T00:00:00Z",
        "reviewed": True,
        "decision": "approved",
        "action": "approve",
        "output": {"title": "Hotel Aurora | Official Site"},
        "metadata": {"consent": True, "tenantId": "tenant-1"},
    }
    row.update(overrides or {})
    return row


def _healing_row(overrides: dict | None = None) -> dict:
    row = {
        "id": "h1",
        "input": {"pageType": "hotel_homepage", "text": "Hotel Aurora.", "url": "https://aurora.example/"},
        "output": {"title": "Hotel Aurora | Official Site"},
        "decision": "approved",
        "consent": True,
        "tenantId": "tenant-1",
        "source": "patches",
    }
    row.update(overrides or {})
    return row


def test_load_decision_records_from_all_three_producers(tmp_path: Path) -> None:
    healing = tmp_path / "healing-decisions.jsonl"
    vault = tmp_path / "vault-decisions.jsonl"
    queue = tmp_path / "ml-review-queue.jsonl"
    _write_jsonl(healing, [_healing_row(), _healing_row({"id": "h2", "decision": "rejected", "output": {"title": "BAD"}})])
    _write_jsonl(vault, [_healing_row({"id": "v1", "input": {"url": "https://vault.example/", "text": "x"}, "output": {"a": 1}, "decision": "approved"})])
    _write_jsonl(queue, [_review_row(), _review_row({"id": "rq_pending", "reviewed": False}), _review_row({"id": "rq_rej", "decision": "rejected"})])

    records, skipped = load_decision_records(
        producer_files={"healing": healing, "vault": vault},
        review_queue_path=queue,
    )
    origins = sorted(origin for origin, _ in records)
    assert origins == ["healing", "healing", "review_queue", "vault"]
    # Pending and rejected review rows are skipped, never loaded.
    assert skipped["review_queue:pending_or_unreviewed"] == 1
    assert skipped["review_queue:rejected_row"] == 1


def test_rejected_review_row_never_becomes_a_pair(tmp_path: Path) -> None:
    queue = tmp_path / "ml-review-queue.jsonl"
    _write_jsonl(
        queue,
        [
            _review_row({"id": "rq_ok"}),
            _review_row({"id": "rq_bad", "decision": "rejected"}),
        ],
    )
    records, skipped = load_decision_records(producer_files={}, review_queue_path=queue)
    pairs, pair_skipped = pair_decisions(records)
    assert len(pairs) == 1
    assert pairs[0]["chosen"] == {"title": "Hotel Aurora | Official Site"}
    assert pairs[0]["rejected"] == {"title": "Hotel Aurora | Book Direct"}
    assert skipped["review_queue:rejected_row"] == 1


def test_healing_and_vault_pair_by_matching_input(tmp_path: Path) -> None:
    healing = tmp_path / "healing-decisions.jsonl"
    _write_jsonl(
        healing,
        [
            _healing_row(),
            _healing_row({"id": "h2", "decision": "rejected", "output": {"title": "Rejected Title"}}),
            _healing_row({"id": "h3", "input": {"url": "https://other.example/", "text": "solo"}, "output": {}}),
        ],
    )
    records, _ = load_decision_records(producer_files={"healing": healing, "vault": tmp_path / "nope.jsonl"}, review_queue_path=tmp_path / "q.jsonl")
    pairs, pair_skipped = pair_decisions(records)
    assert len(pairs) == 1
    assert pair_skipped["unpaired_input"] == 1
    assert pairs[0]["origin"] == "healing"


def test_build_dpo_v2_gates_and_host_split(tmp_path: Path) -> None:
    healing = tmp_path / "healing-decisions.jsonl"
    _write_jsonl(
        healing,
        [
            _healing_row({"id": "ok1"}),
            _healing_row({"id": "ok2", "decision": "rejected", "output": {"title": "Rejected"}}),
            # refused: no consent (paired approved/rejected, both consent-less)
            _healing_row({"id": "noconsent", "input": {"url": "https://nc.example/", "text": "x"}, "output": {"title": "Approved"}, "consent": None}),
            _healing_row({"id": "noconsent2", "input": {"url": "https://nc.example/", "text": "x"}, "output": {"title": "Rejected"}, "decision": "rejected", "consent": None}),
            # refused: golden host (paired so it reaches the build gate)
            _healing_row({"id": "goldenhost", "input": {"url": "https://thenines.com/", "text": "x"}, "output": {"title": "Approved"}}),
            _healing_row({"id": "goldenhost2", "input": {"url": "https://thenines.com/", "text": "x"}, "output": {"title": "Rejected"}, "decision": "rejected"}),
        ],
    )
    vault = tmp_path / "vault-decisions.jsonl"
    _write_jsonl(
        vault,
        [
            _healing_row({"id": "v_ok", "input": {"url": "https://vaulthotel.example/", "text": "v"}, "output": {"a": 1}}),
            _healing_row({"id": "v_rej", "input": {"url": "https://vaulthotel.example/", "text": "v"}, "output": {"a": 2}, "decision": "rejected"}),
        ],
    )
    queue = tmp_path / "ml-review-queue.jsonl"
    _write_jsonl(queue, [_review_row()])

    records, _ = load_decision_records(producer_files={"healing": healing, "vault": vault}, review_queue_path=queue)
    pairs, _ = pair_decisions(records)
    rows, report = build_dpo_v2(pairs, golden_path=GOLDEN)

    origins = {row["metadata"]["origin"] for row in rows}
    assert origins == {"healing", "vault", "review_queue"}
    assert report["refusedByReason"].get("missing_consent_or_tenant", 0) >= 1
    assert report["refusedByReason"].get("golden_host", 0) >= 1
    for row in rows:
        assert row["metadata"]["split"] in {"train", "eval"}
        assert row["metadata"]["consent"] is True
        assert row["metadata"]["synthetic"] is False
        assert row["metadata"]["tenantId"]


def test_chosen_equals_rejected_refused(tmp_path: Path) -> None:
    queue = tmp_path / "ml-review-queue.jsonl"
    same = {"title": "Same"}
    _write_jsonl(queue, [_review_row({"output": same})])
    # Force rejected == chosen by removing originalOutput and matching candidate.
    rows = [
        _review_row({"output": same, "candidateOutput": same, "originalOutput": same}),
    ]
    _write_jsonl(queue, rows)
    records, _ = load_decision_records(producer_files={}, review_queue_path=queue)
    pairs, _ = pair_decisions(records)
    kept, report = build_dpo_v2(pairs, golden_path=GOLDEN)
    assert kept == []
    assert report["refusedByReason"]["chosen_equals_rejected"] == 1


def test_pii_stripped_and_report_counts(tmp_path: Path) -> None:
    queue = tmp_path / "ml-review-queue.jsonl"
    row = _review_row(
        {
            "id": "rq_pii",
            "input": {"url": "https://piihotel.example/", "text": "Call +1 503 555 0123 or mail stay@piihotel.example"},
            "output": "Hotel Aurora — beachfront rooms, book direct.",
            "candidateOutput": "Call +1 503 555 0123 now!",
        }
    )
    _write_jsonl(queue, [row])
    records, _ = load_decision_records(producer_files={}, review_queue_path=queue)
    pairs, _ = pair_decisions(records)
    kept, report = build_dpo_v2(pairs, golden_path=GOLDEN)
    assert len(kept) == 1
    assert "+1 503 555 0123" not in kept[0]["prompt"]
    assert "+1 503 555 0123" not in kept[0]["rejected"]
    assert report["piiStripped"] >= 1


def test_dpo_defaults_to_builder_output_and_per_row_sources(tmp_path: Path) -> None:
    assert DEFAULT_PAIRS == REPO_ROOT / "data" / "build" / "dpo-v2.jsonl"
    assert DEFAULT_OUT == DEFAULT_PAIRS

    pairs_file = tmp_path / "dpo-v2.jsonl"
    _write_jsonl(
        pairs_file,
        [
            {
                "prompt": "input for tenant a",
                "chosen": "good title",
                "rejected": "bad title",
                "metadata": {"source": "triples", "consent": True, "tenantId": "t1"},
            },
            {
                "prompt": "input for tenant b without consent",
                "chosen": "chosen",
                "rejected": "rejected",
                "metadata": {"source": "vault"},
            },
        ],
    )
    pairs = load_pairs(pairs_file)
    cleaned, manifest = prepare(pairs, source="triples", golden_path=GOLDEN)
    assert len(cleaned) == 1
    assert manifest["clientDerivedPairs"] == 1
    assert manifest["refused"] == 1


def test_missing_producer_files_report_zero(tmp_path: Path) -> None:
    records, skipped = load_decision_records(
        producer_files={"healing": tmp_path / "none.jsonl", "vault": tmp_path / "none2.jsonl"},
        review_queue_path=tmp_path / "none3.jsonl",
    )
    assert records == []
    assert dict(skipped) == {}


def test_load_pairs_refuses_missing_file(tmp_path: Path) -> None:
    with pytest.raises(DatasetError):
        load_pairs(tmp_path / "missing.jsonl")
