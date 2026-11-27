"""Dataset cards, rendered from ``ml/sources.yaml``.

A card written by hand drifts from the registry; a card rendered from the
registry cannot. This module turns each source into a Markdown card covering
the fields the plan requires — licence, `use`, feeds, attribution duty, what
it contains, what it must never be used for — and writes them to
``docs/ml/cards/<id>.md``.

``npm run ml:cards`` regenerates them; CI checks they are current, so editing
the registry without regenerating fails the build.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Dict, List, Mapping, Sequence

__all__ = ["render_card", "render_all", "check_cards", "CARD_DIR"]

#: Where cards live. Kept under docs/ because they are documentation.
CARD_DIR = Path("docs/ml/cards")

#: The prose a card must contain, keyed by `use`. Stated as requirements so a
#: reader can tell at a glance what a source is permitted to do.
USE_RULES: Dict[str, str] = {
    "train": (
        "May enter a **train** split. No attribution duty beyond the project "
        "licence."
    ),
    "train_attribution": (
        "May enter a **train** split, but **attribution is required** in "
        "`THIRD_PARTY_NOTICES.md` and `docs/ATTRIBUTION.md`, and only the "
        "declared `feeds` may be used — never bulk text."
    ),
    "eval_only": (
        "**Evaluation only.** Never enters a train split, including as a "
        "source of training examples or distillation targets."
    ),
    "avoid": (
        "**Forbidden.** Non-commercial or research-only terms. Do not use, "
        "derive, remix or distil from it."
    ),
}


def _row(label: str, value: str) -> str:
    return f"| {label} | {value} |"


def render_card(source: Mapping[str, object]) -> str:
    """Render one dataset card as Markdown."""
    sid = str(source.get("id", ""))
    name = str(source.get("name", sid))
    licence = str(source.get("licence", "unspecified"))
    use = str(source.get("use", "avoid"))
    feeds = list(source.get("feeds") or [])
    attribution = bool(source.get("attribution_required"))
    url = str(source.get("url") or "")
    notes = str(source.get("notes") or "").strip()

    lines: List[str] = [
        f"# {name}",
        "",
        f"Source id: `{sid}`",
        "",
        "## Terms",
        "",
        "| Field | Value |",
        "|---|---|",
        _row("Licence", licence),
        _row("Permitted use", f"`{use}`"),
        _row("Attribution required", "yes" if attribution else "no"),
        _row("Feeds", ", ".join(f"`{f}`" for f in feeds) if feeds else "_none_"),
        _row("URL", url if url else "_not published_"),
        "",
        "## Rule",
        "",
        USE_RULES.get(use, "Unrecognised `use` value — see `ml/sources.yaml`."),
        "",
    ]

    if attribution:
        lines.extend(
            [
                "## Attribution",
                "",
                "This source requires attribution. Record it in both:",
                "",
                "- `THIRD_PARTY_NOTICES.md`",
                "- `docs/ATTRIBUTION.md`",
                "",
            ]
        )

    if use == "avoid":
        lines.extend(
            [
                "## Why it is excluded",
                "",
                notes or "Excluded on licence grounds; see `ml/sources.yaml`.",
                "",
                "> CI enforces this: `npm run train:validate` fails if this id "
                "appears in any train file.",
                "",
            ]
        )
    else:
        lines.extend(["## Notes", "", notes or "_no additional notes._", ""])

    lines.extend(
        [
            "---",
            "",
            "_Generated from `ml/sources.yaml` by `npm run ml:cards`. "
            "Do not edit by hand — edit the registry and regenerate._",
            "",
        ]
    )
    return "\n".join(lines)


def render_all(sources: Sequence[Mapping[str, object]]) -> Dict[str, str]:
    """Render every source to ``{filename: content}``."""
    out: Dict[str, str] = {}
    for source in sources:
        sid = str(source.get("id", ""))
        out[f"{sid}.md"] = render_card(source)
    return out


def render_index(sources: Sequence[Mapping[str, object]]) -> str:
    """Render the index page linking every card."""
    lines = [
        "# Dataset cards",
        "",
        "One card per source declared in `ml/sources.yaml`. Each states the "
        "licence, the permitted use, the feeds it may populate, and whether "
        "attribution is owed.",
        "",
        "| Source | Licence | Use | Attribution |",
        "|---|---|---|---|",
    ]
    for source in sorted(sources, key=lambda s: str(s.get("id", ""))):
        sid = str(source.get("id", ""))
        licence = str(source.get("licence", "unspecified"))
        use = str(source.get("use", ""))
        attribution = "required" if source.get("attribution_required") else "—"
        lines.append(f"| [{sid}]({sid}.md) | {licence} | `{use}` | {attribution} |")

    lines.extend(
        [
            "",
            "---",
            "",
            "_Generated from `ml/sources.yaml` by `npm run ml:cards`. "
            "Do not edit by hand._",
            "",
        ]
    )
    return "\n".join(lines)


def check_cards(sources: Sequence[Mapping[str, object]], card_dir: Path = CARD_DIR) -> List[str]:
    """Return a list of problems; empty means the cards are current."""
    problems: List[str] = []
    if not card_dir.is_dir():
        return [f"{card_dir} does not exist — run `npm run ml:cards`"]

    expected = render_all(sources)
    expected["README.md"] = render_index(sources)

    on_disk = {p.name for p in card_dir.glob("*.md")}

    for filename, content in sorted(expected.items()):
        path = card_dir / filename
        if filename not in on_disk:
            problems.append(f"missing card: {path}")
            continue
        if path.read_text(encoding="utf-8") != content:
            problems.append(f"stale card: {path} (registry changed — run `npm run ml:cards`)")

    for filename in sorted(on_disk - set(expected)):
        problems.append(f"orphan card: {card_dir / filename} (source removed from registry)")

    return problems


def _load_sources(registry_path: Path) -> List[Mapping[str, object]]:
    """Read ``ml/sources.json`` (the generated mirror) with the stdlib."""
    import json

    payload = json.loads(registry_path.read_text(encoding="utf-8"))
    sources = payload.get("sources")
    if not isinstance(sources, list):
        raise SystemExit(f"{registry_path}: `sources` must be a list")
    return [s for s in sources if isinstance(s, Mapping)]


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generate dataset cards from ml/sources.yaml")
    parser.add_argument(
        "--check",
        action="store_true",
        help="fail when cards are missing or out of date instead of writing them",
    )
    parser.add_argument(
        "--registry",
        type=Path,
        default=Path("ml/sources.json"),
        help="path to the generated registry mirror",
    )
    parser.add_argument("--out", type=Path, default=CARD_DIR, help="output directory")
    args = parser.parse_args(list(argv) if argv is not None else None)

    if not args.registry.is_file():
        print(f"❌ {args.registry} missing — run `npm run ml:sources:export`", file=sys.stderr)
        return 1

    sources = _load_sources(args.registry)

    if args.check:
        problems = check_cards(sources, args.out)
        if problems:
            print(f"❌ dataset cards are not current ({len(problems)}):", file=sys.stderr)
            for problem in problems:
                print(f"   - {problem}", file=sys.stderr)
            return 1
        print(f"✅ {len(sources)} dataset cards in sync with {args.registry}")
        return 0

    args.out.mkdir(parents=True, exist_ok=True)
    rendered = render_all(sources)
    rendered["README.md"] = render_index(sources)
    for filename, content in rendered.items():
        (args.out / filename).write_text(content, encoding="utf-8")
    print(f"Exported {len(rendered)} dataset cards to {args.out}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
