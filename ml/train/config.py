"""Training configuration: base-model allow-list, SFT/DPO configs, gates.

Three rules this module encodes:

1. **Base models are allow-listed with their licence** (D-019). A model id
   that is not on the list is refused with an instruction to verify its model
   card and add it — training on an unverified licence is how contamination
   enters the pipeline. The licence travels into every run manifest.
2. **``trust_remote_code`` is always false.** Qwen-family models do not need
   it, and a config that flips it would execute arbitrary model code during
   training.
3. **``MIN_REVIEWED_PAIRS_FOR_TRAINING`` mirrors the TypeScript constant**
   (``src/core/training/dataset.ts``); a test asserts the two never drift.

Standard library only (D-014).
"""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field, fields
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional

from .errors import ConfigError

__all__ = [
    "MIN_REVIEWED_PAIRS_FOR_TRAINING",
    "BASE_MODELS",
    "resolve_base_model",
    "SftConfig",
    "DpoConfig",
]

#: Mirrors MIN_REVIEWED_PAIRS_FOR_TRAINING in src/core/training/dataset.ts.
#: Client-derived rows (triples / patches / vault) need this many eligible
#: pairs before a run is "ready"; below it, dry-runs report BLOCKED.
MIN_REVIEWED_PAIRS_FOR_TRAINING = 2000

#: First-party source ids — consent + tenantId required per row (rule parity
#: with ``ml.registry.register_example``).
FIRST_PARTY_SOURCES = frozenset({"vault", "patches", "triples"})

#: Allow-listed base models. ``pattern`` is a glob over Hugging Face ids (or
#: the final path segment of a local checkout). Every entry must carry the
#: licence printed on its model card; the manifest records the match.
#: Qwen3.5 ids are pattern-matched because the exact repo ids must be
#: verified against the model card before the first real run (the same
#: verification requirement documented in ml/requirements-ml.txt).
BASE_MODELS: List[Dict[str, str]] = [
    {"pattern": "Qwen/Qwen3-0.6B", "licence": "Apache-2.0", "family": "qwen3"},
    {"pattern": "Qwen/Qwen3-1.7B", "licence": "Apache-2.0", "family": "qwen3"},
    {"pattern": "Qwen/Qwen3-4B", "licence": "Apache-2.0", "family": "qwen3"},
    {"pattern": "Qwen/Qwen3.5-*", "licence": "Apache-2.0", "family": "qwen3.5"},
]

_TARGET_MODULES = [
    "q_proj",
    "k_proj",
    "v_proj",
    "o_proj",
    "gate_proj",
    "up_proj",
    "down_proj",
]


def resolve_base_model(model_id: str) -> Dict[str, str]:
    """Return the allow-list entry for ``model_id`` or raise ``ConfigError``.

    A local path is matched on its final segment so a downloaded
    ``./models/Qwen3-4B`` resolves to the same licence entry.
    """
    if not isinstance(model_id, str) or not model_id.strip():
        raise ConfigError("base_model must be a non-empty string")
    segment = model_id.rstrip("/").split("/")[-1]
    for entry in BASE_MODELS:
        pattern = entry["pattern"]
        if "*" in pattern:
            prefix = pattern.split("*", 1)[0]
            if segment.startswith(prefix):
                return dict(entry)
        elif segment == pattern.split("/")[-1] or model_id == pattern:
            return dict(entry)
    allowed = ", ".join(entry["pattern"] for entry in BASE_MODELS)
    raise ConfigError(
        f"base_model {model_id!r} is not on the allow-list. Verify its model "
        "card licence, then add it to BASE_MODELS in ml/train/config.py. "
        f"Allowed: {allowed}"
    )


def _require(condition: bool, message: str, errors: List[str]) -> None:
    if not condition:
        errors.append(message)


@dataclass
class SftConfig:
    """Supervised fine-tune (QLoRA) configuration."""

    base_model: str = "Qwen/Qwen3-4B"
    lora_r: int = 16
    lora_alpha: int = 32
    lora_dropout: float = 0.05
    target_modules: List[str] = field(default_factory=lambda: list(_TARGET_MODULES))
    load_in_4bit: bool = True
    epochs: float = 3.0
    learning_rate: float = 2e-4
    warmup_ratio: float = 0.03
    batch_size: int = 2
    gradient_accumulation: int = 4
    max_seq_len: int = 2048
    seed: int = 1795487332
    out_dir: str = "ml/train/outputs"
    #: Never true — see module docstring. Qwen models do not need it.
    trust_remote_code: bool = False
    gradient_checkpointing: bool = True

    def validate(self) -> None:
        errors: List[str] = []
        resolve_base_model(self.base_model)  # raises on its own
        _require(self.lora_r >= 1, "lora_r must be >= 1", errors)
        _require(self.lora_alpha > 0, "lora_alpha must be > 0", errors)
        _require(0.0 <= self.lora_dropout < 1.0, "lora_dropout must be in [0, 1)", errors)
        _require(bool(self.target_modules), "target_modules must not be empty", errors)
        _require(
            all(isinstance(m, str) and m for m in self.target_modules),
            "target_modules entries must be non-empty strings",
            errors,
        )
        _require(self.epochs >= 1, "epochs must be >= 1", errors)
        _require(0 < self.learning_rate <= 1, "learning_rate must be in (0, 1]", errors)
        _require(0.0 <= self.warmup_ratio < 1.0, "warmup_ratio must be in [0, 1)", errors)
        _require(self.batch_size >= 1, "batch_size must be >= 1", errors)
        _require(self.gradient_accumulation >= 1, "gradient_accumulation must be >= 1", errors)
        _require(self.max_seq_len >= 64, "max_seq_len must be >= 64", errors)
        _require(isinstance(self.seed, int), "seed must be an integer", errors)
        _require(bool(self.out_dir), "out_dir must not be empty", errors)
        _require(self.trust_remote_code is False, "trust_remote_code must stay false", errors)
        if errors:
            raise ConfigError("invalid SftConfig: " + "; ".join(errors))

    def to_dict(self) -> Dict[str, Any]:
        payload = asdict(self)
        payload["baseModelLicence"] = resolve_base_model(self.base_model)["licence"]
        return payload

    @classmethod
    def from_dict(cls, payload: Mapping[str, Any]) -> "SftConfig":
        known = {f.name for f in fields(cls)}
        unknown = sorted(set(payload) - known)
        if unknown:
            raise ConfigError(f"unknown SftConfig field(s): {', '.join(unknown)}")
        try:
            config = cls(**{k: v for k, v in payload.items() if k in known})
        except TypeError as exc:
            raise ConfigError(f"invalid SftConfig values: {exc}") from exc
        config.validate()
        return config

    @classmethod
    def load(cls, path: Path) -> "SftConfig":
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ConfigError(f"cannot read config {path}: {exc}") from exc
        if not isinstance(payload, Mapping):
            raise ConfigError(f"config {path} must be a JSON object")
        return cls.from_dict(payload)

    def save(self, path: Path) -> None:
        self.validate()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.to_dict(), indent=2, sort_keys=True) + "\n", encoding="utf-8")


@dataclass
class DpoConfig:
    """Direct preference optimisation configuration (chosen vs rejected)."""

    base_model: str = "Qwen/Qwen3-4B"
    lora_r: int = 16
    lora_alpha: int = 32
    lora_dropout: float = 0.05
    target_modules: List[str] = field(default_factory=lambda: list(_TARGET_MODULES))
    load_in_4bit: bool = True
    beta: float = 0.1
    epochs: float = 1.0
    learning_rate: float = 5e-5
    batch_size: int = 1
    gradient_accumulation: int = 8
    max_prompt_len: int = 1024
    max_len: int = 2048
    seed: int = 1795487332
    out_dir: str = "ml/train/outputs"
    trust_remote_code: bool = False

    def validate(self) -> None:
        errors: List[str] = []
        resolve_base_model(self.base_model)
        _require(self.lora_r >= 1, "lora_r must be >= 1", errors)
        _require(self.lora_alpha > 0, "lora_alpha must be > 0", errors)
        _require(0.0 <= self.lora_dropout < 1.0, "lora_dropout must be in [0, 1)", errors)
        _require(bool(self.target_modules), "target_modules must not be empty", errors)
        _require(self.beta > 0, "beta must be > 0", errors)
        _require(self.epochs >= 1, "epochs must be >= 1", errors)
        _require(0 < self.learning_rate <= 1, "learning_rate must be in (0, 1]", errors)
        _require(self.batch_size >= 1, "batch_size must be >= 1", errors)
        _require(self.gradient_accumulation >= 1, "gradient_accumulation must be >= 1", errors)
        _require(self.max_prompt_len >= 64, "max_prompt_len must be >= 64", errors)
        _require(
            self.max_len > self.max_prompt_len,
            "max_len must exceed max_prompt_len",
            errors,
        )
        _require(isinstance(self.seed, int), "seed must be an integer", errors)
        _require(bool(self.out_dir), "out_dir must not be empty", errors)
        _require(self.trust_remote_code is False, "trust_remote_code must stay false", errors)
        if errors:
            raise ConfigError("invalid DpoConfig: " + "; ".join(errors))

    def to_dict(self) -> Dict[str, Any]:
        payload = asdict(self)
        payload["baseModelLicence"] = resolve_base_model(self.base_model)["licence"]
        return payload

    @classmethod
    def from_dict(cls, payload: Mapping[str, Any]) -> "DpoConfig":
        known = {f.name for f in fields(cls)}
        unknown = sorted(set(payload) - known)
        if unknown:
            raise ConfigError(f"unknown DpoConfig field(s): {', '.join(unknown)}")
        try:
            config = cls(**{k: v for k, v in payload.items() if k in known})
        except TypeError as exc:
            raise ConfigError(f"invalid DpoConfig values: {exc}") from exc
        config.validate()
        return config

    @classmethod
    def load(cls, path: Path) -> "DpoConfig":
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ConfigError(f"cannot read config {path}: {exc}") from exc
        if not isinstance(payload, Mapping):
            raise ConfigError(f"config {path} must be a JSON object")
        return cls.from_dict(payload)

    def save(self, path: Path) -> None:
        self.validate()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.to_dict(), indent=2, sort_keys=True) + "\n", encoding="utf-8")
