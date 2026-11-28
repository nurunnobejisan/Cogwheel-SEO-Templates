"""QLoRA supervised fine-tuning.

Two modes behind one entry point:

- **dry-run (default, CI-safe)** — validates the config, the assembled
  dataset and the governance gates, then writes a run manifest with
  ``trainingStarted: false``. No GPU stack is imported.
- **``--train`` (GPU box only)** — lazily imports torch/trl/peft; a missing
  ML dependency raises :class:`HeavyDepsError` naming
  ``ml/requirements-ml.txt`` (D-014), never an ImportError at module load.

Every run manifest records the base model **and its allow-listed licence**,
the data and golden-set sha256s, the git sha and the full hyperparameter
set — so a number later recorded in ``docs/ml/PROGRESS.md`` can be traced to
exactly which data and config produced it. Scores themselves are never
written here: golden-set numbers come only from ``ml/eval/run_eval.py``.

Weights are never committed (``.gitignore`` excludes ``*.safetensors`` etc.);
push adapters to ``ML_PRIVATE_DATASET_REPO``.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional, Sequence

from .config import SftConfig, resolve_base_model
from .dataset import DEFAULT_GOLDEN, load_chat_rows
from .errors import ConfigError, DatasetError, HeavyDepsError

__all__ = ["build_manifest", "train", "load_dataset", "run_id_for"]

DEFAULT_DATA = Path("data/build/sft-v2.jsonl")
DEFAULT_OUT_DIR = Path("ml/train/outputs")


def load_dataset(path: Path) -> List[Dict[str, Any]]:
    """Load an assembled chat dataset (the format ``dataset.assemble`` writes)."""
    return load_chat_rows(path)


def run_id_for(prefix: str) -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return f"{prefix}-{stamp}"


def _sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _git_sha() -> str:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return "unknown"
    sha = result.stdout.strip()
    return sha if result.returncode == 0 and sha else "unknown"


def build_manifest(
    config: SftConfig,
    rows: Sequence[Mapping[str, Any]],
    *,
    mode: str,
    data_path: Path,
    golden_path: Path = DEFAULT_GOLDEN,
    run_id: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Assemble the auditable record of one (would-be) training run."""
    if mode not in {"dry-run", "train"}:
        raise ConfigError(f"mode must be dry-run|train, got {mode!r}")
    config.validate()
    run_id = run_id or run_id_for("sft")
    manifest: Dict[str, Any] = {
        "kind": "sft",
        "runId": run_id,
        "mode": mode,
        "trainingStarted": mode == "train",
        "generatedAt": datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z"),
        "gitSha": _git_sha(),
        "data": {
            "path": str(data_path),
            "sha256": _sha256_file(data_path) if data_path.is_file() else None,
            "rows": len(rows),
        },
        "golden": {
            "path": str(golden_path),
            "sha256": _sha256_file(golden_path) if golden_path.is_file() else None,
            "note": "scores are only ever produced by ml/eval/run_eval.py",
        },
        "config": config.to_dict(),
        "baseModel": {
            "id": config.base_model,
            "licence": resolve_base_model(config.base_model)["licence"],
        },
        "artifacts": {"adapter": None, "weightsCommitted": False},
        "evalCommand": (
            "python3 ml/eval/run_eval.py --outputs <run>-outputs.jsonl"
        ),
    }
    if extra:
        manifest.update(extra)
    return manifest


def train(config: SftConfig, rows: Sequence[Mapping[str, Any]]) -> Dict[str, Any]:
    """Run QLoRA SFT. Heavy deps are imported lazily (D-014)."""
    if not rows:
        raise DatasetError("cannot train on zero rows")
    config.validate()

    try:
        import torch
        from datasets import Dataset
        from peft import LoraConfig
        from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
        from trl import SFTConfig as TrlSFTConfig
        from trl import SFTTrainer
    except ImportError as exc:
        raise HeavyDepsError() from exc

    tokenizer = AutoTokenizer.from_pretrained(
        config.base_model, trust_remote_code=config.trust_remote_code
    )
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    def render(row: Mapping[str, Any]) -> str:
        return tokenizer.apply_chat_template(
            list(row["messages"]), tokenize=False, add_generation_prompt=False
        )

    dataset = Dataset.from_list(
        [{"text": render(row)} for row in rows]
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
    model.config.use_cache = False

    peft_config = LoraConfig(
        r=config.lora_r,
        lora_alpha=config.lora_alpha,
        lora_dropout=config.lora_dropout,
        target_modules=list(config.target_modules),
        bias="none",
        task_type="CAUSAL_LM",
    )

    run_id = run_id_for("sft")
    output_dir = Path(config.out_dir) / run_id
    sft_args = TrlSFTConfig(
        output_dir=str(output_dir),
        num_train_epochs=config.epochs,
        per_device_train_batch_size=config.batch_size,
        gradient_accumulation_steps=config.gradient_accumulation,
        learning_rate=config.learning_rate,
        warmup_ratio=config.warmup_ratio,
        seed=config.seed,
        gradient_checkpointing=config.gradient_checkpointing,
        max_length=config.max_seq_len,
        dataset_text_field="text",
        report_to="none",
        logging_steps=10,
    )
    trainer = SFTTrainer(
        model=model,
        args=sft_args,
        train_dataset=dataset,
        peft_config=peft_config,
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
    parser = argparse.ArgumentParser(description="QLoRA SFT (dry-run by default)")
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--config", type=Path, default=None, help="SftConfig JSON")
    parser.add_argument("--golden", type=Path, default=DEFAULT_GOLDEN)
    parser.add_argument("--train", action="store_true", help="actually train (GPU + ML deps)")
    parser.add_argument("--manifest", type=Path, default=None, help="where to write the manifest")
    args = parser.parse_args(list(argv) if argv is not None else None)

    try:
        config = SftConfig.load(args.config) if args.config else SftConfig()
        config.validate()
        rows = load_dataset(args.data)
    except (ConfigError, DatasetError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    mode = "train" if args.train else "dry-run"
    manifest = build_manifest(
        config, rows, mode=mode, data_path=args.data, golden_path=args.golden
    )

    if args.train:
        try:
            outcome = train(config, rows)
        except HeavyDepsError as exc:
            print(f"error: {exc}", file=sys.stderr)
            return 1
        manifest["artifacts"]["adapter"] = outcome["adapter"]
        manifest["trainLoss"] = outcome["trainLoss"]
        manifest["globalSteps"] = outcome["globalSteps"]
        print(f"trained run {outcome['runId']}; adapter -> {outcome['adapter']}")

    manifest_path = args.manifest or (
        Path(config.out_dir) / f"{manifest['runId']}.manifest.json"
    )
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    print(
        f"{mode}: {len(rows)} rows | base {manifest['baseModel']['id']} "
        f"({manifest['baseModel']['licence']}) | manifest -> {manifest_path}"
    )
    if not args.train:
        print("dry run only — pass --train on a GPU box with ml/requirements-ml.txt installed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
