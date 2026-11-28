"""Runner for AI visibility queries (N runs per intent x language)."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .mentions import detect_mentions, MentionResult
from .providers import Answer, Provider


@dataclass
class RunResult:
    intent_id: str
    language: str
    query: str
    provider: str
    run_index: int
    answer_text: str
    citations: list[str]
    mentions: dict[str, MentionResult]  # brand -> result
    raw_answer_path: str = ""


def run_visibility(
    provider: Provider,
    intents: list[dict],
    entities: list[dict],
    n: int = 3,
    out_dir: str | Path | None = None,
) -> list[RunResult]:
    out_dir = Path(out_dir) if out_dir else None
    if out_dir:
        out_dir.mkdir(parents=True, exist_ok=True)

    results: list[RunResult] = []
    raw_log: list[dict[str, Any]] = []

    for intent in intents:
        iid = intent["id"]
        for lang in ("en", "bn", "banglish"):
            query = intent["variants"][lang]
            for run_i in range(n):
                answer: Answer = provider.query(query)
                mentions: dict[str, MentionResult] = {}
                for ent in entities:
                    brand = ent["brand"]
                    domain = ent["domain"]
                    aliases = ent.get("aliases", {})
                    mentions[brand] = detect_mentions(answer, brand, domain, aliases)

                raw_path = ""
                if out_dir:
                    fname = f"{iid}_{lang}_run{run_i}.json"
                    (out_dir / fname).write_text(
                        json.dumps({"query": query, "answer": answer.text,
                                    "citations": answer.citations, "raw": answer.raw},
                                   ensure_ascii=False, indent=2),
                        encoding="utf-8",
                    )
                    raw_path = str(out_dir / fname)

                rr = RunResult(
                    intent_id=iid,
                    language=lang,
                    query=query,
                    provider=provider.name,
                    run_index=run_i,
                    answer_text=answer.text,
                    citations=answer.citations,
                    mentions=mentions,
                    raw_answer_path=raw_path,
                )
                results.append(rr)
                raw_log.append({
                    "intent_id": iid,
                    "language": lang,
                    "run_index": run_i,
                    "provider": provider.name,
                    "query": query,
                    "raw_answer_path": raw_path,
                })

    if out_dir:
        (out_dir / "run_log.json").write_text(
            json.dumps(raw_log, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    return results
