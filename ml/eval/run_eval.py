"""Golden-set evaluation runner — the section-9 checks as code.

Runs the checks declared by each golden case (``docs/ml/PROGRESS.md``
section 9) against model outputs:

    python3 ml/eval/run_eval.py                      # load + structure only
    python3 ml/eval/run_eval.py --model model.json   # + classifier_macro_f1
    python3 ml/eval/run_eval.py --outputs run.jsonl  # + output-based checks

Rules this runner obeys:

- **Nothing is invented.** A check with no inputs is ``skipped`` (or
  ``pending`` for ``human_review``), never ``passed``. ``classifier_macro_f1``
  is *reported* — there is no default threshold; release gating numbers are
  recorded in ``docs/ml/PROGRESS.md`` from real runs only.
- **Exit code 1 only on a genuine failure** of a check that had its inputs.
- Grounding haystacks are ``input.text``, ``input.measured`` and
  ``input.findings`` (measured audit findings are measured facts by the same
  rule); citation URLs are exempt from grounding and judged by
  ``explainer_citation`` instead; closed vocabularies (schema.org types, GEO
  signal names, priority enums) are labels, not facts, so they count as
  grounded.

Standard library only (D-014).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml.retrieve.classifier import (  # noqa: E402
    confusion_matrix,
    load_model,
    macro_f1,
    predict,
)

DEFAULT_GOLDEN = Path("ml/eval/golden/cases.jsonl")

ALL_CHECKS = (
    "jsonld_valid",
    "grounding",
    "invented_metrics",
    "title_budget",
    "classifier_macro_f1",
    "explainer_citation",
    "human_review",
)

#: Output-row fields aggregated into ``outputsMeta`` (Phase 5): provenance of
#: *what generated* the outputs — never a score.
OUTPUT_META_FIELDS = (
    "templateVersion",
    "baseModel",
    "adapter",
    "endpoint",
    "requestedModel",
)

#: Schema.org types loaded from the single shared JSON list consumed by both
#: Python eval and the TypeScript runtime output gate (`schemas/known-schema-types.json`).
KNOWN_SCHEMA_TYPES_PATH = REPO_ROOT / "schemas" / "known-schema-types.json"
KNOWN_SCHEMA_TYPES = frozenset(
    json.loads(KNOWN_SCHEMA_TYPES_PATH.read_text(encoding="utf-8"))
)

#: Priority / severity vocabularies — closed enums, not facts.
ENUM_LABELS = frozenset(
    {"high", "medium", "low", "none", "critical", "info", "warning", "pass", "fail"}
)

GEO_SIGNAL_LABELS = frozenset(
    {
        "geo", "streetAddress", "addressLocality", "addressRegion", "postalCode",
        "sameAs", "openingHours", "numberOfRooms", "amenityFeature", "petsAllowed",
        "telephone", "email", "priceRange", "currenciesAccepted", "paymentAccepted",
    }
)

#: Metric phrases that would be invented claims without provenance "measured".
METRIC_PATTERNS: Tuple[Tuple[str, "re.Pattern[str]"], ...] = (
    ("ranking", re.compile(r"\brank(?:ing)?s?\s*(?:of|#|:)?\s*\d{1,3}\b", re.I)),
    ("position", re.compile(r"\bposition\s*[:#]?\s*\d{1,3}\b", re.I)),
    ("search volume", re.compile(r"\bsearch(?:es)?\s+volume\b|\b\d[\d,]*\s+searches\b", re.I)),
    ("CPC", re.compile(r"\bCPC\b|\bcost[- ]per[- ]click\b", re.I)),
    ("traffic", re.compile(r"\btraffic\b[^.\n]{0,24}\b\d[\d,.]*k?\b", re.I)),
    (
        "visits",
        re.compile(r"\b\d[\d,.]*k?\s+(?:monthly\s+)?(?:visits|visitors|sessions|clicks)\b", re.I),
    ),
    ("citations", re.compile(r"\b\d+\s+(?:AI\s+)?citations?\b", re.I)),
    ("keyword volume", re.compile(r"\bkeyword(?:s)?\s+(?:volume|difficulty)\b", re.I)),
    ("domain rating", re.compile(r"\b(?:domain rating|DR)\s*[:#]?\s*\d{1,3}\b", re.I)),
)


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_jsonl(path: Path) -> List[Dict[str, Any]]:
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


def leaf_strings(value: Any) -> Iterable[str]:
    """Every string leaf in a nested structure (values only, not keys)."""
    if isinstance(value, str):
        yield value
    elif isinstance(value, Mapping):
        for item in value.values():
            yield from leaf_strings(item)
    elif isinstance(value, (list, tuple)):
        for item in value:
            yield from leaf_strings(item)


def is_citation_url(value: str) -> bool:
    return value.startswith(("http://", "https://"))


#: URLs embedded anywhere inside a longer string ("See https://... for more").
_URL_RE = re.compile(r"https?://[^\s)\]}\"'<>]+")

#: Tokens skipped when checking grounding — glue words that carry no claim.
_GROUNDING_STOPWORDS = frozenset(
    {
        "and", "the", "for", "with", "that", "this", "from", "are", "was", "were",
        "you", "your", "our", "not", "but", "can", "all", "any", "has", "have",
        "will", "who", "what", "when", "where", "how", "why", "its", "into",
        "than", "then", "them", "they", "his", "her", "she", "him", "out", "get",
        "use", "used", "using", "via", "per", "one", "two", "new", "top", "also",
        "more", "most", "much", "many", "such", "only", "just", "over", "each",
    }
)

#: Words (3+ chars) and numbers — every one must appear in the input.
_GROUNDING_TOKEN_RE = re.compile(r"[a-z0-9_]+(?:[.'-][a-z0-9_]+)*")


def grounding_tokens(value: str) -> List[str]:
    """Content tokens that must be traceable to the input.

    Exact-substring grounding would reject any legitimately rephrased
    sentence, so a value is grounded when every content token (numbers
    included — an untraceable number is exactly what rule 2 forbids) appears
    in the input haystack. Stopwords are glue, not claims, and are ignored.
    """
    tokens: List[str] = []
    for token in _GROUNDING_TOKEN_RE.findall(value.lower()):
        if token.isdigit():
            tokens.append(token)
        elif len(token) >= 3 and token not in _GROUNDING_STOPWORDS:
            tokens.append(token)
    return tokens


def cited_urls(output: Any) -> List[str]:
    """Every http(s) URL mentioned anywhere in the output."""
    urls: List[str] = []
    for value in leaf_strings(output):
        for match in _URL_RE.findall(value):
            urls.append(match.rstrip(".,;:!"))
    return urls


# ------------------------------------------------------------------ checks --


def check_jsonld_valid(output: Any) -> Tuple[str, str]:
    """Pass: parses as JSON-LD with an @context and known schema.org @type(s)."""
    document = output
    if isinstance(document, str):
        try:
            document = json.loads(document)
        except json.JSONDecodeError as exc:
            return "fail", f"output is not valid JSON: {exc}"
    if isinstance(document, list):
        if not document:
            return "fail", "empty JSON-LD array"
        documents = document
    elif isinstance(document, Mapping):
        documents = [document]
    else:
        return "fail", f"expected an object or array, got {type(document).__name__}"

    for entry in documents:
        if not isinstance(entry, Mapping):
            return "fail", "JSON-LD entry is not an object"
        if "@context" not in entry:
            return "fail", "missing @context"
        raw_type = entry.get("@type") or (
            entry.get("@graph") and None
        )
        if raw_type is None:
            # A bare @graph wrapper: validate the first typed node.
            graph = entry.get("@graph")
            types: List[str] = []
            if isinstance(graph, list):
                for node in graph:
                    if isinstance(node, Mapping) and isinstance(node.get("@type"), str):
                        types.append(node["@type"])
            if not types:
                return "fail", "no @type found on the object or its @graph"
        else:
            types = [raw_type] if isinstance(raw_type, str) else [
                t for t in raw_type if isinstance(t, str)
            ]
            if not types:
                return "fail", "@type is not a string or list of strings"
        unknown = [t for t in types if t not in KNOWN_SCHEMA_TYPES]
        if unknown:
            return "fail", f"unknown schema.org type(s): {', '.join(sorted(unknown))}"
    return "pass", "valid JSON-LD with known schema.org types"


def check_grounding(output: Any, case_input: Mapping[str, Any]) -> Tuple[str, str]:
    """Pass: every content token in the output appears in the input.

    Haystacks are ``input.text``, ``input.measured`` and ``input.findings``
    (measured audit findings are measured facts by the same rule). Citation
    URLs are exempt — they are judged by ``explainer_citation`` — and closed
    vocabularies (schema.org types, GEO signal names, priority enums) are
    labels, not facts, so they count as grounded.
    """
    text = str(case_input.get("text") or "")
    measured = json.dumps(case_input.get("measured") or {}, sort_keys=True)
    findings = json.dumps(case_input.get("findings") or [], sort_keys=True)
    haystack = f"{text}\n{measured}\n{findings}".lower()

    ungrounded: List[str] = []
    for value in leaf_strings(output):
        if not value.strip():
            continue
        if is_citation_url(value):
            continue  # judged by explainer_citation, not grounding
        if value in ENUM_LABELS or value in GEO_SIGNAL_LABELS:
            continue
        if value in KNOWN_SCHEMA_TYPES:
            continue
        if value.lower() in haystack:
            continue  # exact match — the strongest form
        # Citation URLs inside a sentence are judged by explainer_citation;
        # only the prose around them needs tracing.
        prose = _URL_RE.sub(" ", value)
        tokens = grounding_tokens(prose)
        if not tokens or all(token in haystack for token in tokens):
            continue
        ungrounded.append(value)

    if ungrounded:
        sample = "; ".join(repr(v[:60]) for v in ungrounded[:3])
        return "fail", f"{len(ungrounded)} value(s) not traceable to the input: {sample}"
    return "pass", "every value traces to the input"


def check_invented_metrics(output: Any, case: Mapping[str, Any]) -> Tuple[str, str]:
    """Pass: no ranking/volume/CPC/traffic/citation number unless measured."""
    if case.get("provenance") == "measured":
        return "pass", "case provenance is measured — metric references allowed"

    hits: List[str] = []
    for value in leaf_strings(output):
        for label, pattern in METRIC_PATTERNS:
            match = pattern.search(value)
            if match:
                hits.append(f"{label}: {match.group(0)!r}")
    if hits:
        return "fail", "metric-like claims without measured provenance: " + "; ".join(hits[:4])
    return "pass", "no metric-like claims found"


def check_title_budget(output: Mapping[str, Any]) -> Tuple[str, str]:
    """Pass: title ≤ 60, description ≤ 160, exactly one H1 (fields present)."""
    if not isinstance(output, Mapping):
        return "fail", "expected an object output"
    checked = 0
    problems: List[str] = []

    title = output.get("title")
    if isinstance(title, str):
        checked += 1
        if len(title) > 60:
            problems.append(f"title is {len(title)} chars (max 60)")

    description = output.get("metaDescription") or output.get("description")
    if isinstance(description, str):
        checked += 1
        if len(description) > 160:
            problems.append(f"description is {len(description)} chars (max 160)")

    if "h1" in output:
        checked += 1
        h1 = output["h1"]
        if isinstance(h1, list):
            count = len(h1)
        else:
            count = 1 if isinstance(h1, str) and h1.strip() else 0
        if count != 1:
            problems.append(f"expected exactly one H1, found {count}")

    if checked == 0:
        return "skipped", "output declares none of title/metaDescription/h1"
    if problems:
        return "fail", "; ".join(problems)
    return "pass", f"{checked} budget field(s) within limits"


def check_explainer_citation(
    output: Any,
    case_input: Mapping[str, Any],
    retrieved_urls: Optional[Sequence[str]] = None,
) -> Tuple[str, str]:
    """Pass: the explanation cites a retrieved source URL (not just the page).

    URLs are extracted from anywhere in the output (a sentence like
    ``See https://... for details`` counts), stripped of trailing punctuation.
    """
    page_url = str(case_input.get("url") or "").rstrip(".,;:)")
    cited = [url for url in cited_urls(output)]

    if not cited:
        return "fail", "no URL cited anywhere in the output"

    if retrieved_urls:
        known = {u.strip().rstrip(".,;:)") for u in retrieved_urls}
        if any(url in known for url in cited):
            return "pass", "cites a retrieved source URL"
        return "fail", "cited URL is not in the retrieved set"

    external = [url for url in cited if url != page_url]
    if external:
        return "pass", "cites a source URL beyond the audited page"
    return "fail", "only the audited page URL is cited — no retrieved source"


# ------------------------------------------------------------- aggregation --


def run(
    golden_path: Path,
    outputs_path: Optional[Path] = None,
    model_path: Optional[Path] = None,
) -> Dict[str, Any]:
    cases = load_jsonl(golden_path)
    outputs: Dict[str, Dict[str, Any]] = {}
    if outputs_path:
        for row in load_jsonl(outputs_path):
            case_id = row.get("caseId")
            if not isinstance(case_id, str):
                raise SystemExit(f"{outputs_path}: every output needs a `caseId`")
            outputs[case_id] = row

    model = load_model(model_path) if model_path else None

    # Provenance of the outputs file (additive, Phase 5): which template,
    # base model, adapter or endpoint produced these rows — never a score.
    outputs_meta: Dict[str, List[Any]] = {}
    for row in outputs.values():
        for field in OUTPUT_META_FIELDS:
            value = row.get(field)
            if value is None:
                continue
            values = outputs_meta.setdefault(field, [])
            if value not in values:
                values.append(value)

    results: List[Dict[str, Any]] = []
    failures: List[Dict[str, str]] = []
    y_true: List[str] = []
    y_pred: List[str] = []

    def record(case_id: str, check: str, status: str, detail: str) -> None:
        results.append(
            {"caseId": case_id, "check": check, "status": status, "detail": detail}
        )
        if status == "fail":
            failures.append({"caseId": case_id, "check": check, "detail": detail})

    for case in cases:
        case_id = str(case.get("id", "?"))
        checks = case.get("checks") or []
        output_row = outputs.get(case_id)
        output = output_row.get("output") if output_row else None
        retrieved = output_row.get("retrievedUrls") if output_row else None

        for check in checks:
            if check not in ALL_CHECKS:
                record(case_id, check, "fail", "unknown check declared by the case")
                continue

            if check == "human_review":
                record(case_id, check, "pending", "operator sign-off required")
                continue

            if check == "classifier_macro_f1":
                if model is None:
                    record(case_id, check, "skipped", "no --model provided")
                    continue
                truth = (case.get("output") or {}).get("pageType")
                if not isinstance(truth, str):
                    record(case_id, check, "fail", "golden case has no output.pageType")
                    continue
                y_true.append(truth)
                y_pred.append(predict(model, case.get("input") or {}))
                record(case_id, check, "scored", f"predicted {y_pred[-1]}")
                continue

            if output is None:
                record(case_id, check, "skipped", "no model output for this case")
                continue

            if check == "jsonld_valid":
                status, detail = check_jsonld_valid(output)
            elif check == "grounding":
                status, detail = check_grounding(output, case.get("input") or {})
            elif check == "invented_metrics":
                status, detail = check_invented_metrics(output, case)
            elif check == "title_budget":
                status, detail = check_title_budget(output)
            elif check == "explainer_citation":
                status, detail = check_explainer_citation(
                    output, case.get("input") or {}, retrieved
                )
            else:  # pragma: no cover - ALL_CHECKS is exhaustive above
                status, detail = "fail", "check has no implementation"
            record(case_id, check, status, detail)

    summary: Dict[str, int] = {}
    for result in results:
        summary[result["status"]] = summary.get(result["status"], 0) + 1

    classifier_report: Optional[Dict[str, Any]] = None
    if y_true:
        classifier_report = {
            "rows": len(y_true),
            "macroF1": round(macro_f1(y_true, y_pred), 4),
            "confusionMatrix": confusion_matrix(y_true, y_pred),
        }

    return {
        "golden": str(golden_path),
        "goldenSha256": sha256_file(golden_path),
        "cases": len(cases),
        "outputsProvided": len(outputs),
        "model": str(model_path) if model_path else None,
        "outputsMeta": outputs_meta or None,
        "summary": summary,
        "classifier": classifier_report,
        "failures": failures,
        "results": results,
        "generatedAt": datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z"),
    }


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Run the golden-set evaluation checks")
    parser.add_argument("--golden", type=Path, default=DEFAULT_GOLDEN)
    parser.add_argument("--outputs", type=Path, default=None)
    parser.add_argument("--model", type=Path, default=None)
    parser.add_argument("--out", type=Path, default=None, help="write the JSON report here")
    args = parser.parse_args(list(argv) if argv is not None else None)

    report = run(args.golden, args.outputs, args.model)

    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")

    print(f"golden : {report['golden']} (sha256 {report['goldenSha256'][:16]}…)")
    model = report["model"] or "none"
    print(f"cases  : {report['cases']} | outputs: {report['outputsProvided']} | model: {model}")
    print(f"summary: {json.dumps(report['summary'], sort_keys=True)}")
    if report["classifier"]:
        rows = report["classifier"]["rows"]
        f1 = report["classifier"]["macroF1"]
        print(f"classifier macro-F1: {f1} over {rows} rows")
    for failure in report["failures"]:
        case_id = failure["caseId"][:12]
        print(f"  ✗ {case_id}… [{failure['check']}] {failure['detail']}", file=sys.stderr)

    if report["failures"]:
        print(f"❌ {len(report['failures'])} check failure(s)")
        return 1
    print("✅ no check failures (skipped/pending checks are not passes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
