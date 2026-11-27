#!/usr/bin/env python3
"""Tests for the training layer (ml/train/).

Config validation and the base-model allow-list, licence-gated dataset and
pair assembly, dry-run manifests, lazy heavy-dependency errors, and the
golden-set request builder. The GPU paths are exercised only up to their
lazy-import boundary — CI has no torch (D-014).
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml.registry import LicenceError  # noqa: E402
from ml.train import config as train_config  # noqa: E402
from ml.train import dataset as sft_dataset  # noqa: E402
from ml.train import dpo as dpo_module  # noqa: E402
from ml.train import evaluate as evaluate_module  # noqa: E402
from ml.train import sft as sft_module  # noqa: E402
from ml.train.errors import (  # noqa: E402
    ConfigError,
    DatasetError,
    HeavyDepsError,
)

FROZEN_GOLDEN_SHA = "3d9514129d6a694fed90fa9a52039806bfa687e6b51c757998b4e05bcd6a3a84"
GOLDEN = REPO_ROOT / "ml" / "eval" / "golden" / "cases.jsonl"
UNIFIED_TRAIN = REPO_ROOT / "data" / "training" / "unified_seo_train.jsonl"
UNIFIED_EVAL = REPO_ROOT / "data" / "training" / "unified_seo_eval.jsonl"


def _chat_row(
    user: str = "How do I fix a missing title tag?",
    assistant: str = "Add a unique title under 60 characters.",
    metadata: Dict[str, Any] | None = None,
    *,
    use_meta_key: bool = False,
) -> Dict[str, Any]:
    row: Dict[str, Any] = {
        "messages": [
            {"role": "system", "content": "You are SEO Studio's fix assistant."},
            {"role": "user", "content": user},
            {"role": "assistant", "content": assistant},
        ]
    }
    meta = {"provenance": "estimated", **(metadata or {})}
    row["meta" if use_meta_key else "metadata"] = meta
    return row


def _write_jsonl(path: Path, rows: List[Dict[str, Any]]) -> Path:
    path.write_text(
        "\n".join(json.dumps(row, ensure_ascii=False) for row in rows) + "\n",
        encoding="utf-8",
    )
    return path


def _has_torch() -> bool:
    import importlib.util

    return importlib.util.find_spec("torch") is not None


# ------------------------------------------------------------------ config --


def test_default_sft_config_validates() -> None:
    train_config.SftConfig().validate()


def test_sft_config_rejects_bad_values() -> None:
    cases = [
        {"lora_r": 0},
        {"lora_alpha": 0},
        {"lora_dropout": 1.5},
        {"target_modules": []},
        {"epochs": 0},
        {"learning_rate": 0},
        {"warmup_ratio": 1.0},
        {"batch_size": 0},
        {"gradient_accumulation": 0},
        {"max_seq_len": 8},
        {"trust_remote_code": True},
        {"out_dir": ""},
    ]
    for override in cases:
        with pytest.raises(ConfigError):
            train_config.SftConfig(**override).validate()


def test_sft_config_rejects_unknown_fields() -> None:
    with pytest.raises(ConfigError, match="unknown SftConfig field"):
        train_config.SftConfig.from_dict({"base_model": "Qwen/Qwen3-4B", "nope": 1})


def test_base_model_allow_list() -> None:
    entry = train_config.resolve_base_model("Qwen/Qwen3-4B")
    assert entry["licence"] == "Apache-2.0"
    # glob family
    assert train_config.resolve_base_model("Qwen/Qwen3.5-2B")["family"] == "qwen3.5"
    # local checkout of an allow-listed model resolves on its final segment
    assert train_config.resolve_base_model("./models/Qwen3-4B")["licence"] == "Apache-2.0"


def test_base_model_unknown_is_refused_with_instructions() -> None:
    with pytest.raises(ConfigError, match="model card licence"):
        train_config.resolve_base_model("definitely/not-a-model")
    with pytest.raises(ConfigError):
        train_config.resolve_base_model("")


def test_sft_config_roundtrip_and_licence_in_dict(tmp_path: Path) -> None:
    config = train_config.SftConfig(lora_r=8, epochs=2.0)
    payload = config.to_dict()
    assert payload["baseModelLicence"] == "Apache-2.0"
    path = tmp_path / "sft.json"
    config.save(path)
    restored = train_config.SftConfig.load(path)
    assert restored.lora_r == 8
    assert restored.epochs == 2.0


def test_sft_config_load_rejects_garbage(tmp_path: Path) -> None:
    path = tmp_path / "bad.json"
    path.write_text("{not json", encoding="utf-8")
    with pytest.raises(ConfigError):
        train_config.SftConfig.load(path)


def test_dpo_config_validation_and_roundtrip(tmp_path: Path) -> None:
    train_config.DpoConfig().validate()
    with pytest.raises(ConfigError):
        train_config.DpoConfig(beta=0).validate()
    with pytest.raises(ConfigError):
        train_config.DpoConfig(max_prompt_len=2048, max_len=1024).validate()
    config = train_config.DpoConfig(beta=0.2)
    path = tmp_path / "dpo.json"
    config.save(path)
    assert train_config.DpoConfig.load(path).beta == 0.2


def test_min_reviewed_pairs_parity_with_typescript() -> None:
    """Python's gate constant must never drift from the TS exporter's."""
    ts_source = (REPO_ROOT / "src" / "core" / "training" / "dataset.ts").read_text(
        encoding="utf-8"
    )
    match = re.search(r"MIN_REVIEWED_PAIRS_FOR_TRAINING\s*=\s*(\d+)", ts_source)
    assert match, "TS constant not found"
    assert int(match.group(1)) == train_config.MIN_REVIEWED_PAIRS_FOR_TRAINING


# ------------------------------------------------------- dataset (SFT) -----


def test_source_spec_parsing() -> None:
    spec = sft_dataset.SourceSpec.parse("data/x.jsonl=triples")
    assert spec.source == "triples" and spec.split == "train"
    spec = sft_dataset.SourceSpec.parse("data/x.jsonl=triples=eval")
    assert spec.split == "eval"
    with pytest.raises(DatasetError):
        sft_dataset.SourceSpec.parse("no-equals-sign")
    with pytest.raises(DatasetError):
        sft_dataset.SourceSpec.parse("a=b=c=d")


def test_load_chat_rows_rejects_bad_shapes(tmp_path: Path) -> None:
    with pytest.raises(DatasetError, match="not found"):
        sft_dataset.load_chat_rows(tmp_path / "missing.jsonl")

    bad_json = tmp_path / "bad.jsonl"
    bad_json.write_text("not-json\n", encoding="utf-8")
    with pytest.raises(DatasetError, match="invalid JSON"):
        sft_dataset.load_chat_rows(bad_json)

    one_message = {"messages": [{"role": "system", "content": "x"}]}
    wrong_count = _write_jsonl(tmp_path / "count.jsonl", [one_message])
    with pytest.raises(DatasetError, match="exactly 3 messages"):
        sft_dataset.load_chat_rows(wrong_count)

    row = _chat_row()
    row["messages"][1]["role"] = "developer"
    wrong_roles = _write_jsonl(tmp_path / "roles.jsonl", [row])
    with pytest.raises(DatasetError, match="roles must be"):
        sft_dataset.load_chat_rows(wrong_roles)

    row = _chat_row()
    row["messages"][2]["content"] = "   "
    empty = _write_jsonl(tmp_path / "empty.jsonl", [row])
    with pytest.raises(DatasetError, match="empty content"):
        sft_dataset.load_chat_rows(empty)


def test_assemble_real_unified_train_file() -> None:
    """Integration: the committed training file passes every gate."""
    spec = sft_dataset.SourceSpec(path=UNIFIED_TRAIN, source="repo-synthetic")
    rows, manifest = sft_dataset.assemble([spec])
    assert manifest["read"] == 234
    assert manifest["exported"] == len(rows)
    assert manifest["exported"] >= 230, manifest["refusals"]
    assert manifest["goldenSha256"] == FROZEN_GOLDEN_SHA
    assert manifest["gate"]["status"] == "blocked"  # no client-derived rows yet
    assert manifest["sources"][0]["source"] == "repo-synthetic"


def test_assemble_refuses_synthetic_rows(tmp_path: Path) -> None:
    path = _write_jsonl(
        tmp_path / "rows.jsonl",
        [
            _chat_row(metadata={"synthetic": True}),
            _chat_row(user="a different prompt entirely"),
        ],
    )
    rows, manifest = sft_dataset.assemble(
        [sft_dataset.SourceSpec(path=path, source="repo-synthetic")]
    )
    assert len(rows) == 1
    assert manifest["skippedLicence"] == 1
    assert "synthetic" in manifest["refusals"][0]["reason"]


def test_assemble_refuses_bad_provenance(tmp_path: Path) -> None:
    path = _write_jsonl(
        tmp_path / "rows.jsonl",
        [_chat_row(metadata={"provenance": "made-up"})],
    )
    rows, manifest = sft_dataset.assemble(
        [sft_dataset.SourceSpec(path=path, source="repo-synthetic")]
    )
    assert rows == []
    assert manifest["skippedLicence"] == 1


def test_assemble_first_party_rules(tmp_path: Path) -> None:
    # consent missing
    no_consent = _write_jsonl(
        tmp_path / "no_consent.jsonl",
        [_chat_row(metadata={"tenantId": "t-1", "quality": "reviewed"})],
    )
    rows, manifest = sft_dataset.assemble(
        [sft_dataset.SourceSpec(path=no_consent, source="triples")]
    )
    assert rows == [] and "consent" in manifest["refusals"][0]["reason"]

    # tenantId missing
    no_tenant = _write_jsonl(
        tmp_path / "no_tenant.jsonl",
        [_chat_row(metadata={"consent": True, "quality": "reviewed"})],
    )
    rows, manifest = sft_dataset.assemble(
        [sft_dataset.SourceSpec(path=no_tenant, source="triples")]
    )
    assert rows == [] and "tenantId" in manifest["refusals"][0]["reason"]

    # triples must be reviewed/gold
    raw_quality = _write_jsonl(
        tmp_path / "raw.jsonl",
        [_chat_row(metadata={"consent": True, "tenantId": "t-1", "quality": "raw"})],
    )
    rows, manifest = sft_dataset.assemble(
        [sft_dataset.SourceSpec(path=raw_quality, source="triples")]
    )
    assert rows == [] and "reviewed or gold" in manifest["refusals"][0]["reason"]

    # a compliant triples row passes
    good = _write_jsonl(
        tmp_path / "good.jsonl",
        [
            _chat_row(
                metadata={
                    "consent": True,
                    "tenantId": "t-1",
                    "quality": "reviewed",
                    "provenance": "measured",
                }
            )
        ],
    )
    rows, manifest = sft_dataset.assemble(
        [sft_dataset.SourceSpec(path=good, source="triples")]
    )
    assert len(rows) == 1
    assert manifest["clientDerivedRows"] == 1


def test_assemble_refuses_golden_leakage(tmp_path: Path) -> None:
    golden_case = json.loads(GOLDEN.read_text(encoding="utf-8").splitlines()[0])
    leaked_text = golden_case["input"].get("text") or json.dumps(golden_case["input"])
    path = _write_jsonl(
        tmp_path / "leak.jsonl",
        [_chat_row(user=leaked_text), _chat_row(user="an ordinary unrelated prompt")],
    )
    rows, manifest = sft_dataset.assemble(
        [sft_dataset.SourceSpec(path=path, source="repo-synthetic")]
    )
    assert len(rows) == 1
    assert manifest["skippedGolden"] == 1
    assert "golden" in manifest["refusals"][0]["reason"]


def test_assemble_refuses_eval_split_source(tmp_path: Path) -> None:
    path = _write_jsonl(tmp_path / "eval.jsonl", [_chat_row()])
    with pytest.raises(DatasetError, match="never trains"):
        sft_dataset.assemble(
            [sft_dataset.SourceSpec(path=path, source="repo-synthetic", split="eval")],
            split="train",
        )


def test_assemble_strips_pii(tmp_path: Path) -> None:
    path = _write_jsonl(
        tmp_path / "pii.jsonl",
        [_chat_row(user="Call me at (503) 555 0123 or a@b.com")],
    )
    rows, manifest = sft_dataset.assemble(
        [sft_dataset.SourceSpec(path=path, source="repo-synthetic")]
    )
    assert manifest["piiStripped"] == 1
    content = rows[0]["messages"][1]["content"]
    assert "(503) 555 0123" not in content
    assert "a@b.com" not in content


def test_assemble_deduplicates_identical_rows(tmp_path: Path) -> None:
    path = _write_jsonl(
        tmp_path / "dup.jsonl",
        [_chat_row(), _chat_row()],
    )
    rows, manifest = sft_dataset.assemble(
        [sft_dataset.SourceSpec(path=path, source="repo-synthetic")]
    )
    assert len(rows) == 1
    assert manifest["skippedDuplicate"] == 1


def test_assemble_unknown_source_raises(tmp_path: Path) -> None:
    path = _write_jsonl(tmp_path / "rows.jsonl", [_chat_row()])
    with pytest.raises(LicenceError):
        sft_dataset.assemble(
            [sft_dataset.SourceSpec(path=path, source="not-in-the-registry")]
        )


def test_assemble_avoid_source_raises(tmp_path: Path) -> None:
    path = _write_jsonl(tmp_path / "rows.jsonl", [_chat_row()])
    with pytest.raises(LicenceError):
        sft_dataset.assemble([sft_dataset.SourceSpec(path=path, source="ms-marco")])


def test_save_rows_roundtrip(tmp_path: Path) -> None:
    rows = [_chat_row(), _chat_row(user="second distinct row")]
    path = tmp_path / "out.jsonl"
    digest = sft_dataset.save_rows(rows, path)
    assert len(digest) == 64
    reloaded = sft_dataset.load_chat_rows(path)
    assert len(reloaded) == 2


def test_dataset_cli_dry_run_and_gate(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    out = tmp_path / "sft.jsonl"
    assert sft_dataset.main(["--out", str(out), "--dry-run"]) == 0
    assert not out.exists()
    assert "gate: blocked" in capsys.readouterr().out

    # without --dry-run it writes the file + manifest
    assert sft_dataset.main(["--out", str(out)]) == 0
    assert out.is_file()
    manifest = json.loads(out.with_suffix(".manifest.json").read_text())
    assert manifest["exported"] == 234
    assert manifest["goldenSha256"] == FROZEN_GOLDEN_SHA
    assert manifest["gate"]["status"] == "blocked"
    capsys.readouterr()

    # --require-ready fails while client-derived rows are below 2000
    assert sft_dataset.main(["--out", str(out), "--dry-run", "--require-ready"]) == 1
    capsys.readouterr()

    # an unknown source fails cleanly
    assert sft_dataset.main(["--out", str(out), "--dry-run", "--source", "x=nope"]) == 1


def test_dataset_cli_with_triples(tmp_path: Path) -> None:
    triples = _write_jsonl(
        tmp_path / "lora.jsonl",
        [
            _chat_row(
                user="audit json",
                assistant="fix json",
                metadata={
                    "consent": True,
                    "tenantId": "t-1",
                    "quality": "gold",
                    "provenance": "measured",
                },
            )
        ],
    )
    out = tmp_path / "sft.jsonl"
    code = sft_dataset.main(
        ["--out", str(out), "--dry-run", "--triples", str(triples)]
    )
    assert code == 0
    assert out.is_file() is False


# ------------------------------------------------------------------ DPO ----


def _pair(
    prompt: str = "audit says thin content",
    chosen: str = "expand to 250 words",
    rejected: str = "ignore it",
    metadata: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    row: Dict[str, Any] = {"prompt": prompt, "chosen": chosen, "rejected": rejected}
    if metadata is not None:
        row["metadata"] = metadata
    return row


def test_load_pairs_shape_gate(tmp_path: Path) -> None:
    good = _write_jsonl(tmp_path / "good.jsonl", [_pair()])
    assert len(dpo_module.load_pairs(good)) == 1

    with pytest.raises(DatasetError, match="not found"):
        dpo_module.load_pairs(tmp_path / "missing.jsonl")

    missing = _write_jsonl(tmp_path / "missing.jsonl", [{"prompt": "x", "chosen": "y"}])
    with pytest.raises(DatasetError, match="empty/missing"):
        dpo_module.load_pairs(missing)

    same = _write_jsonl(tmp_path / "same.jsonl", [_pair(chosen="same", rejected="same")])
    with pytest.raises(DatasetError, match="no preference signal"):
        dpo_module.load_pairs(same)

    bad = tmp_path / "bad.jsonl"
    bad.write_text("{oops\n", encoding="utf-8")
    with pytest.raises(DatasetError, match="invalid JSON"):
        dpo_module.load_pairs(bad)


def test_dpo_prepare_gates() -> None:
    # unknown source
    with pytest.raises(LicenceError):
        dpo_module.prepare([_pair()], source="not-real")

    # first-party needs consent + tenantId
    rows, manifest = dpo_module.prepare([_pair()], source="patches")
    assert rows == []
    assert manifest["refused"] == 1
    assert manifest["clientDerivedPairs"] == 0

    consented = _pair(metadata={"consent": True, "tenantId": "t-1"})
    rows, manifest = dpo_module.prepare([consented], source="patches")
    assert len(rows) == 1
    assert manifest["clientDerivedPairs"] == 1
    assert manifest["gate"]["status"] == "blocked"  # 1 < 2000

    # repo source needs no consent and is gate-exempt
    rows, manifest = dpo_module.prepare([_pair()], source="repo-synthetic")
    assert len(rows) == 1
    assert manifest["gate"]["status"] == "ready"


def test_dpo_prepare_strips_pii_and_dedupes() -> None:
    pairs = [
        _pair(prompt="call (503) 555 0123"),
        _pair(prompt="call (503) 555 0123"),
        _pair(prompt="a wholly different prompt"),
    ]
    rows, manifest = dpo_module.prepare(pairs, source="repo-synthetic")
    assert len(rows) == 2
    assert manifest["piiStripped"] == 2
    assert "(503) 555 0123" not in rows[0]["prompt"]


def test_dpo_prepare_refuses_golden_leakage() -> None:
    golden_case = json.loads(GOLDEN.read_text(encoding="utf-8").splitlines()[0])
    leaked = golden_case["input"].get("text") or json.dumps(golden_case["input"])
    rows, manifest = dpo_module.prepare(
        [_pair(prompt=leaked), _pair()], source="repo-synthetic"
    )
    assert len(rows) == 1
    assert manifest["goldenRefused"] == 1


def test_dpo_cli_dry_run_and_require_ready(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    pairs = _write_jsonl(
        tmp_path / "pairs.jsonl",
        [_pair(metadata={"consent": True, "tenantId": "t-1"})],
    )
    assert dpo_module.main(["--pairs", str(pairs), "--source", "patches"]) == 0
    out = capsys.readouterr().out
    assert "gate: blocked" in out

    assert (
        dpo_module.main(
            ["--pairs", str(pairs), "--source", "patches", "--require-ready"]
        )
        == 1
    )
    capsys.readouterr()

    repo_pairs = _write_jsonl(tmp_path / "repo.jsonl", [_pair()])
    assert dpo_module.main(["--pairs", str(repo_pairs), "--source", "repo-synthetic"]) == 0


@pytest.mark.skipif(_has_torch(), reason="torch installed — heavy path not tested")
def test_dpo_train_raises_actionable_heavy_deps_error() -> None:
    with pytest.raises(HeavyDepsError, match="requirements-ml.txt"):
        dpo_module.train(train_config.DpoConfig(), [_pair()])


@pytest.mark.skipif(_has_torch(), reason="torch installed — heavy path not tested")
def test_sft_train_raises_actionable_heavy_deps_error() -> None:
    with pytest.raises(HeavyDepsError, match="requirements-ml.txt"):
        sft_module.train(train_config.SftConfig(), [_chat_row()])


def test_train_rejects_zero_rows() -> None:
    with pytest.raises(DatasetError, match="zero rows"):
        sft_module.train(train_config.SftConfig(), [])
    with pytest.raises(DatasetError, match="zero pairs"):
        dpo_module.train(train_config.DpoConfig(), [])


# ------------------------------------------------------------------ SFT ----


def test_sft_manifest_records_governance(tmp_path: Path) -> None:
    config = train_config.SftConfig()
    data = _write_jsonl(tmp_path / "data.jsonl", [_chat_row()])
    manifest = sft_module.build_manifest(
        config, [_chat_row()], mode="dry-run", data_path=data
    )
    assert manifest["trainingStarted"] is False
    assert manifest["mode"] == "dry-run"
    assert manifest["baseModel"]["licence"] == "Apache-2.0"
    assert manifest["golden"]["sha256"] == FROZEN_GOLDEN_SHA
    assert manifest["data"]["sha256"] and len(manifest["data"]["sha256"]) == 64
    assert manifest["gitSha"]
    assert manifest["artifacts"]["weightsCommitted"] is False
    assert "run_eval" in manifest["evalCommand"]

    train_manifest = sft_module.build_manifest(
        config, [_chat_row()], mode="train", data_path=data
    )
    assert train_manifest["trainingStarted"] is True

    with pytest.raises(ConfigError):
        sft_module.build_manifest(config, [], mode="bogus", data_path=data)


def test_sft_cli_dry_run_writes_manifest(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    data = _write_jsonl(tmp_path / "data.jsonl", [_chat_row()])
    manifest_path = tmp_path / "manifest.json"
    code = sft_module.main(
        ["--data", str(data), "--manifest", str(manifest_path)]
    )
    assert code == 0
    manifest = json.loads(manifest_path.read_text())
    assert manifest["trainingStarted"] is False
    assert manifest["config"]["trust_remote_code"] is False
    assert manifest["baseModel"]["id"] == "Qwen/Qwen3-4B"
    assert "dry run only" in capsys.readouterr().out


def test_sft_cli_missing_data_fails(tmp_path: Path) -> None:
    assert sft_module.main(["--data", str(tmp_path / "nope.jsonl")]) == 1


def test_sft_cli_bad_config_fails(tmp_path: Path) -> None:
    data = _write_jsonl(tmp_path / "data.jsonl", [_chat_row()])
    bad = tmp_path / "bad.json"
    bad.write_text(json.dumps({"trust_remote_code": True}), encoding="utf-8")
    assert sft_module.main(["--data", str(data), "--config", str(bad)]) == 1


# -------------------------------------------------------------- evaluate ----


def test_build_requests_covers_every_golden_case() -> None:
    requests = evaluate_module.build_requests(GOLDEN)
    golden_ids = [
        json.loads(line)["id"]
        for line in GOLDEN.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    assert len(requests) == 52
    assert [r["caseId"] for r in requests] == golden_ids
    for request in requests:
        assert request["messages"][0]["role"] == "system"
        assert request["messages"][1]["role"] == "user"
        assert "SEO Studio" in request["messages"][0]["content"]


def test_build_requests_templates_mention_inputs() -> None:
    requests = {r["caseId"]: r for r in evaluate_module.build_requests(GOLDEN)}
    for request in requests.values():
        user = request["messages"][1]["content"]
        assert "URL:" in user
        assert "Page text:" in user or "page" in user.lower()

    # classification prompt offers exactly the golden label vocabulary
    classification = next(
        r for r in requests.values() if r["task"] == "page_classification"
    )
    user = classification["messages"][1]["content"]
    assert "hotel_homepage" in user
    assert "reply with exactly one label" in user.lower()


def test_build_requests_is_deterministic() -> None:
    first = evaluate_module.build_requests(GOLDEN)
    second = evaluate_module.build_requests(GOLDEN)
    assert json.dumps(first, sort_keys=True) == json.dumps(second, sort_keys=True)


def test_parse_output_shapes() -> None:
    assert evaluate_module.parse_output("schema_generation", '{"@type": "Hotel"}') == {
        "@type": "Hotel"
    }
    # invalid JSON falls back to the raw string (judged honestly by checks)
    assert evaluate_module.parse_output("metadata_generation", "not json") == "not json"
    assert evaluate_module.parse_output("page_classification", "  spa  ") == "spa"


def test_write_outputs_roundtrips_into_run_eval(tmp_path: Path) -> None:
    """Golden outputs replayed as model outputs must score, not fail."""
    cases = [
        json.loads(line)
        for line in GOLDEN.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    picked = [
        c
        for c in cases
        if c["task"] in {"schema_generation", "metadata_generation"}
    ][:4]
    outputs = tmp_path / "outputs.jsonl"
    evaluate_module.write_outputs(
        [{"caseId": c["id"], "output": c["output"]} for c in picked], outputs
    )

    from ml.eval import run_eval

    report = run_eval.run(GOLDEN, outputs)
    scored = [r for r in report["results"] if r["caseId"] in {c["id"] for c in picked}]
    assert scored, "picked cases produced no checks"
    assert all(r["status"] in {"pass", "scored"} for r in scored), report["failures"]


def test_evaluate_cli_builds_requests(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    target = tmp_path / "requests.jsonl"
    assert evaluate_module.main(["--requests", str(target)]) == 0
    lines = [line for line in target.read_text().splitlines() if line.strip()]
    assert len(lines) == 52
    assert "template v1" in capsys.readouterr().out


def test_evaluate_cli_generate_requires_out(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    target = tmp_path / "requests.jsonl"
    assert evaluate_module.main(["--requests", str(target)]) == 0
    capsys.readouterr()
    assert evaluate_module.main(["--generate", "--requests", str(target)]) == 1


@pytest.mark.skipif(_has_torch(), reason="torch installed — heavy path not tested")
def test_generate_raises_actionable_heavy_deps_error() -> None:
    with pytest.raises(HeavyDepsError, match="requirements-ml.txt"):
        evaluate_module.generate(
            [{"caseId": "x", "task": "schema_generation", "messages": []}],
            base_model="Qwen/Qwen3-4B",
        )


# ------------------------------------------------------------- de-brand ----


@pytest.mark.parametrize("name", ["unified_seo_train.jsonl", "unified_seo_eval.jsonl"])
def test_training_data_carries_no_legacy_brand(name: str) -> None:
    """A model trained on a re-branded file would reintroduce the old name."""
    text = (REPO_ROOT / "data" / "training" / name).read_text(encoding="utf-8")
    assert "cogwheel" not in text.lower()
