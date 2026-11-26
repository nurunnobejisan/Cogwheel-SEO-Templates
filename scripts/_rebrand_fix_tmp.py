#!/usr/bin/env python3
"""Second pass: fix awkward 'SEO Studio SEO…' doubles and keep SEO length budgets."""
from __future__ import annotations

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Targeted first (fix exact metadata titles to stay within 50-60 chars)
TARGETED: list[tuple[str, str]] = [
    ("SEO Studio SEO & GEO Studio — Hotel Search Engine Suite",
     "SEO & GEO Audit Studio — Hotel Search Engine Suite"),
    ("Hospitality SEO & GEO Templates — SEO Studio",
     "Hospitality SEO & GEO Templates — SEO Studio Platform"),
    ("78-Keyword Hospitality Strategy Matrix — SEO Studio Studio",
     "78-Keyword Hospitality Strategy Matrix — SEO Studio Suite"),
    ("System Architecture & Technical Specs — SEO Studio Studio",
     "System Architecture & Technical Specs — SEO Studio Suite"),
    ("JavaScript SEO Hydration Audit — SEO Studio",
     "JavaScript SEO Hydration Audit — SEO Studio Platform"),
    ("Hotel Landing Page Content Brief — SEO Studio",
     "Hotel Landing Page Content Brief — SEO Studio Platform"),
    ("Core Web Vitals Technical SEO Audit — SEO Studio Studio",
     "Core Web Vitals Technical SEO Audit — SEO Studio Suite"),
    ("Keyword Cannibalization Audit Matrix — SEO Studio Studio",
     "Keyword Cannibalization Audit Matrix — SEO Studio Suite"),
    ("Hospitality Digital PR Pitch Kit — SEO Studio Studio",
     "Hospitality Digital PR Pitch Kit — SEO Studio Suite"),
    ("Hotel Amenities Programmatic Indexing Blueprint — CW",
     "Hotel Amenities Programmatic Indexing Blueprint — SEO Studio"),
]

# Then general wording cleanup
CLEANUP: list[tuple[str, str]] = [
    ("SEO Studio SEO Studio", "SEO Studio"),
    ("SEO Studio Studio", "SEO Studio"),
    ("SEO Studio SEO &amp; GEO Studio", "SEO &amp; GEO Studio"),
    ("SEO Studio SEO & GEO Templates Studio", "SEO & GEO Templates Studio"),
    ("SEO Studio SEO & GEO Studio", "SEO & GEO Studio"),
    ("SEO Studio SEO Templates", "SEO Studio Templates"),
    ("SEO Studio SEO & Hospitality Templates Studio", "SEO Studio Hospitality Templates Suite"),
    ("SEO Studio SEO", "SEO Studio"),
]

TEXT_EXT = {
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".mdx", ".txt",
    ".yml", ".yaml", ".toml", ".py", ".css", ".scss", ".html", ".xml", ".svg",
    ".sh", ".example",
}


def tracked() -> list[Path]:
    out = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    return [ROOT / l for l in out.splitlines() if l.strip()]


def is_text(p: Path) -> bool:
    return p.suffix.lower() in TEXT_EXT or p.name in {".gitignore", ".gitattributes"} or p.name.startswith(".env")


def main() -> None:
    changed = 0
    for path in tracked():
        if not is_text(path) or not path.is_file():
            continue
        try:
            orig = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        text = orig
        for a, b in TARGETED:
            text = text.replace(a, b)
        for a, b in CLEANUP:
            text = text.replace(a, b)
        if text != orig:
            path.write_text(text, encoding="utf-8")
            changed += 1
    print(f"cleanup pass: {changed} files changed")


if __name__ == "__main__":
    main()
