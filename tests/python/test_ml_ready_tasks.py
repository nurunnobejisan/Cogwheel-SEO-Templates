#!/usr/bin/env python3
"""Tests for per-task adapter readiness (v2 WP3, decision D-036).

Covers:
- `effective_ready_tasks` / `assert_ready_tasks_provenance` fail-closed
  provenance rule in `ml/serve/registry.py` (hand-edited scope is refused);
- `evaluate_task_readiness` / `select_ready_tasks` ship gates + beats-both-
  baselines requirement in `ml/serve/register.py`;
- end-to-end `promote(..., ready_tasks=...)`: measured scope is written with
  provenance, a task that fails its gates or a baseline refuses the promotion;
- the CLI `--ready-task` flag (missing baselines → error, registry untouched).
"""

from __future__ import annotations

import json
import sys
from collections.abc import Mapping
from pathlib import Path
from typing import Any

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml.serve.register import (  # noqa: E402
    TASK_SHIP_GATES,
    PromotionError,
    evaluate_task_readiness,
    main,
    promote,
    select_ready_tasks,
)
from ml.serve.registry import (  # noqa: E402
    RegistryError,
    assert_ready_tasks_provenance,
    assert_servable,
    effective_ready_tasks,
    load_registry,
)
from tests.python.test_ml_register import (  # noqa: E402
    valid_manifest,
    valid_report,
    write_pair,
    write_registry,
)

GOLDEN_PATH = REPO_ROOT / "ml" / "eval" / "golden" / "cases.jsonl"

_REPORT_SHA = "c" * 64
_MEASURED_AT = "2026-11-29T00:00:00Z"


def _golden_cases_by_task() -> dict[str, list[str]]:
    by_task: dict[str, list[str]] = {}
    for line in GOLDEN_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        case = json.loads(line)
        by_task.setdefault(str(case.get("task")), []).append(str(case["id"]))
    return by_task


_GOLDEN = _golden_cases_by_task()


def _results_for_task(task: str, pass_rate: float, gates: Mapping[str, float]) -> list[dict[str, str]]:
    """Synthetic run_eval results rows: `pass_rate` of cases pass each gate."""
    rows: list[dict[str, str]] = []
    case_ids = _GOLDEN.get(task, [])
    n_pass = round(len(case_ids) * pass_rate)
    for index, case_id in enumerate(case_ids):
        for gate in gates:
            rows.append(
                {
                    "caseId": case_id,
                    "check": gate,
                    "status": "pass" if index < n_pass else "fail",
                    "detail": "synthetic",
                }
            )
    return rows


def _report_with_results(pass_rate: float = 1.0, tasks: Mapping[str, float] | None = None, **overrides: Any) -> dict[str, Any]:
    """A valid_report plus synthetic per-task results rows."""
    report = valid_report(**overrides)
    rows: list[dict[str, str]] = []
    per_task = tasks if tasks is not None else dict.fromkeys(TASK_SHIP_GATES, pass_rate)
    for task, rate in per_task.items():
        rows.extend(_results_for_task(task, rate, TASK_SHIP_GATES[task]))
    report["results"] = rows
    return report


def _provenance(**overrides: Any) -> dict[str, Any]:
    provenance = {
        "by": "ml.serve.register",
        "reportSha256": _REPORT_SHA,
        "measuredAt": _MEASURED_AT,
    }
    provenance.update(overrides)
    return provenance


# --------------------------------------------------------------------------- #
# registry.py — fail-closed provenance
# --------------------------------------------------------------------------- #


def test_empty_ready_tasks_is_always_safe() -> None:
    entry: dict[str, Any] = {"modelId": "m", "status": "ready", "readyTasks": []}
    assert effective_ready_tasks(entry) == []
    assert_ready_tasks_provenance(entry)  # no raise


def test_ready_tasks_without_provenance_are_ignored() -> None:
    entry = {"modelId": "m", "status": "ready", "readyTasks": ["schema_generation"]}
    assert effective_ready_tasks(entry) == []
    with pytest.raises(RegistryError, match="hand-edited"):
        assert_ready_tasks_provenance(entry)


def test_hand_edited_ready_tasks_make_entry_unservable() -> None:
    entry = {
        "modelId": "m",
        "status": "ready",
        "readyTasks": ["schema_generation"],
        "readyTasksProvenance": {"by": "humans", "reportSha256": _REPORT_SHA, "measuredAt": _MEASURED_AT},
    }
    with pytest.raises(RegistryError):
        assert_servable(entry)


@pytest.mark.parametrize(
    "provenance",
    [
        {"by": "ml.serve.register", "reportSha256": "nothex", "measuredAt": _MEASURED_AT},
        {"by": "ml.serve.register", "reportSha256": "a" * 63, "measuredAt": _MEASURED_AT},
        {"by": "someone-else", "reportSha256": _REPORT_SHA, "measuredAt": _MEASURED_AT},
        {"by": "ml.serve.register", "reportSha256": _REPORT_SHA},
    ],
)
def test_invalid_provenance_variants_are_refused(provenance: dict[str, Any]) -> None:
    entry = {
        "modelId": "m",
        "status": "ready",
        "readyTasks": ["schema_generation"],
        "readyTasksProvenance": provenance,
    }
    assert effective_ready_tasks(entry) == []


def test_valid_provenance_yields_measured_scope() -> None:
    entry = {
        "modelId": "m",
        "status": "ready",
        "readyTasks": ["schema_generation", "metadata_generation", "", None],
        "readyTasksProvenance": _provenance(),
    }
    assert effective_ready_tasks(entry) == ["schema_generation", "metadata_generation"]


# --------------------------------------------------------------------------- #
# register.py — ship gates + baselines
# --------------------------------------------------------------------------- #


def test_task_ready_when_gates_pass_and_beats_both_baselines() -> None:
    report = _report_with_results(tasks={"schema_generation": 1.0})
    baselines = [
        _report_with_results(tasks={"schema_generation": 0.8}),
        _report_with_results(tasks={"schema_generation": 0.7}),
    ]
    ok, detail, metrics = evaluate_task_readiness(
        report, "schema_generation", baselines, _golden_task_map()
    )
    assert ok, detail
    assert metrics["aggregate"] == 1.0
    assert metrics["baseline1Aggregate"] < 1.0
    assert metrics["baseline2Aggregate"] < 1.0


def test_gate_below_threshold_refuses_task() -> None:
    # jsonld_valid requires >= 0.95; 0.8 fails.
    report = _report_with_results(tasks={"schema_generation": 0.8})
    baselines = [
        _report_with_results(tasks={"schema_generation": 0.5}),
        _report_with_results(tasks={"schema_generation": 0.5}),
    ]
    ok, detail, _ = evaluate_task_readiness(report, "schema_generation", baselines, _golden_task_map())
    assert not ok
    # A gate below threshold is named in the refusal (invented_metrics fires
    # first here since 0.8 of 14 cases also misses its 1.00 requirement).
    assert "pass-rate" in detail and "< required" in detail


def test_missing_baselines_refuse_task() -> None:
    report = _report_with_results(tasks={"schema_generation": 1.0})
    ok, detail, _ = evaluate_task_readiness(report, "schema_generation", [], _golden_task_map())
    assert not ok
    assert "both baselines" in detail


def test_baseline_not_beaten_refuses_task() -> None:
    # The candidate clears its gates (1.0) but only ties baseline #1 — a tie
    # is not a beat (strict improvement required).
    candidate = _report_with_results(tasks={"metadata_generation": 1.0})
    equal_baseline = _report_with_results(tasks={"metadata_generation": 1.0})
    weaker_baseline = _report_with_results(tasks={"metadata_generation": 0.5})
    ok, detail, _ = evaluate_task_readiness(
        candidate, "metadata_generation", [equal_baseline, weaker_baseline], _golden_task_map()
    )
    assert not ok
    assert "does not beat baseline #1" in detail


def test_task_without_ship_gates_is_never_ready() -> None:
    report = _report_with_results(tasks={"schema_generation": 1.0})
    ok, detail, _ = evaluate_task_readiness(report, "page_classification", [], _golden_task_map())
    assert not ok
    assert "no ship gates" in detail


def test_task_missing_from_report_refuses() -> None:
    report = _report_with_results(tasks={"schema_generation": 1.0})
    baselines = [
        _report_with_results(tasks={"schema_generation": 0.5}),
        _report_with_results(tasks={"schema_generation": 0.5}),
    ]
    ok, detail, _ = evaluate_task_readiness(report, "rag_synthesis", baselines, _golden_task_map())
    assert not ok
    assert "no cases" in detail


def test_baseline_without_task_cases_refuses() -> None:
    report = _report_with_results(tasks={"schema_generation": 1.0})
    blind_baseline = valid_report()
    blind_baseline["results"] = []
    ok, detail, _ = evaluate_task_readiness(
        report, "schema_generation", [blind_baseline, _report_with_results(tasks={"schema_generation": 0.5})],
        _golden_task_map(),
    )
    assert not ok
    assert "same golden set" in detail


def test_select_ready_tasks_only_lists_passing_tasks() -> None:
    report = _report_with_results(
        tasks={"schema_generation": 1.0, "metadata_generation": 0.5, "rag_synthesis": 1.0}
    )
    baselines = [
        _report_with_results(tasks=dict.fromkeys(TASK_SHIP_GATES, 0.5)),
        _report_with_results(tasks=dict.fromkeys(TASK_SHIP_GATES, 0.4)),
    ]
    ready, checks = select_ready_tasks(report, baselines, GOLDEN_PATH)
    # metadata_generation fails its title_budget gate; entity_gap_analysis has
    # no synthetic rows here so it refuses too — only measured tasks graduate.
    assert ready == ["schema_generation", "rag_synthesis"]
    by_name = {name: ok for name, ok, _ in checks}
    assert by_name["task_ready:schema_generation"] is True
    assert by_name["task_ready:metadata_generation"] is False


def _golden_task_map() -> dict[str, str]:
    task_map: dict[str, str] = {}
    for line in GOLDEN_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        case = json.loads(line)
        task_map[str(case["id"])] = str(case.get("task") or "")
    return task_map


# --------------------------------------------------------------------------- #
# promote() end-to-end with ready_tasks
# --------------------------------------------------------------------------- #


def _promote(tmp_path: Path, report: dict[str, Any], baselines: list[dict[str, Any]], ready_tasks: list[str]):
    registry_path = write_registry(tmp_path)
    manifest_path, report_path = write_pair(tmp_path, valid_manifest(), report, name="run")
    baseline_paths = []
    for index, baseline in enumerate(baselines):
        _, baseline_path = write_pair(tmp_path, valid_manifest(), baseline, name=f"baseline{index}")
        baseline_paths.append(baseline_path)
    result = promote(
        manifest_path=manifest_path,
        report_path=report_path,
        registry_path=registry_path,
        ready_tasks=ready_tasks,
        baseline_report_paths=baseline_paths,
    )
    return result["entry"], registry_path


def test_promote_writes_measured_ready_tasks_with_provenance(tmp_path: Path) -> None:
    report = _report_with_results(tasks={"schema_generation": 1.0})
    baselines = [
        _report_with_results(tasks={"schema_generation": 0.8}),
        _report_with_results(tasks={"schema_generation": 0.7}),
    ]
    entry, registry_path = _promote(tmp_path, report, baselines, ["schema_generation"])
    assert entry["readyTasks"] == ["schema_generation"]
    provenance = entry["readyTasksProvenance"]
    assert provenance["by"] == "ml.serve.register"
    assert len(provenance["reportSha256"]) == 64
    assert provenance["measuredAt"]
    # The written entry round-trips the fail-closed registry check.
    stored = load_registry(registry_path)
    written = next(m for m in stored["models"] if m["modelId"] == entry["modelId"])
    assert_servable(written)
    assert effective_ready_tasks(written) == ["schema_generation"]


def test_promote_without_ready_tasks_leaves_scope_empty(tmp_path: Path) -> None:
    entry, _ = _promote(tmp_path, valid_report(), [], [])
    assert entry["readyTasks"] == []
    assert "readyTasksProvenance" not in entry


def test_promote_refused_when_task_loses_to_a_baseline(tmp_path: Path) -> None:
    report = _report_with_results(tasks={"schema_generation": 1.0})
    baselines = [
        _report_with_results(tasks={"schema_generation": 1.0}),
        _report_with_results(tasks={"schema_generation": 0.5}),
    ]
    with pytest.raises(PromotionError, match="does not beat baseline"):
        _promote(tmp_path, report, baselines, ["schema_generation"])


def test_promote_refused_when_requested_task_has_no_baselines(tmp_path: Path) -> None:
    report = _report_with_results(tasks={"schema_generation": 1.0})
    with pytest.raises(PromotionError, match="both baselines"):
        _promote(tmp_path, report, [], ["schema_generation"])


def test_cli_ready_task_without_baselines_exits_error(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    registry_path = write_registry(tmp_path)
    manifest_path, report_path = write_pair(tmp_path, valid_manifest(), _report_with_results(tasks={"schema_generation": 1.0}))
    exit_code = main(
        [
            "--manifest", str(manifest_path),
            "--report", str(report_path),
            "--registry", str(registry_path),
            "--ready-task", "schema_generation",
        ]
    )
    assert exit_code == 1
    assert "baseline" in capsys.readouterr().err.lower()
    # Registry untouched — nothing was written on the refused promotion.
    stored = load_registry(registry_path)
    assert all(m["modelId"] != "seo-studio-" + valid_manifest()["runId"] for m in stored["models"])


def test_golden_covers_all_gated_tasks() -> None:
    """Every ship-gated task must exist in the frozen golden set."""
    for task in TASK_SHIP_GATES:
        assert task in _GOLDEN and _GOLDEN[task], f"golden set lacks cases for {task}"
