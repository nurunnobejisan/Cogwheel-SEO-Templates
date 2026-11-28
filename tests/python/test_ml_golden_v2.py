"""Tests for WP9 Golden v2 unreviewed candidate proposer (ml/eval/propose_golden_v2.py)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml.eval import propose_golden_v2  # noqa: E402
from ml.train.build_sft import assign_host_split  # noqa: E402


def test_propose_candidates_excludes_train_and_golden_hosts_and_marks_unreviewed(tmp_path: Path) -> None:
    train_path = tmp_path / "sft-v2.jsonl"
    _, leaked_hash = assign_host_split("trained-hotel.example")
    train_path.write_text(
        json.dumps(
            {
                "messages": [
                    {"role": "system", "content": "s"},
                    {"role": "user", "content": "u"},
                    {"role": "assistant", "content": "a"},
                ],
                "meta": {"split": "train", "hostHash": leaked_hash, "domainHash": leaked_hash},
                "input": {"url": "https://trained-hotel.example/"},
            }
        )
        + "\n",
        encoding="utf-8",
    )

    source_rows = [
        # Leaked train host -> excluded
        {
            "task": "schema_generation",
            "source": "wdc-2024",
            "split": "eval",
            "input": {"url": "https://trained-hotel.example/rooms", "text": "Rooms"},
            "output": {"@context": "https://schema.org", "@type": "Hotel", "name": "Trained"},
        },
        # Frozen v1 golden host -> excluded
        {
            "task": "schema_generation",
            "source": "wdc-2024",
            "split": "eval",
            "input": {"url": "https://thenines.com/rooms", "text": "Nines"},
            "output": {"@context": "https://schema.org", "@type": "Hotel", "name": "Nines"},
        },
        # Held-out valid schema row -> proposed unreviewed
        {
            "task": "schema_generation",
            "source": "wdc-2024",
            "split": "eval",
            "input": {"url": "https://clean-heldout-1.example/", "text": "Clean Hotel"},
            "output": {"@context": "https://schema.org", "@type": "Hotel", "name": "Clean Hotel"},
        },
        # Held-out valid metadata row -> proposed unreviewed
        {
            "task": "metadata_generation",
            "source": "vault",
            "split": "eval",
            "input": {"url": "https://clean-heldout-2.example/", "text": "Clean Resort"},
            "output": {
                "title": "Clean Resort — Downtown",
                "metaDescription": "Stay at Clean Resort with waterfront rooms.",
            },
        },
        # Oversized title -> filtered out before proposing
        {
            "task": "metadata_generation",
            "source": "vault",
            "split": "eval",
            "input": {"url": "https://clean-heldout-3.example/", "text": "Long"},
            "output": {"title": "A" * 80, "metaDescription": "Short meta."},
        },
    ]

    in_path = tmp_path / "heldout.jsonl"
    out_path = tmp_path / "candidates.jsonl"
    in_path.write_text("\n".join(json.dumps(r) for r in source_rows) + "\n", encoding="utf-8")

    rc = propose_golden_v2.main(
        ["--in", str(in_path), "--out", str(out_path), "--train-file", str(train_path)]
    )
    assert rc == 0

    emitted = [json.loads(line) for line in out_path.read_text(encoding="utf-8").splitlines() if line]
    assert len(emitted) == 2
    assert all(row["humanReviewed"] is False for row in emitted)
    assert all(row["reviewStatus"] == "pending_human_review" for row in emitted)
    urls = {row["input"]["url"] for row in emitted}
    assert urls == {"https://clean-heldout-1.example/", "https://clean-heldout-2.example/"}
