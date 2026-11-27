"""Page-type classifier: features, training, prediction, macro-F1.

A small one-vs-rest logistic regression over deterministic, sparse features —
no numpy, no sklearn, so it trains and evaluates inside the CI Python job
(D-014). The feature extractor reads only *measured* input fields
(``jsonLdTypes``, ``h1Count``, ``hasBookingWidget``, ``wordCount``, the URL
path and the page text); it never reads ``pageType``, which is the label.

Training data comes from the operator-side pipeline (Phase 1 labels / WDC
subsets) as JSONL of ``MlExample`` rows. The CLI re-checks the licence gate on
every row — ``synthetic: true`` and non-trainable sources are refused even if
the file says otherwise (rules 3 and 6 enforced at the last moment).

    python3 -m ml.retrieve.classifier train --in rows.jsonl --out model.json
    python3 -m ml.retrieve.classifier eval  --in rows.jsonl --model model.json

Reports macro-F1 with a confusion matrix — the ``classifier_macro_f1`` check
in ``ml/eval/run_eval.py``. Numbers are only ever computed from real rows;
there is no default score.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple

from ml.registry import LicenceError, load_registry

__all__ = [
    "extract_features",
    "train",
    "predict",
    "predict_proba",
    "macro_f1",
    "confusion_matrix",
    "save_model",
    "load_model",
    "MODEL_VERSION",
]

MODEL_VERSION = 1
_TEXT_BUCKETS = 512
_MAX_TEXT_TOKENS = 400
_TOKEN_SPLIT = re.compile(r"[a-z0-9]+")


# ---------------------------------------------------------------- features --


def _bucket_words(word_count: int) -> str:
    if word_count <= 0:
        return "0"
    return str(min(int(math.log2(word_count)) + 1, 16))


def _hashed_token(token: str, buckets: int = _TEXT_BUCKETS) -> Tuple[str, float]:
    digest = hashlib.blake2b(
        token.encode("utf-8"), digest_size=8, person=b"page-classifier"
    ).digest()
    value = int.from_bytes(digest, "big")
    sign = 1.0 if (value >> 63) == 0 else -1.0
    return f"tok:{value % buckets}", sign


def extract_features(example_input: Mapping[str, Any]) -> Dict[str, float]:
    """Deterministic sparse features from a measured page input.

    Only measured fields are read. Unknown fields are ignored rather than
    guessed at — a missing measurement is an absent feature, not a zero.
    """
    features: Dict[str, float] = {}
    measured = example_input.get("measured")
    measured = measured if isinstance(measured, Mapping) else {}

    for value in measured.get("jsonLdTypes") or []:
        if isinstance(value, str) and value:
            features[f"ld:{value}"] = 1.0

    h1 = measured.get("h1Count")
    if isinstance(h1, (int, float)):
        features["h1:many" if h1 > 1 else ("h1:one" if h1 == 1 else "h1:none")] = 1.0

    widget = measured.get("hasBookingWidget")
    if isinstance(widget, bool):
        features[f"widget:{int(widget)}"] = 1.0

    words = measured.get("wordCount")
    if isinstance(words, (int, float)):
        features[f"words:{_bucket_words(int(words))}"] = 1.0

    url = example_input.get("url")
    if isinstance(url, str):
        path = url.split("?", 1)[0].lower()
        tokens = [t for t in _TOKEN_SPLIT.findall(path) if len(t) >= 3][:8]
        for token in tokens:
            features[f"path:{token}"] = 1.0

    text = example_input.get("text")
    if isinstance(text, str):
        counts: Dict[str, float] = {}
        for token in _TOKEN_SPLIT.findall(text.lower())[:_MAX_TEXT_TOKENS]:
            if len(token) < 3:
                continue
            key, sign = _hashed_token(token)
            counts[key] = counts.get(key, 0.0) + sign
        for key, value in counts.items():
            if value:
                features[key] = round(value, 6)

    return features


# ---------------------------------------------------------------- training --


def _sigmoid(score: float) -> float:
    if score >= 0:
        return 1.0 / (1.0 + math.exp(-score))
    exp = math.exp(score)
    return exp / (1.0 + exp)


def train(
    rows: Sequence[Tuple[Dict[str, float], str]],
    *,
    epochs: int = 80,
    learning_rate: float = 0.5,
    l2: float = 0.01,
    seed: int = 1795487332,
) -> Dict[str, Any]:
    """One-vs-rest logistic regression, full-batch, deterministic.

    ``seed`` is accepted for signature stability and future SGD; the current
    solver is deterministic without it, so two runs on the same rows produce
    byte-identical weights.
    """
    if not rows:
        raise ValueError("cannot train on zero rows")

    labels = sorted({label for _, label in rows})
    if len(labels) < 2:
        raise ValueError(f"need at least two page types to train, got {labels}")

    feature_names = sorted({name for features, _ in rows for name in features})
    index = {name: position for position, name in enumerate(feature_names)}

    # Dense design matrix once — rows are sparse but small.
    matrix = [
        [features.get(name, 0.0) for name in feature_names] for features, _ in rows
    ]
    targets = [
        [1.0 if label == target else 0.0 for target in labels] for _, label in rows
    ]

    weights: Dict[str, Dict[str, float]] = {
        target: {name: 0.0 for name in feature_names} for target in labels
    }
    bias: Dict[str, float] = {target: 0.0 for target in labels}

    for _ in range(epochs):
        for position, target in enumerate(labels):
            grad = [0.0] * len(feature_names)
            grad_bias = 0.0
            column = weights[target]
            for row_position, row in enumerate(matrix):
                score = bias[target] + sum(
                    column[name] * value
                    for name, value in zip(feature_names, row)
                    if value
                )
                error = _sigmoid(score) - targets[row_position][position]
                grad_bias += error
                for feature_position, value in enumerate(row):
                    if value:
                        grad[feature_position] += error * value
            count = len(matrix)
            for name, position in index.items():
                column[name] -= learning_rate * (
                    grad[position] / count + l2 * column[name]
                )
            bias[target] -= learning_rate * grad_bias / count

    return {
        "version": MODEL_VERSION,
        "labels": labels,
        "featureNames": feature_names,
        "weights": weights,
        "bias": bias,
        "trainedRows": len(rows),
        "seed": seed,
        "hyperparameters": {
            "epochs": epochs,
            "learningRate": learning_rate,
            "l2": l2,
        },
        "trainedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace(
            "+00:00", "Z"
        ),
    }


# ------------------------------------------------------------- prediction --


def predict_proba(model: Mapping[str, Any], example_input: Mapping[str, Any]) -> Dict[str, float]:
    """Sigmoid score per label — uncalibrated, for ranking only."""
    features = extract_features(example_input)
    scores: Dict[str, float] = {}
    for label in model["labels"]:
        weights = model["weights"][label]
        score = float(model["bias"][label]) + sum(
            weight * features.get(name, 0.0) for name, weight in weights.items()
        )
        scores[label] = _sigmoid(score)
    return scores


def predict(model: Mapping[str, Any], example_input: Mapping[str, Any]) -> str:
    """Highest-scoring label; ties broken alphabetically for determinism."""
    scores = predict_proba(model, example_input)
    best_label = ""
    best_score = -1.0
    for label in sorted(scores):
        if scores[label] > best_score:
            best_label = label
            best_score = scores[label]
    return best_label


# ------------------------------------------------------------------ metrics --


def confusion_matrix(
    y_true: Sequence[str], y_pred: Sequence[str], labels: Optional[Sequence[str]] = None
) -> Dict[str, Dict[str, int]]:
    if len(y_true) != len(y_pred):
        raise ValueError("y_true and y_pred must have the same length")
    if labels is None:
        labels = sorted(set(y_true) | set(y_pred))
    matrix: Dict[str, Dict[str, int]] = {
        truth: {label: 0 for label in labels} for truth in labels
    }
    for truth, predicted in zip(y_true, y_pred):
        matrix[truth][predicted] = matrix[truth].get(predicted, 0) + 1
    return matrix


def macro_f1(y_true: Sequence[str], y_pred: Sequence[str]) -> float:
    """Unweighted mean of per-label F1 over every label seen on either side.

    Returns 0.0 for an empty input — an empty evaluation has no evidence of
    skill, and inventing a score would violate the no-invented-metrics rule.
    """
    if len(y_true) != len(y_pred):
        raise ValueError("y_true and y_pred must have the same length")
    if not y_true:
        return 0.0
    labels = sorted(set(y_true) | set(y_pred))
    scores: List[float] = []
    for label in labels:
        tp = sum(1 for t, p in zip(y_true, y_pred) if t == label and p == label)
        fp = sum(1 for t, p in zip(y_true, y_pred) if t != label and p == label)
        fn = sum(1 for t, p in zip(y_true, y_pred) if t == label and p != label)
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        scores.append(
            2 * precision * recall / (precision + recall) if precision + recall else 0.0
        )
    return sum(scores) / len(scores)


# ------------------------------------------------------------- persistence --


def save_model(model: Mapping[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(model, indent=2, sort_keys=True), encoding="utf-8")


def load_model(path: Path) -> Dict[str, Any]:
    model = json.loads(path.read_text(encoding="utf-8"))
    if model.get("version") != MODEL_VERSION:
        raise ValueError(f"unsupported model version: {model.get('version')}")
    for key in ("labels", "featureNames", "weights", "bias"):
        if key not in model:
            raise ValueError(f"model file missing {key!r}")
    return model


# -------------------------------------------------------------------- CLI --


def _load_rows(path: Path) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError as exc:
            raise SystemExit(f"{path}:{line_number}: invalid JSON: {exc}") from exc
    return rows


def _gated_training_pairs(rows: Sequence[Mapping[str, Any]]) -> List[Tuple[Dict[str, float], str]]:
    """Licence-gate every row (rules 3 and 6) and pair features with labels."""
    registry = load_registry()
    pairs: List[Tuple[Dict[str, float], str]] = []
    for position, row in enumerate(rows):
        source = str(row.get("source", ""))
        if row.get("synthetic") is True:
            raise LicenceError(
                f"row {position}: synthetic rows may not enter a train split (rule 6)"
            )
        registry.assert_trainable(source, "train")
        page_type = (row.get("output") or {}).get("pageType")
        if not isinstance(page_type, str) or not page_type:
            raise SystemExit(f"row {position}: output.pageType is required")
        example_input = row.get("input")
        if not isinstance(example_input, Mapping):
            raise SystemExit(f"row {position}: input must be an object")
        pairs.append((extract_features(example_input), page_type))
    return pairs


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Page-type classifier")
    sub = parser.add_subparsers(dest="command", required=True)

    train_parser = sub.add_parser("train", help="train a model from MlExample JSONL")
    train_parser.add_argument("--in", dest="input", required=True, type=Path)
    train_parser.add_argument("--out", required=True, type=Path)
    train_parser.add_argument("--epochs", type=int, default=80)

    eval_parser = sub.add_parser("eval", help="score a model against labelled rows")
    eval_parser.add_argument("--in", dest="input", required=True, type=Path)
    eval_parser.add_argument("--model", required=True, type=Path)

    args = parser.parse_args(list(argv) if argv is not None else None)
    rows = _load_rows(args.input)

    if args.command == "train":
        pairs = _gated_training_pairs(rows)
        model = train(pairs, epochs=args.epochs)
        save_model(model, args.out)
        print(
            f"trained on {model['trainedRows']} rows / {len(model['labels'])} page types "
            f"-> {args.out}"
        )
        return 0

    model = load_model(args.model)
    y_true: List[str] = []
    y_pred: List[str] = []
    for position, row in enumerate(rows):
        truth = (row.get("output") or {}).get("pageType")
        if not isinstance(truth, str):
            raise SystemExit(f"row {position}: output.pageType is required")
        y_true.append(truth)
        y_pred.append(predict(model, row.get("input") or {}))
    print(f"macro-F1: {macro_f1(y_true, y_pred):.4f} over {len(y_true)} rows")
    print(json.dumps(confusion_matrix(y_true, y_pred), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
