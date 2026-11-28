#!/usr/bin/env python3
"""Find unreachable product TypeScript modules.

Walks the import graph starting from the application entry points (Next.js
app router pages/layouts/routes/middleware, the Chrome extension's background
content script and HTML page entries, and the shared TS package) and reports
every ``.ts``/``.tsx`` module under ``src/``, ``chrome-extension/src/`` and
``shared/ts/`` that nothing in the product actually imports.

Exit code is 0 when nothing is orphaned (or only allow-listed modules are)
and 1 otherwise, so this can be wired into CI as a hard gate.

Allow-listed (intentionally unreachable) modules:
  * ``src/tasks/site-crawl/prompt.ts``  (loaded dynamically by the crawl task)
  * any file whose basename matches ``*.config.*`` (build/tooling configs)
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PRODUCT_ROOTS = (ROOT / "src", ROOT / "chrome-extension" / "src", ROOT / "shared" / "ts")
EXTENSIONS = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".mts", ".cts")

IMPORT_RE = re.compile(
    r"""(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]"""
    r"""|require\(\s*['"]([^'"]+)['"]\s*\)"""
    r"""|import\(\s*['"]([^'"]+)['"]\s*\)""",
    re.MULTILINE,
)


def is_product(path: Path) -> bool:
    try:
        path.resolve().relative_to(ROOT)
    except ValueError:
        return False
    for root in PRODUCT_ROOTS:
        try:
            path.resolve().relative_to(root.resolve())
            return True
        except ValueError:
            continue
    return False


def allowlisted(path: Path) -> bool:
    rel = path.resolve().relative_to(ROOT).as_posix()
    if rel == "src/tasks/site-crawl/prompt.ts":
        return True
    if path.name.count(".") >= 2 and ".config." in path.name:
        return True
    # *.config.*  (basename contains ".config.")
    if re.search(r"\.config\.", path.name):
        return True
    return False


def resolve_specifier(spec: str, importing: Path) -> Path | None:
    if not spec:
        return None
    if spec.startswith("@/"):
        base = ROOT / "src" / spec[2:]
    elif spec.startswith("./") or spec.startswith("../"):
        base = (importing.parent / spec).resolve()
    else:
        # package / external import — not a product module
        return None

    # Direct hit (possibly with extension already present).
    candidates: list[Path] = [base]
    # Extensionless / dotted-name resolution: try appending each known extension
    # (handles `foo` -> `foo.ts` and `foo.types` -> `foo.types.ts`).
    for ext in EXTENSIONS:
        candidates.append(Path(str(base) + ext))
    if base.suffix in (".js", ".jsx", ".mjs"):
        stem = base.with_suffix("")
        for ext in (".ts", ".tsx", ".mts", ".cts"):
            candidates.append(Path(str(stem) + ext))
        candidates.append(stem / "index.ts")
        candidates.append(stem / "index.tsx")
    # directory index
    for ext in EXTENSIONS:
        candidates.append(base / ("index" + ext))

    for cand in candidates:
        if cand.is_file():
            return cand.resolve()
    return None


def extract_specifiers(path: Path) -> list[str]:
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return []
    specs: list[str] = []
    for m in IMPORT_RE.finditer(text):
        spec = m.group(1) or m.group(2) or m.group(3)
        if spec:
            specs.append(spec)
    return specs


def collect_product_files() -> set[Path]:
    files: set[Path] = set()
    for root in PRODUCT_ROOTS:
        if not root.exists():
            continue
        for p in root.rglob("*"):
            if not p.is_file():
                continue
            if p.suffix not in (".ts", ".tsx"):
                continue
            if p.name.endswith((".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx")):
                continue
            if p.name.endswith(".d.ts"):
                continue
            if any(part in {"node_modules", "dist", ".next"} for part in p.parts):
                continue
            files.add(p.resolve())
    return files


def entry_points() -> set[Path]:
    entries: set[Path] = set()

    # Next.js app router entries
    app_root = ROOT / "src" / "app"
    if app_root.exists():
        for p in app_root.rglob("*"):
            if not p.is_file():
                continue
            if p.suffix not in (".ts", ".tsx"):
                continue
            if p.name.endswith((".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx")):
                continue
            if p.name.endswith(".d.ts"):
                continue
            if p.name in {
                "page.tsx", "page.ts", "layout.tsx", "layout.ts", "loading.tsx",
                "loading.ts", "error.tsx", "error.ts", "not-found.tsx",
                "not-found.ts", "template.tsx", "template.ts", "default.tsx",
                "default.ts", "route.ts", "route.tsx", "middleware.ts",
                "instrumentation.ts", "global-error.tsx", "robots.ts", "robots.tsx",
                "sitemap.ts", "sitemap.tsx", "manifest.ts", "manifest.tsx",
                "opengraph-image.tsx", "opengraph-image.ts", "icon.tsx", "icon.ts",
                "apple-icon.tsx", "apple-icon.ts", "twitter-image.tsx",
                "twitter-image.ts",
            }:
                entries.add(p.resolve())
    # Top-level app entry points
    for name in ("middleware.ts", "instrumentation.ts"):
        p = ROOT / "src" / name
        if p.is_file():
            entries.add(p.resolve())

    # Chrome extension entries
    ext = ROOT / "chrome-extension" / "src"
    for rel in (
        "background/index.ts",
        "content/index.ts",
        "sidepanel/main.tsx",
        "popup/main.tsx",
        "options/main.tsx",
    ):
        p = ext / rel
        if p.is_file():
            entries.add(p.resolve())
    # HTML-derived entries (parse <script src="...">
    for html in (ROOT / "chrome-extension").glob("*.html"):
        try:
            text = html.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        for m in re.finditer(r'<script[^>]*\bsrc=["\']([^"\']+)["\']', text):
            src = m.group(1).lstrip("/")
            # strip leading "src/"
            if src.startswith("src/"):
                src = src[4:]
            cand = ext / src
            # resolve extensionless
            resolved = resolve_specifier("./" + src, html) if False else None
            # simpler: try direct relative to ext root
            for c in [ext / src, *([Path(str(ext / src).rsplit(".", 1)[0] + e) for e in EXTENSIONS])]:
                if c.is_file():
                    entries.add(c.resolve())
                    break

    return entries


def main() -> int:
    product_files = collect_product_files()
    visited: set[Path] = set()
    stack: list[Path] = [e for e in entry_points() if e in product_files or is_product(e)]
    # include entry points even if not in collected set (shouldn't happen)
    for e in entry_points():
        if is_product(e):
            stack.append(e)
    # dedup
    seen_stack: set[Path] = set()
    uniq: list[Path] = []
    for e in stack:
        if e not in seen_stack:
            seen_stack.add(e)
            uniq.append(e)
    stack = uniq

    while stack:
        current = stack.pop()
        if current in visited:
            continue
        if not current.is_file():
            continue
        visited.add(current)
        for spec in extract_specifiers(current):
            resolved = resolve_specifier(spec, current)
            if resolved is None:
                continue
            if not is_product(resolved):
                continue
            if resolved not in visited:
                stack.append(resolved)

    orphans = sorted(
        p for p in product_files
        if p not in visited and not allowlisted(p)
    )

    if orphans:
        print("Unreachable product TypeScript modules:")
        for p in orphans:
            print(f"  {p.relative_to(ROOT).as_posix()}")
        print(f"\n{len(orphans)} orphan(s) found.")
        return 1
    print("No unreachable product TypeScript modules (allow-list applied).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
