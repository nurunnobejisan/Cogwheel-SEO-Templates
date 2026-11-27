#!/usr/bin/env python3
"""Tests for the golden-set evaluation runner (ml/eval/run_eval.py).

Each section-9 check is exercised directly, then the aggregation semantics:
skips never become passes, failures set exit code 1, and no score is ever
invented for a check whose inputs are absent.
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

from ml.eval import run_eval  # noqa: E402
from ml.retrieve import classifier  # noqa: E402

GOLDEN = REPO_ROOT / "ml" / "eval" / "golden" / "cases.jsonl"
GOLDEN_SHA256 = "3d9514129d6a694fed90fa9a52039806bfa687e6b51c757998b4e05bcd6a3a84"


# ------------------------------------------------------------- golden set --


def test_golden_set_hash_is_frozen() -> None:
    assert run_eval.sha256_file(GOLDEN) == GOLDEN_SHA256


def test_golden_cases_declare_only_known_checks() -> None:
    cases = run_eval.load_jsonl(GOLDEN)
    assert len(cases) == 52
    for case in cases:
        assert case["checks"], case["id"]
        for check in case["checks"]:
            assert check in run_eval.ALL_CHECKS, f"{case['id']}: unknown check {check}"


def test_every_case_carries_provenance_and_synthetic_flag() -> None:
    for case in run_eval.load_jsonl(GOLDEN):
        assert case["provenance"] in {"measured", "estimated", "unavailable"}
        assert isinstance(case["synthetic"], bool)


# ------------------------------------------------------------ jsonld_valid --


def test_jsonld_valid_accepts_typed_object() -> None:
    doc = {"@context": "https://schema.org", "@type": "Hotel", "name": "X"}
    status, _ = run_eval.check_jsonld_valid(doc)
    assert status == "pass"


def test_jsonld_valid_accepts_graph_wrapper() -> None:
    doc = {"@context": "https://schema.org", "@graph": [{"@type": "FAQPage"}]}
    status, _ = run_eval.check_jsonld_valid(doc)
    assert status == "pass"


def test_jsonld_valid_rejects_unknown_type() -> None:
    doc = {"@context": "https://schema.org", "@type": "Hotle"}
    status, detail = run_eval.check_jsonld_valid(doc)
    assert status == "fail"
    assert "Hotle" in detail


def test_jsonld_valid_rejects_missing_context_and_bad_json() -> None:
    status, _ = run_eval.check_jsonld_valid({"@type": "Hotel"})
    assert status == "fail"
    status, _ = run_eval.check_jsonld_valid("{not json")
    assert status == "fail"


# --------------------------------------------------------------- grounding --


def test_grounding_passes_when_values_come_from_input() -> None:
    case_input = {"text": "The Nines is downtown", "measured": {"wordCount": 42}}
    status, _ = run_eval.check_grounding("The Nines", case_input)
    assert status == "pass"


def test_grounding_fails_on_a_value_absent_from_input() -> None:
    status, detail = run_eval.check_grounding("Zanzibar Grand Hotel", {"text": "unrelated"})
    assert status == "fail"
    assert "not traceable to the input" in detail


def test_grounding_treats_urls_and_closed_labels_as_grounded() -> None:
    output = {
        "citedUrl": "https://developers.google.com/search/docs",
        "severity": "high",
        "@type": "Hotel",
    }
    status, _ = run_eval.check_grounding(output, {"text": ""})
    assert status == "pass"


def test_grounding_checks_measured_and_findings_haystacks() -> None:
    case_input = {"measured": {"wordCount": 42}, "findings": [{"issueId": "iss_thin_content"}]}
    status, _ = run_eval.check_grounding("42 and iss_thin_content", case_input)
    assert status == "pass"


# --------------------------------------------------------- invented_metrics --


def test_invented_metrics_flags_ranking_without_measured_provenance() -> None:
    case = {"provenance": "estimated"}
    status, detail = run_eval.check_invented_metrics("You rank #3 for hotels", case)
    assert status == "fail"
    assert "ranking" in detail


def test_invented_metrics_flags_traffic_and_citation_counts() -> None:
    case = {"provenance": "estimated"}
    status, _ = run_eval.check_invented_metrics("12 AI citations and 5000 monthly visits", case)
    assert status == "fail"


def test_invented_metrics_passes_when_case_is_measured() -> None:
    case = {"provenance": "measured"}
    status, _ = run_eval.check_invented_metrics("ranking #3", case)
    assert status == "pass"


def test_invented_metrics_passes_on_prose_without_numbers() -> None:
    case = {"provenance": "estimated"}
    status, _ = run_eval.check_invented_metrics("Improve the title tag length.", case)
    assert status == "pass"


# ------------------------------------------------------------ title_budget --


def test_title_budget_enforces_all_three_limits() -> None:
    status, _ = run_eval.check_title_budget(
        {"title": "x" * 60, "metaDescription": "y" * 160, "h1": "One"}
    )
    assert status == "pass"
    status, detail = run_eval.check_title_budget({"title": "x" * 61})
    assert status == "fail"
    assert "61" in detail
    status, _ = run_eval.check_title_budget({"metaDescription": "y" * 161})
    assert status == "fail"
    status, _ = run_eval.check_title_budget({"h1": ["a", "b"]})
    assert status == "fail"


def test_title_budget_skips_when_no_budget_field_present() -> None:
    status, detail = run_eval.check_title_budget({"other": "field"})
    assert status == "skipped"


# ------------------------------------------------------ explainer_citation --


def test_explainer_citation_fails_without_any_url() -> None:
    output = {"explanation": "no url"}
    status, detail = run_eval.check_explainer_citation(output, {"url": "https://x.com/"})
    assert status == "fail"
    assert "no URL cited" in detail


def test_explainer_citation_passes_on_retrieved_url() -> None:
    output = {"explanation": "See https://developers.google.com/search/docs/appearance"}
    status, _ = run_eval.check_explainer_citation(
        output,
        {"url": "https://hotel.example/"},
        ["https://developers.google.com/search/docs/appearance"],
    )
    assert status == "pass"


def test_explainer_citation_fails_when_cited_url_not_retrieved() -> None:
    output = {"explanation": "See https://spam.example/"}
    status, detail = run_eval.check_explainer_citation(
        output, {"url": "https://hotel.example/"}, ["https://developers.google.com/search/docs"]
    )
    assert status == "fail"
    assert "not in the retrieved set" in detail


def test_explainer_citation_passes_on_external_url_without_retrieved_set() -> None:
    output = {"citedUrl": "https://developers.google.com/search/docs"}
    status, _ = run_eval.check_explainer_citation(output, {"url": "https://hotel.example/"})
    assert status == "pass"


def test_explainer_citation_fails_when_only_page_url_cited() -> None:
    output = {"citedUrl": "https://hotel.example/"}
    status, detail = run_eval.check_explainer_citation(output, {"url": "https://hotel.example/"})
    assert status == "fail"
    assert "audited page" in detail


# ------------------------------------------------------------ aggregation --


def _write_jsonl(path: Path, rows: List[Dict[str, Any]]) -> Path:
    path.write_text("\n".join(json.dumps(r) for r in rows) + "\n", encoding="utf-8")
    return path


def test_run_without_outputs_skips_everything_and_passes(tmp_path: Path) -> None:
    report = run_eval.run(GOLDEN)
    assert report["goldenSha256"] == GOLDEN_SHA256
    assert report["cases"] == 52
    assert report["outputsProvided"] == 0
    assert report["summary"] == {"skipped": 106}
    assert report["failures"] == []
    assert report["classifier"] is None


def test_run_reports_failures_and_keeps_skips_separate(tmp_path: Path) -> None:
    cases = _write_jsonl(
        tmp_path / "cases.jsonl",
        [
            {
                "id": "case-good",
                "task": "metadata_generation",
                "checks": ["title_budget", "grounding"],
                "input": {"text": "The Nines"},
                "output": {"title": "ok"},
                "provenance": "measured",
                "synthetic": False,
            },
            {
                "id": "case-bad",
                "task": "metadata_generation",
                "checks": ["title_budget"],
                "input": {"text": "x"},
                "output": {"title": "z" * 80},
                "provenance": "measured",
                "synthetic": False,
            },
            {
                "id": "case-no-output",
                "task": "rag_synthesis",
                "checks": ["grounding"],
                "input": {"text": "x"},
                "output": {"pageType": "faq"},
                "provenance": "measured",
                "synthetic": False,
            },
        ],
    )
    outputs = _write_jsonl(
        tmp_path / "outputs.jsonl",
        [
            {"caseId": "case-good", "output": {"title": "The Nines", "metaDescription": "ok"}},
            {"caseId": "case-bad", "output": {"title": "z" * 80}},
        ],
    )
    report = run_eval.run(cases, outputs)
    assert report["summary"].get("fail") == 1  # case-bad title
    assert report["summary"].get("pass", 0) >= 1
    assert report["summary"].get("skipped") == 1  # case-no-output
    assert len(report["failures"]) == 1
    assert report["failures"][0]["caseId"] == "case-bad"


def test_run_with_model_scores_classifier_and_reports_macro_f1(tmp_path: Path) -> None:
    pairs = [
        (classifier.extract_features(row["input"]), row["output"]["pageType"])
        for row in _train_rows()
    ]
    model = classifier.train(pairs, epochs=60)
    model_path = tmp_path / "model.json"
    classifier.save_model(model, model_path)

    cases = _write_jsonl(
        tmp_path / "cases.jsonl",
        [
            {
                "id": f"clf-{i}",
                "task": "page_classification",
                "checks": ["classifier_macro_f1"],
                "input": row["input"],
                "output": row["output"],
                "provenance": "measured",
                "synthetic": False,
            }
            for i, row in enumerate(_train_rows())
        ],
    )
    report = run_eval.run(cases, model_path=model_path)
    assert report["classifier"] is not None
    assert report["classifier"]["rows"] == len(_train_rows())
    assert 0.0 <= report["classifier"]["macroF1"] <= 1.0
    assert report["summary"].get("scored") == len(_train_rows())
    # No model output -> no output-based failures invented.
    assert report["failures"] == []


def test_run_unknown_check_fails_loudly(tmp_path: Path) -> None:
    cases = _write_jsonl(
        tmp_path / "cases.jsonl",
        [
            {
                "id": "odd",
                "task": "x",
                "checks": ["not_a_real_check"],
                "input": {},
                "output": {},
                "provenance": "measured",
                "synthetic": False,
            }
        ],
    )
    report = run_eval.run(cases)
    assert report["summary"].get("fail") == 1
    assert "unknown check" in report["failures"][0]["detail"]


def test_main_exit_codes(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert run_eval.main(["--golden", str(GOLDEN)]) == 0
    out = capsys.readouterr().out
    assert "skipped" in out
    assert "no check failures" in out

    cases = _write_jsonl(
        tmp_path / "cases.jsonl",
        [
            {
                "id": "bad",
                "task": "metadata_generation",
                "checks": ["title_budget"],
                "input": {"text": "x"},
                "output": {"title": "z" * 70},
                "provenance": "measured",
                "synthetic": False,
            }
        ],
    )
    outputs = _write_jsonl(
        tmp_path / "outputs.jsonl", [{"caseId": "bad", "output": {"title": "z" * 70}}]
    )
    assert run_eval.main(["--golden", str(cases), "--outputs", str(outputs)]) == 1
    capsys.readouterr()  # drain


def test_main_writes_report_file(tmp_path: Path) -> None:
    out_path = tmp_path / "report.json"
    assert run_eval.main(["--golden", str(GOLDEN), "--out", str(out_path)]) == 0
    report = json.loads(out_path.read_text())
    assert report["goldenSha256"] == GOLDEN_SHA256
    assert len(report["results"]) == 106


def _train_rows() -> List[Dict[str, Any]]:
    def row(page_type: str, measured: Dict[str, Any], url: str, text: str) -> Dict[str, Any]:
        return {
            "input": {"url": url, "text": text, "measured": measured},
            "output": {"pageType": page_type},
        }

    return [
        row(
            "hotel_homepage",
            {"jsonLdTypes": ["Hotel"], "h1Count": 1, "hasBookingWidget": True, "wordCount": 380},
            "https://example.com/",
            "Welcome to our luxury hotel downtown. Book a room today. "
            "Our suites overlook the river. Restaurant open daily.",
        ),
        row(
            "spa",
            {"jsonLdTypes": [], "h1Count": 1, "hasBookingWidget": False, "wordCount": 300},
            "https://example.com/spa",
            "Massage therapy and facial treatments. Relax in our sauna. "
            "Therapists trained in hot stone massage.",
        ),
        row(
            "faq",
            {"jsonLdTypes": ["FAQPage"], "h1Count": 1, "hasBookingWidget": False, "wordCount": 500},
            "https://example.com/faq",
            "Frequently asked questions about check in and parking. "
            "Do you allow pets? What time is check in? Is parking free?",
        ),
    ]
