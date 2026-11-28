"""Tests for WP8 host-split SFT dataset v2 builder (ml/train/build_sft.py)."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml.train import build_sft, sft  # noqa: E402
from ml.train.build_sft import assign_host_split, build_sft_v2, extract_registrable_host  # noqa: E402


def _make_schema_row(url: str, source: str = "wdc-2024", **extra: Any) -> Dict[str, Any]:
    row: Dict[str, Any] = {
        "task": "schema_generation",
        "source": source,
        "provenance": extra.pop("provenance", "measured"),
        "synthetic": extra.pop("synthetic", False),
        "input": {"url": url, "text": f"Property at {url}"},
        "output": {
            "@context": "https://schema.org",
            "@type": "Hotel",
            "name": f"Hotel {url}",
        },
    }
    if source in {"vault", "patches", "triples"}:
        row.setdefault("consent", True)
        row.setdefault("tenantId", "tenant-1")
        if source == "triples":
            row.setdefault("quality", "reviewed")
    row.update(extra)
    return row


def _make_meta_row(url: str, source: str = "vault", **extra: Any) -> Dict[str, Any]:
    row: Dict[str, Any] = {
        "task": "metadata_generation",
        "source": source,
        "provenance": extra.pop("provenance", "measured"),
        "synthetic": extra.pop("synthetic", False),
        "consent": True,
        "tenantId": "tenant-1",
        "input": {"url": url, "text": f"Rooms and dining at {url}"},
        "output": {
            "title": f"Suites at {extract_registrable_host(url)}",
            "metaDescription": "Book waterfront rooms direct with complimentary Wi-Fi.",
        },
    }
    if source == "triples":
        row.setdefault("quality", "reviewed")
    row.update(extra)
    return row


def test_registrable_host_normalization_collapses_subdomains() -> None:
    assert extract_registrable_host("https://www.HotelAlpha.com:8443/rooms") == "hotelalpha.com"
    assert extract_registrable_host("https://booking.hotelalpha.com/book") == "hotelalpha.com"
    assert extract_registrable_host("https://spa.resort.co.uk/treatments") == "resort.co.uk"
    assert assign_host_split("hotelalpha.com")[0] == assign_host_split("hotelalpha.com")[0]


def test_build_sft_v2_filters_sources_synthetic_jsonld_and_isolates_hosts() -> None:
    # Find one host guaranteed to land in eval and another in train for coverage.
    eval_host = ""
    train_host = ""
    for i in range(500):
        candidate = f"hotel-fixture-{i}.com"
        split, _ = assign_host_split(candidate)
        if split == "eval" and not eval_host:
            eval_host = candidate
        elif split == "train" and not train_host:
            train_host = candidate
        if eval_host and train_host:
            break
    assert eval_host and train_host

    rows: List[Dict[str, Any]] = [
        # Valid schema rows across subdomains of same host
        _make_schema_row(f"https://www.{train_host}/home", source="wdc-2024"),
        _make_schema_row(f"https://rooms.{train_host}/suites", source="wdc-tables-2023"),
        _make_schema_row(f"https://{eval_host}/dining", source="triples"),
        # Valid metadata rows
        _make_meta_row(f"https://{train_host}/meta", source="vault"),
        _make_meta_row(f"https://{eval_host}/meta", source="patches"),
        # Must be refused: disallowed metadata sources (Common Crawl / Lighthouse / WDC)
        _make_meta_row(f"https://{train_host}/cc", source="commoncrawl"),
        _make_meta_row(f"https://{train_host}/lh", source="lighthouse-labels"),
        _make_meta_row(f"https://{train_host}/wdc", source="wdc-2024"),
        # Must be refused: unsupported non-v1 task
        {
            "task": "rag_synthesis",
            "source": "google-search-central",
            "provenance": "measured",
            "synthetic": False,
            "input": {"url": f"https://{train_host}/rag"},
            "output": {"explanation": "Cite source", "citedUrl": "https://developers.google.com/search"},
        },
        # Must be refused: synthetic without human review mark (D-026)
        _make_meta_row(f"https://{train_host}/syn-unreviewed", source="triples", synthetic=True),
        # Must be refused: repo-synthetic without human review mark (D-026)
        {
            "task": "schema_generation",
            "source": "repo-synthetic",
            "provenance": "measured",
            "synthetic": False,
            "input": {"url": f"https://{train_host}/repo-syn"},
            "output": {"@context": "https://schema.org", "@type": "Hotel", "name": "X"},
        },
        # Must be refused: invalid JSON-LD type
        {
            "task": "schema_generation",
            "source": "wdc-2024",
            "provenance": "measured",
            "synthetic": False,
            "input": {"url": f"https://{train_host}/bad-ld"},
            "output": {"@context": "https://schema.org", "@type": "FakeSchemaOrgType"},
        },
        # Must be refused: frozen golden-set hosts
        _make_schema_row("https://thenines.com/rooms", source="wdc-2024"),
        _make_meta_row("https://www.example-hotel.com/rooms", source="vault"),
        # Must be refused: HTML fails ml-label-cli mock check
        _make_schema_row(
            f"https://{train_host}/bad-html",
            source="wdc-2024",
            html="<html><body>broken</body></html>",
        ),
        # Accepted: valid HTML passes ml-label-cli mock check
        _make_schema_row(
            f"https://{train_host}/good-html",
            source="wdc-2024",
            html="<html><body>valid</body></html>",
        ),
    ]

    def fake_html_validator(html: str, _url: str):
        if "broken" in html:
            return False, "bad_markup"
        return True, "ok"

    kept, report = build_sft_v2(rows, html_validator=fake_html_validator)

    assert len(kept) == 6
    assert report["hostOverlapCount"] == 0
    assert report["goldenHostOverlapCount"] == 0
    assert report["byJob"]["schema_generation"]["total"] == 4
    assert report["byJob"]["metadata_generation"]["total"] == 2
    assert report["refusedByReason"]["disallowed_source_for_job"] >= 4
    assert report["refusedByReason"]["unsupported_task"] == 1
    assert report["refusedByReason"]["synthetic_unreviewed"] == 1
    assert report["refusedByReason"]["invalid_jsonld"] == 1
    assert report["refusedByReason"]["golden_host"] == 2
    assert report["refusedByReason"]["label_cli_failed:bad_markup"] == 1

    # Verify both train and eval hosts never mix.
    train_hashes = {r["meta"]["hostHash"] for r in kept if r["meta"]["split"] == "train"}
    eval_hashes = {r["meta"]["hostHash"] for r in kept if r["meta"]["split"] == "eval"}
    assert not (train_hashes & eval_hashes)


def test_build_sft_v2_cli_and_default_sft_loader(tmp_path: Path) -> None:
    assert sft.DEFAULT_DATA == Path("data/build/sft-v2.jsonl")

    in_path = tmp_path / "inputs.jsonl"
    out_path = tmp_path / "data" / "build" / "sft-v2.jsonl"
    report_path = tmp_path / "data" / "build" / "sft-v2.report.json"

    fixtures = [
        _make_schema_row("https://grand-resort-cli.com/", source="wdc-2024"),
        _make_meta_row("https://grand-resort-cli.com/rooms", source="vault"),
    ]
    in_path.write_text("\n".join(json.dumps(r) for r in fixtures) + "\n", encoding="utf-8")

    rc = build_sft.main(
        ["--in", str(in_path), "--out", str(out_path), "--report", str(report_path), "--no-verify-html"]
    )
    assert rc == 0
    assert out_path.is_file()
    assert report_path.is_file()

    # Loadable directly by ml/train/sft.py
    loaded = sft.load_dataset(out_path)
    assert len(loaded) == 2

    report = json.loads(report_path.read_text(encoding="utf-8"))
    assert report["kept"] == 2
    assert report["hostOverlapCount"] == 0

    # Also accepted cleanly by scripts/validate-training-data.mjs
    proc = subprocess.run(
        ["node", str(REPO_ROOT / "scripts" / "validate-training-data.mjs"), str(out_path)],
        capture_output=True,
        text=True,
        timeout=20,
        check=False,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr
