"""Training layer — SFT, DPO and golden-set evaluation for LoRA adapters.

Layout (see ``ml/README.md``):

- ``ml.train.config``    base-model allow-list + SFT/DPO configs + gates
- ``ml.train.dataset``   licence-gated chat-dataset assembly
- ``ml.train.sft``       QLoRA supervised fine-tuning (dry-run in CI)
- ``ml.train.dpo``       DPO over approved/rejected pairs
- ``ml.train.evaluate``  golden-set requests → generation → ``run_eval``

Rules this package obeys:

- stdlib-only imports at module level (D-014) — torch/trl/peft are imported
  lazily inside ``train()``/``generate()`` and raise ``HeavyDepsError`` with
  an actionable message when absent;
- every run writes a manifest recording base model + licence, data sha256,
  golden sha256, git sha and hyperparameters — scores themselves come only
  from ``ml/eval/run_eval.py``;
- weights are never committed (``.gitignore``); push adapters to
  ``ML_PRIVATE_DATASET_REPO``.
"""

from __future__ import annotations

from .config import (
    BASE_MODELS,
    MIN_REVIEWED_PAIRS_FOR_TRAINING,
    DpoConfig,
    SftConfig,
    resolve_base_model,
)
from .errors import ConfigError, DatasetError, HeavyDepsError, TrainError

__all__ = [
    "BASE_MODELS",
    "MIN_REVIEWED_PAIRS_FOR_TRAINING",
    "SftConfig",
    "DpoConfig",
    "resolve_base_model",
    "TrainError",
    "ConfigError",
    "DatasetError",
    "HeavyDepsError",
]
