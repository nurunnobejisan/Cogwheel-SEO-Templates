#!/usr/bin/env python3
"""Tests for the Phase 5 promotion CLI (ml/serve/register.py).

`ready` is earned: every gate in the chain is exercised as a pass and as a
failure, the registry write is verified (atomic, backed up, legacy entries
untouched), idempotent re-promotion works, and a different manifest under
the same modelId is refused without --force.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Dict

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml.serve import register as register_module  # noqa: E402
from ml.serve.register import (  # noqa: E402
    DEFAULT_GOLDEN,
    PromotionError,
    main,
    promote,
    verify_promotion,
)
from ml.serve.registry import load_registry, resolve_model  # noqa: E402

GOLDEN_SHA = "3d9514129d6a694fed90fa9a52039806bfa687e6b51c757998b4e05bcd6a3a84"
RUN_ID = "sft-20261127T000000Z"
ADAPTER = "data/out/sft-20261127T000000Z/adapter"


def valid_manifest(**overrides: Any) -> Dict[str, Any]:
    manifest: Dict[str, Any] = {
        "kind": "sft",
        "runId": RUN_ID,
        "mode": "train",
        "trainingStarted": True,
        "gitSha": "a" * 40,
        "data": {"path": "data/sft-dataset.jsonl", "sha256": "b" * 64, "rows": 2000},
        "golden": {"path": str(DEFAULT_GOLDEN), "sha256": GOLDEN_SHA},
        "baseModel": {"id": "Qwen/Qwen3-4B", "licence": "Apache-2.0"},
        "artifacts": {"adapter": ADAPTER, "weightsCommitted": False},
    }
    manifest.update(overrides)
    return manifest


def valid_report(**overrides: Any) -> Dict[str, Any]:
    report: Dict[str, Any] = {
        "golden": str(DEFAULT_GOLDEN),
        "goldenSha256": GOLDEN_SHA,
        "cases": 52,
        "outputsProvided": 52,
        "outputsMeta": {
            "templateVersion": [1],
            "baseModel": ["Qwen/Qwen3-4B"],
            "adapter": [ADAPTER],
        },
        "failures": [],
        "summary": {"pass": 100, "skip": 6},
    }
    report.update(overrides)
    return report


def write_pair(
    tmp_path: Path,
    manifest: Dict[str, Any],
    report: Dict[str, Any],
    name: str = "run",
):
    manifest_path = tmp_path / f"{name}.manifest.json"
    report_path = tmp_path / f"{name}.report.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    report_path.write_text(json.dumps(report), encoding="utf-8")
    return manifest_path, report_path


def write_registry(tmp_path: Path) -> Path:
    registry_path = tmp_path / "model_registry.json"
    registry_path.write_text(
        json.dumps(
            {
                "activeModelId": "legacy-id",
                "models": [
                    {"modelId": "legacy-id", "status": "unverified", "provider": "tuned_gemini"}
                ],
            },
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )
    return registry_path


def gate_names(checks) -> set:  # noqa: ANN001
    return {name for name, ok, _ in checks if not ok}


# --------------------------------------------------------------------------- #
# Gate chain
# --------------------------------------------------------------------------- #

def test_all_gates_pass_on_a_verified_run():
    checks = verify_promotion(valid_manifest(), valid_report())
    assert gate_names(checks) == set()
    assert {name for name, _, _ in checks} == {
        "manifest_shape",
        "real_run",
        "base_model",
        "golden_frozen",
        "data_recorded",
        "adapter_recorded",
        "git_sha",
        "report_present",
        "report_coverage",
        "report_failures",
        "report_meta",
    }


def test_dry_run_manifest_cannot_promote():
    manifest = valid_manifest(mode="dry-run", trainingStarted=False)
    assert "real_run" in gate_names(verify_promotion(manifest, valid_report()))


def test_unlisted_base_model_or_wrong_licence_fails():
    unlisted = valid_manifest(baseModel={"id": "evil/model", "licence": "Apache-2.0"})
    assert "base_model" in gate_names(verify_promotion(unlisted, valid_report()))
    wrong_licence = valid_manifest(baseModel={"id": "Qwen/Qwen3-4B", "licence": "MIT"})
    assert "base_model" in gate_names(verify_promotion(wrong_licence, valid_report()))


def test_golden_sha_mismatch_fails_any_link():
    assert "golden_frozen" in gate_names(
        verify_promotion(valid_manifest(golden={"path": "x", "sha256": "c" * 64}), valid_report())
    )
    assert "golden_frozen" in gate_names(
        verify_promotion(valid_manifest(), valid_report(goldenSha256="d" * 64))
    )
    # the report must also agree with the *current* frozen file
    assert "golden_frozen" in gate_names(
        verify_promotion(valid_manifest(), valid_report(goldenSha256=GOLDEN_SHA[:-1] + "0"))
    )


def test_missing_data_or_adapter_or_gitsha_fails():
    no_data = valid_manifest(data={"path": "x", "sha256": None, "rows": 0})
    assert "data_recorded" in gate_names(verify_promotion(no_data, valid_report()))
    no_adapter = valid_manifest(artifacts={"adapter": None, "weightsCommitted": True})
    assert "adapter_recorded" in gate_names(verify_promotion(no_adapter, valid_report()))
    committed = valid_manifest(artifacts={"adapter": ADAPTER, "weightsCommitted": True})
    assert "adapter_recorded" in gate_names(verify_promotion(committed, valid_report()))
    assert "git_sha" in gate_names(verify_promotion(valid_manifest(gitSha=""), valid_report()))


def test_incomplete_or_failing_report_cannot_promote():
    assert "report_coverage" in gate_names(
        verify_promotion(valid_manifest(), valid_report(outputsProvided=40))
    )
    assert "report_failures" in gate_names(
        verify_promotion(
            valid_manifest(),
            valid_report(failures=[{"caseId": "x", "check": "grounding", "detail": "no"}]),
        )
    )
    assert "report_present" in gate_names(verify_promotion(valid_manifest(), {}))


def test_allow_failures_threshold_is_honoured():
    failing = valid_report(
        failures=[{"caseId": "x", "check": "grounding", "detail": "no"}]
    )
    assert "report_failures" in gate_names(
        verify_promotion(valid_manifest(), failing, allow_failures=0)
    )
    assert "report_failures" not in gate_names(
        verify_promotion(valid_manifest(), failing, allow_failures=1)
    )


def test_outputs_meta_mismatch_fails():
    assert "report_meta" in gate_names(
        verify_promotion(valid_manifest(), valid_report(outputsMeta={"adapter": ["elsewhere"]}))
    )
    assert "report_meta" in gate_names(
        verify_promotion(valid_manifest(), valid_report(outputsMeta={"baseModel": ["other/base"]}))
    )
    # endpoint-generated outputs carry no adapter/baseModel — nothing to mismatch
    assert "report_meta" not in gate_names(
        verify_promotion(valid_manifest(), valid_report(outputsMeta={"endpoint": ["https://x/v1"]}))
    )


# --------------------------------------------------------------------------- #
# Registry write
# --------------------------------------------------------------------------- #

def test_promote_writes_ready_entry_atomically(tmp_path: Path):
    registry_path = write_registry(tmp_path)
    manifest_path, report_path = write_pair(tmp_path, valid_manifest(), valid_report())

    result = promote(
        manifest_path=manifest_path,
        report_path=report_path,
        registry_path=registry_path,
    )
    assert result["dryRun"] is False

    registry = load_registry(registry_path)
    entry = resolve_model(registry, f"seo-studio-{RUN_ID}")
    assert entry is not None
    assert entry["status"] == "ready"
    assert entry["provider"] == "sft_lora"
    assert entry["baseModel"] == "Qwen/Qwen3-4B"
    assert entry["provenance"]["runId"] == RUN_ID
    assert entry["provenance"]["goldenSha256"] == GOLDEN_SHA
    assert entry["provenance"]["manifestSha256"]
    # legacy entries untouched
    assert resolve_model(registry, "legacy-id")["status"] == "unverified"
    # backup of the previous file exists
    assert registry_path.with_name(registry_path.name + ".bak").is_file()
    # no tmp left behind
    assert not registry_path.with_name(registry_path.name + ".tmp").exists()


def test_dry_run_writes_nothing(tmp_path: Path):
    registry_path = write_registry(tmp_path)
    before = registry_path.read_text(encoding="utf-8")
    manifest_path, report_path = write_pair(tmp_path, valid_manifest(), valid_report())

    result = promote(
        manifest_path=manifest_path,
        report_path=report_path,
        registry_path=registry_path,
        dry_run=True,
    )
    assert result["dryRun"] is True
    assert registry_path.read_text(encoding="utf-8") == before
    assert result["entry"]["status"] == "ready"


def test_failed_gate_refuses_to_write(tmp_path: Path):
    registry_path = write_registry(tmp_path)
    before = registry_path.read_text(encoding="utf-8")
    manifest_path, report_path = write_pair(
        tmp_path, valid_manifest(mode="dry-run", trainingStarted=False), valid_report()
    )
    with pytest.raises(PromotionError, match="real_run"):
        promote(manifest_path=manifest_path, report_path=report_path, registry_path=registry_path)
    assert registry_path.read_text(encoding="utf-8") == before


def test_repromotion_is_idempotent_and_conflicting_is_refused(tmp_path: Path):
    registry_path = write_registry(tmp_path)
    manifest_path, report_path = write_pair(tmp_path, valid_manifest(), valid_report())
    first = promote(
        manifest_path=manifest_path, report_path=report_path, registry_path=registry_path
    )
    created = first["entry"]["createdAt"]

    # same manifest again: idempotent, createdAt preserved
    second = promote(
        manifest_path=manifest_path, report_path=report_path, registry_path=registry_path
    )
    assert second["entry"]["createdAt"] == created
    registry = load_registry(registry_path)
    assert len(registry["models"]) == 2  # legacy + one promoted entry

    # a different manifest claiming the same modelId: refused, then --force
    other = write_pair(tmp_path, valid_manifest(gitSha="f" * 40), valid_report())
    with pytest.raises(PromotionError, match="--force"):
        promote(manifest_path=other[0], report_path=other[1], registry_path=registry_path)
    forced = promote(
        manifest_path=other[0], report_path=other[1], registry_path=registry_path, force=True
    )
    assert forced["entry"]["provenance"]["gitSha"] == "f" * 40


def test_set_active_updates_active_model_id(tmp_path: Path):
    registry_path = write_registry(tmp_path)
    manifest_path, report_path = write_pair(tmp_path, valid_manifest(), valid_report())
    promote(
        manifest_path=manifest_path,
        report_path=report_path,
        registry_path=registry_path,
        set_active=True,
    )
    registry = load_registry(registry_path)
    assert registry["activeModelId"] == f"seo-studio-{RUN_ID}"


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def test_cli_exit_codes(tmp_path: Path, capsys: pytest.CaptureFixture[str]):
    registry_path = write_registry(tmp_path)
    good_manifest, good_report = write_pair(tmp_path, valid_manifest(), valid_report())
    ok = main(
        [
            "--manifest", str(good_manifest),
            "--report", str(good_report),
            "--registry", str(registry_path),
        ]
    )
    assert ok == 0
    out = capsys.readouterr().out
    assert "PASS  golden_frozen" in out
    assert f"promoted 'seo-studio-{RUN_ID}' -> ready" in out

    bad_manifest, bad_report = write_pair(
        tmp_path,
        valid_manifest(mode="dry-run", trainingStarted=False),
        valid_report(),
        name="bad",
    )
    assert (
        main(
            [
                "--manifest", str(bad_manifest),
                "--report", str(bad_report),
                "--registry", str(registry_path),
            ]
        )
        == 1
    )
    assert "real_run" in capsys.readouterr().err

    assert (
        main(
            [
                "--manifest", str(tmp_path / "missing.json"),
                "--report", str(bad_report),
                "--registry", str(registry_path),
            ]
        )
        == 1
    )
    # broken registry shape is a usage-level error
    broken_registry = tmp_path / "broken.json"
    broken_registry.write_text('{"models": 3}', encoding="utf-8")
    assert (
        main(
            [
                "--manifest", str(good_manifest),
                "--report", str(good_report),
                "--registry", str(broken_registry),
            ]
        )
        == 2
    )
    assert (
        main(
            [
                "--manifest", str(good_manifest),
                "--report", str(good_report),
                "--registry", str(registry_path),
                "--allow-failures", "-1",
            ]
        )
        == 2
    )


def test_module_exports():
    for name in ("verify_promotion", "build_entry", "promote", "main"):
        assert hasattr(register_module, name)
