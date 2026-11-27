"""Shared exception types for the training layer.

``HeavyDepsError`` is the important one: the CI Python job installs only the
root ``requirements.txt`` (D-014), so torch/trl/peft are never importable
there. Heavy paths raise this with an actionable message instead of failing
at module import — which would make ``ml.train`` untestable in CI.
"""

from __future__ import annotations


class TrainError(Exception):
    """Base class for training-layer errors."""


class ConfigError(TrainError):
    """A training configuration is invalid or names an unverified model."""


class DatasetError(TrainError):
    """A training row is malformed, licence-ineligible, or leaked from eval."""


class HeavyDepsError(TrainError):
    """A GPU-only path was requested without the ML dependency set installed.

    Raised lazily (never at import time) so ``ml.train`` stays importable —
    and therefore testable — with only the root ``requirements.txt``.
    """

    def __init__(self, missing: str = "torch/trl/peft") -> None:
        super().__init__(
            f"this path needs {missing} — install the isolated ML set with "
            "`pip install -r ml/requirements-ml.txt` in its own venv "
            "(never the app venv; see ml/requirements-ml.txt). "
            "Use --dry-run to validate config and data without the GPU stack."
        )
        self.missing = missing
