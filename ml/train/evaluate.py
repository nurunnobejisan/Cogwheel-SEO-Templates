"""Golden-set evaluation harness for a trained adapter.

Three stages, two of them CI-safe:

1. **build requests** (stdlib) — turn every frozen golden case into a chat
   request with a deterministic, versioned prompt template. One request per
   case, keyed by the golden ``caseId``.
2. **generate** (GPU, lazy imports) — run a base model ± LoRA adapter over
   the requests and write ``{caseId, output}`` rows.
3. **score** — hand the outputs to the existing runner:
   ``python3 ml/eval/run_eval.py --outputs <file>``. Golden-set numbers in
   ``docs/ml/PROGRESS.md`` come from that command and nowhere else.

The templates ask for exactly the golden output shape per task (JSON-LD
object, metadata object, explanation + citedUrl, one label, missing entity
signals), so a generated row is scorable by the section-9 checks. Template
changes bump ``TEMPLATE_VERSION`` — scores from different template versions
are not comparable and the manifest records which one produced them.

Before/after a tune: run stage 1-3 on the *base* model (before) and on the
adapter (after), record both rows in the PROGRESS score log.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional, Sequence

from .errors import DatasetError, HeavyDepsError
from .dataset import DEFAULT_GOLDEN

__all__ = ["TEMPLATE_VERSION", "build_requests", "parse_output", "write_outputs"]

TEMPLATE_VERSION = 1

SYSTEM_PROMPT = (
    "You are SEO Studio's evaluation subject for the frozen golden set. "
    "Follow the user's instruction exactly and output only what is asked for. "
    "Never invent measured facts: use only the values supplied, and omit "
    "anything that was not provided."
)


def _page_labels(golden_path: Path) -> List[str]:
    labels = set()
    for case in _read_cases(golden_path):
        page_type = (case.get("output") or {}).get("pageType")
        if isinstance(page_type, str):
            labels.add(page_type)
    return sorted(labels)


def _read_cases(golden_path: Path) -> List[Dict[str, Any]]:
    if not golden_path.is_file():
        raise DatasetError(f"golden set not found: {golden_path}")
    cases: List[Dict[str, Any]] = []
    for line_number, line in enumerate(golden_path.read_text(encoding="utf-8").splitlines(), 1):
        line = line.strip()
        if not line:
            continue
        try:
            cases.append(json.loads(line))
        except json.JSONDecodeError as exc:
            raise DatasetError(f"{golden_path}:{line_number}: invalid JSON: {exc}") from exc
    return cases


def _user_prompt(case: Mapping[str, Any], labels: Sequence[str]) -> str:
    case_input = case.get("input") or {}
    url = case_input.get("url", "")
    page_type = case_input.get("pageType", "")
    text = str(case_input.get("text") or "")
    measured = json.dumps(case_input.get("measured") or {}, sort_keys=True)
    task = case.get("task")

    if task == "schema_generation":
        return (
            "Generate JSON-LD for this page.\n"
            f"URL: {url}\n"
            f"Page type: {page_type}\n"
            f"Measured fields: {measured}\n"
            f"Page text:\n{text}\n"
            "Output only the JSON-LD object (or array of objects), valid JSON, "
            "with @context and @type. Use only the measured values above."
        )
    if task == "metadata_generation":
        return (
            "Generate metadata for this page.\n"
            f"URL: {url}\n"
            f"Page type: {page_type}\n"
            f"Measured fields: {measured}\n"
            f"Page text:\n{text}\n"
            "Output a JSON object with keys: title (max 60 chars), "
            "metaDescription (max 160 chars), h1 (exactly one string), "
            "h2 (array of strings). Reuse only wording present in the text "
            "or measured fields."
        )
    if task == "rag_synthesis":
        findings = json.dumps(case_input.get("findings") or [], sort_keys=True)
        return (
            f"Audit findings for {url}:\n{findings}\n"
            f"Measured fields: {measured}\n"
            f"Page text:\n{text}\n"
            "Explain the highest-severity finding in plain language. Cite the "
            "source URL you rely on. Output a JSON object with keys "
            "explanation and citedUrl."
        )
    if task == "page_classification":
        return (
            "Classify this page.\n"
            f"URL: {url}\n"
            f"Measured fields: {measured}\n"
            f"Page text:\n{text}\n"
            f"Reply with exactly one label, one of: {', '.join(labels)}."
        )
    if task == "entity_gap_analysis":
        return (
            "Which GEO entity signals is this page missing?\n"
            f"URL: {url}\n"
            f"Page type: {page_type}\n"
            f"Measured fields (booleans): {measured}\n"
            f"Page text:\n{text}\n"
            "Output a JSON object with keys missingEntitySignals (array of the "
            "measured field names whose value is false), missingQuestions "
            "(array of visitor questions the page cannot answer) and "
            "suggestedFaq (array of {question, answerSource} objects where "
            "answerSource names a measured field)."
        )
    raise DatasetError(f"no prompt template for task {task!r}")


def build_requests(
    golden_path: Path = DEFAULT_GOLDEN,
) -> List[Dict[str, Any]]:
    """One deterministic request per golden case, keyed by caseId."""
    labels = _page_labels(golden_path)
    requests: List[Dict[str, Any]] = []
    seen_ids: set = set()
    for case in _read_cases(golden_path):
        case_id = case.get("id")
        if not isinstance(case_id, str) or not case_id:
            raise DatasetError("golden case without an id")
        if case_id in seen_ids:
            raise DatasetError(f"duplicate golden case id {case_id!r}")
        seen_ids.add(case_id)
        requests.append(
            {
                "caseId": case_id,
                "task": case.get("task"),
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": _user_prompt(case, labels)},
                ],
            }
        )
    return requests


def parse_output(task: str, text: str) -> Any:
    """Model text -> the output shape the section-9 checks expect.

    Falls back to the raw string when the model did not emit JSON — the
    checks then judge it honestly (an unparseable JSON-LD fails
    ``jsonld_valid`` rather than being silently coerced).
    """
    stripped = text.strip()
    if task == "page_classification":
        return stripped
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        return stripped


def write_outputs(
    rows: Sequence[Mapping[str, Any]], path: Path
) -> None:
    """Write ``{caseId, output}`` JSONL for ``ml/eval/run_eval.py --outputs``."""
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = "\n".join(json.dumps(dict(row), ensure_ascii=False, sort_keys=True) for row in rows)
    path.write_text(payload + ("\n" if payload else ""), encoding="utf-8")


def generate(
    requests: Sequence[Mapping[str, Any]],
    *,
    base_model: str,
    adapter: Optional[Path] = None,
    max_new_tokens: int = 1024,
) -> List[Dict[str, Any]]:
    """Run a model over the requests. Heavy deps imported lazily (D-014)."""
    if not requests:
        raise DatasetError("no requests to generate")
    try:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer
        from peft import PeftModel
    except ImportError as exc:
        raise HeavyDepsError() from exc

    tokenizer = AutoTokenizer.from_pretrained(base_model, trust_remote_code=False)
    model = AutoModelForCausalLM.from_pretrained(
        base_model,
        device_map="auto",
        torch_dtype=torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16,
        trust_remote_code=False,
    )
    if adapter:
        model = PeftModel.from_pretrained(model, str(adapter))
    model.eval()

    rows: List[Dict[str, Any]] = []
    for request in requests:
        input_ids = tokenizer.apply_chat_template(
            list(request["messages"]),
            add_generation_prompt=True,
            return_tensors="pt",
        ).to(model.device)
        with torch.no_grad():
            output_ids = model.generate(
                input_ids,
                max_new_tokens=max_new_tokens,
                do_sample=False,
                pad_token_id=tokenizer.pad_token_id or tokenizer.eos_token_id,
            )
        generated = output_ids[0][input_ids.shape[-1] :]
        text = tokenizer.decode(generated, skip_special_tokens=True)
        rows.append(
            {
                "caseId": request["caseId"],
                "output": parse_output(str(request.get("task") or ""), text),
                "templateVersion": TEMPLATE_VERSION,
                "baseModel": base_model,
                "adapter": str(adapter) if adapter else None,
            }
        )
    return rows


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Golden-set request builder / generator")
    parser.add_argument("--golden", type=Path, default=DEFAULT_GOLDEN)
    parser.add_argument(
        "--requests",
        type=Path,
        default=None,
        help="write request JSONL here (default action when --generate is absent)",
    )
    parser.add_argument("--generate", action="store_true", help="run a model (GPU + ML deps)")
    parser.add_argument("--base", default="Qwen/Qwen3-4B", help="base model id")
    parser.add_argument("--adapter", type=Path, default=None)
    parser.add_argument("--out", type=Path, default=None, help="outputs JSONL for run_eval")
    parser.add_argument("--max-new-tokens", type=int, default=1024)
    args = parser.parse_args(list(argv) if argv is not None else None)

    try:
        requests = build_requests(args.golden)
    except DatasetError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    digest = hashlib.sha256(
        json.dumps(requests, sort_keys=True).encode("utf-8")
    ).hexdigest()

    if not args.generate:
        target = args.requests or Path("data/golden-requests.jsonl")
        target.parent.mkdir(parents=True, exist_ok=True)
        payload = "\n".join(json.dumps(r, ensure_ascii=False, sort_keys=True) for r in requests)
        target.write_text(payload + "\n", encoding="utf-8")
        print(
            f"wrote {len(requests)} requests -> {target} "
            f"(template v{TEMPLATE_VERSION}, sha256 {digest[:16]}...)"
        )
        print(
            "next: python3 ml/train/evaluate.py --generate --requests "
            f"{target} --base {args.base} --out <run>-outputs.jsonl, then "
            "python3 ml/eval/run_eval.py --outputs <run>-outputs.jsonl"
        )
        return 0

    if args.out is None:
        print("error: --generate requires --out <run>-outputs.jsonl", file=sys.stderr)
        return 1
    try:
        rows = generate(
            requests,
            base_model=args.base,
            adapter=args.adapter,
            max_new_tokens=args.max_new_tokens,
        )
    except HeavyDepsError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    write_outputs(rows, args.out)
    print(f"generated {len(rows)} outputs -> {args.out}")
    print(f"score: python3 ml/eval/run_eval.py --outputs {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
