"""DPO on approved-vs-rejected pairs (healing patches, reviewed fixes).

Pair file format — JSONL, one object per line::

    {"prompt": "...", "chosen": "...", "rejected": "...",
     "metadata": {"source-specific fields"}}

There is **no committed pair corpus yet** (same posture as D-017): the
capture side lives in the app, and client-derived pairs stay in
``data/`` / the private dataset repo. This module ships the gates and the
runner so the first real corpus can train without new code:

- licence registry gate on the declared source (rule 3);
- first-party sources (``patches`` / ``vault`` / ``triples``) require
  ``metadata.consent is True`` + ``metadata.tenantId`` (parity with
  ``ml.registry.register_example``);
- ``chosen == rejected`` pairs are refused — a pair with no preference
  signal is noise, and training on it would silently zero the DPO loss
  contribution;
- PII stripped from prompt/chosen/rejected via the Python twin;
- golden-set content refused (eval never trains);
- the 2000-pair gate applies to client-derived sources: below it the run
  reports ``blocked`` and ``--require-ready`` exits 1.

Dry-run by default; ``--train`` lazily imports the GPU stack (D-014).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple

from ml.clean.pii import strip_pii
from ml.registry import LicenceError, load_registry

from .config import FIRST_PARTY_SOURCES, MIN_REVIEWED_PAIRS_FOR_TRAINING, DpoConfig, resolve_base_model
from .dataset import DEFAULT_GOLDEN, _refuses_golden, golden_fingerprints
from .errors import ConfigError, DatasetError, HeavyDepsError

__all__ = ["load_pairs", "prepare", "build_manifest", "train"]

PAIR_FIELDS = ("prompt", "chosen", "rejected")


def load_pairs(path: Path) -> List[Dict[str, Any]]:
    """Read and shape-validate a DPO pair file."""
    if not path.is_file():
        raise DatasetError(f"pair file not found: {path}")
    pairs: List[Dict[str, Any]] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError as exc:
            raise DatasetError(f"{path}:{line_number}: invalid JSON: {exc}") from exc
        if not isinstance(row, Mapping):
            raise DatasetError(f"{path}:{line_number}: expected an object")
        missing = [f for f in PAIR_FIELDS if not isinstance(row.get(f), str) or not row[f].strip()]
        if missing:
            raise DatasetError(f"{path}:{line_number}: empty/missing fields {missing}")
        if row["chosen"].strip() == row["rejected"].strip():
            raise DatasetError(
                f"{path}:{line_number}: chosen == rejected — no preference signal"
            )
        pairs.append(dict(row))
    return pairs


def prepare(
    pairs: Sequence[Mapping[str, Any]],
    *,
    source: str,
    split: str = "train",
    golden_path: Path = DEFAULT_GOLDEN,
    strip_pii_enabled: bool = True,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Gate, strip and de-duplicate pairs; returns (pairs, manifest)."""
    registry = load_registry()
    registry.require(source)
    registry.assert_trainable(source, split)
    exact, fragments = golden_fingerprints(golden_path)

    cleaned_rows: List[Dict[str, Any]] = []
    seen: set = set()
    refused = 0
    golden_refused = 0
    pii_stripped = 0
    first_party = source in FIRST_PARTY_SOURCES

    for position, pair in enumerate(pairs):
        metadata = pair.get("metadata")
        if not isinstance(metadata, Mapping):
            metadata = pair.get("meta")
        metadata = metadata if isinstance(metadata, Mapping) else {}

        reason: Optional[str] = None
        if first_party:
            if metadata.get("consent") is not True:
                reason = f"source {source!r} is first-party: metadata.consent must be true"
            elif not metadata.get("tenantId"):
                reason = f"source {source!r} is first-party: metadata.tenantId is required"
        if reason is None:
            for field_name in PAIR_FIELDS:
                if _refuses_golden(pair[field_name], exact, fragments):
                    reason = f"golden-set leakage in {field_name}"
                    break

        if reason is not None:
            refused += 1
            if "golden" in reason:
                golden_refused += 1
            continue

        cleaned = dict(pair)
        if strip_pii_enabled:
            before = json.dumps(
                {f: cleaned[f] for f in PAIR_FIELDS}, sort_keys=True
            )
            for field_name in PAIR_FIELDS:
                cleaned[field_name] = strip_pii(cleaned[field_name])
            after = json.dumps({f: cleaned[f] for f in PAIR_FIELDS}, sort_keys=True)
            if before != after:
                pii_stripped += 1

        fingerprint = hashlib.sha256(
            json.dumps([cleaned[f] for f in PAIR_FIELDS], sort_keys=True).encode("utf-8")
        ).hexdigest()
        if fingerprint in seen:
            continue
        seen.add(fingerprint)
        cleaned_rows.append(cleaned)

    client_rows = len(cleaned_rows) if first_party else 0
    gate_ready = (not first_party) or client_rows >= MIN_REVIEWED_PAIRS_FOR_TRAINING
    manifest: Dict[str, Any] = {
        "generatedAt": datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z"),
        "source": source,
        "split": split,
        "golden": str(golden_path),
        "goldenSha256": hashlib.sha256(golden_path.read_bytes()).hexdigest(),
        "read": len(pairs),
        "exported": len(cleaned_rows),
        "refused": refused,
        "goldenRefused": golden_refused,
        "piiStripped": pii_stripped,
        "clientDerivedPairs": client_rows,
        "gate": {
            "minimum": MIN_REVIEWED_PAIRS_FOR_TRAINING,
            "clientDerivedPairs": client_rows,
            "status": "ready" if gate_ready else "blocked",
        },
    }
    return cleaned_rows, manifest


def build_manifest(
    config: DpoConfig,
    *,
    mode: str,
    data_path: Path,
    data_manifest: Mapping[str, Any],
    golden_path: Path = DEFAULT_GOLDEN,
    run_id: Optional[str] = None,
) -> Dict[str, Any]:
    if mode not in {"dry-run", "train"}:
        raise ConfigError(f"mode must be dry-run|train, got {mode!r}")
    config.validate()
    run_id = run_id or datetime.now(timezone.utc).strftime("dpo-%Y%m%dT%H%M%SZ")
    return {
        "kind": "dpo",
        "runId": run_id,
        "mode": mode,
        "trainingStarted": mode == "train",
        "generatedAt": datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z"),
        "data": {
            "path": str(data_path),
            "sha256": hashlib.sha256(data_path.read_bytes()).hexdigest()
            if data_path.is_file()
            else None,
            "gate": data_manifest.get("gate"),
            "source": data_manifest.get("source"),
        },
        "golden": {
            "path": str(golden_path),
            "sha256": hashlib.sha256(golden_path.read_bytes()).hexdigest(),
            "note": "scores are only ever produced by ml/eval/run_eval.py",
        },
        "config": config.to_dict(),
        "baseModel": {
            "id": config.base_model,
            "licence": resolve_base_model(config.base_model)["licence"],
        },
        "artifacts": {"adapter": None, "weightsCommitted": False},
        "evalCommand": "python3 ml/eval/run_eval.py --outputs <run>-outputs.jsonl",
    }


def train(config: DpoConfig, pairs: Sequence[Mapping[str, Any]]) -> Dict[str, Any]:
    """Run DPO with a LoRA policy. Heavy deps imported lazily (D-014)."""
    if not pairs:
        raise DatasetError("cannot train DPO on zero pairs")
    config.validate()

    try:
        import torch
        from datasets import Dataset
        from peft import LoraConfig
        from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
        from trl import DPOConfig as TrlDPOConfig
        from trl import DPOTrainer
    except ImportError as exc:
        raise HeavyDepsError() from exc

    tokenizer = AutoTokenizer.from_pretrained(
        config.base_model, trust_remote_code=config.trust_remote_code
    )
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    dataset = Dataset.from_list(
        [
            {
                "prompt": pair["prompt"],
                "chosen": pair["chosen"],
                "rejected": pair["rejected"],
            }
            for pair in pairs
        ]
    )

    quant = BitsAndBytesConfig(
        load_in_4bit=config.load_in_4bit,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16,
    )
    model = AutoModelForCausalLM.from_pretrained(
        config.base_model,
        quantization_config=quant,
        trust_remote_code=config.trust_remote_code,
        device_map="auto",
    )
    peft_config = LoraConfig(
        r=config.lora_r,
        lora_alpha=config.lora_alpha,
        lora_dropout=config.lora_dropout,
        target_modules=list(config.target_modules),
        bias="none",
        task_type="CAUSAL_LM",
    )

    run_id = datetime.now(timezone.utc).strftime("dpo-%Y%m%dT%H%M%SZ")
    output_dir = Path(config.out_dir) / run_id
    dpo_args = TrlDPOConfig(
        output_dir=str(output_dir),
        num_train_epochs=config.epochs,
        per_device_train_batch_size=config.batch_size,
        gradient_accumulation_steps=config.gradient_accumulation,
        learning_rate=config.learning_rate,
        beta=config.beta,
        seed=config.seed,
        max_length=config.max_len,
        max_prompt_length=config.max_prompt_len,
        report_to="none",
        logging_steps=10,
    )
    trainer = DPOTrainer(
        model=model,
        args=dpo_args,
        train_dataset=dataset,
        peft_config=peft_config,
        processing_class=tokenizer,
    )
    result = trainer.train()

    adapter_dir = output_dir / "adapter"
    trainer.model.save_pretrained(str(adapter_dir))
    tokenizer.save_pretrained(str(adapter_dir))
    return {
        "runId": run_id,
        "adapter": str(adapter_dir),
        "trainLoss": float(result.training_loss),
        "globalSteps": int(result.global_step),
    }


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="DPO training (dry-run by default)")
    parser.add_argument("--pairs", type=Path, required=True, help="JSONL of prompt/chosen/rejected")
    parser.add_argument("--source", required=True, help="registry id (e.g. patches, repo-synthetic)")
    parser.add_argument("--config", type=Path, default=None, help="DpoConfig JSON")
    parser.add_argument("--golden", type=Path, default=DEFAULT_GOLDEN)
    parser.add_argument("--train", action="store_true", help="actually train (GPU + ML deps)")
    parser.add_argument("--require-ready", action="store_true", help="exit 1 if the 2000-pair gate is blocked")
    parser.add_argument("--manifest", type=Path, default=None)
    args = parser.parse_args(list(argv) if argv is not None else None)

    try:
        config = DpoConfig.load(args.config) if args.config else DpoConfig()
        config.validate()
        pairs = load_pairs(args.pairs)
        cleaned, data_manifest = prepare(
            pairs, source=args.source, golden_path=args.golden
        )
    except (ConfigError, DatasetError, LicenceError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    gate = data_manifest["gate"]
    print(
        f"gate: {gate['status']} "
        f"({gate['clientDerivedPairs']}/{gate['minimum']} client-derived pairs)"
    )
    if args.require_ready and gate["status"] != "ready":
        print("BLOCKING: client-derived pairs below the training threshold.", file=sys.stderr)
        return 1
    if not cleaned:
        print("error: no eligible pairs after gating", file=sys.stderr)
        return 1

    mode = "train" if args.train else "dry-run"
    manifest = build_manifest(
        config,
        mode=mode,
        data_path=args.pairs,
        data_manifest=data_manifest,
        golden_path=args.golden,
    )
    manifest["eligiblePairs"] = len(cleaned)

    if args.train:
        try:
            outcome = train(config, cleaned)
        except HeavyDepsError as exc:
            print(f"error: {exc}", file=sys.stderr)
            return 1
        manifest["artifacts"]["adapter"] = outcome["adapter"]
        manifest["trainLoss"] = outcome["trainLoss"]
        manifest["globalSteps"] = outcome["globalSteps"]
        print(f"trained {outcome['runId']}; adapter -> {outcome['adapter']}")

    manifest_path = args.manifest or (
        Path(config.out_dir) / f"{manifest['runId']}.manifest.json"
    )
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    print(
        f"{mode}: {len(cleaned)} eligible pairs | base {manifest['baseModel']['id']} "
        f"({manifest['baseModel']['licence']}) | manifest -> {manifest_path}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
