"""Phase G — legacy Python scripts, dependency hygiene, GSC MCP server.

- `requirements.txt` must stay lean (the unused Flask stack is gone) and must
  declare everything `api/gsc_server.py` imports (the MCP server used to rely
  on undeclared deps, so a clean install could not run it).
- The legacy CLI scripts stay wired: every entry point answers `--help`
  without network, credentials or writes.
- The GSC MCP server imports cleanly on Python 3.11+ with its deps present
  (skipped on 3.11-less interpreters, matching the server's own fail-loudly
  rule for issue #19).
"""

import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent.parent
REQUIREMENTS = (ROOT / "requirements.txt").read_text(encoding="utf-8")

GSC_DEPS = [
    "platformdirs",
    "google-auth",
    "google-auth-oauthlib",
    "google-api-python-client",
    "mcp",
]


def _requirement_names() -> set[str]:
    names = set()
    for line in REQUIREMENTS.splitlines():
        line = line.split("#", 1)[0].strip()
        if not line:
            continue
        name = line.split("==")[0].split(">=")[0].split("<=")[0].split("[")[0].strip()
        names.add(name.lower())
    return names


def test_unused_flask_stack_is_gone() -> None:
    names = _requirement_names()
    for unused in ("flask", "flask-cors", "werkzeug"):
        assert unused not in names, f"{unused} is imported nowhere — keep it out of requirements.txt"


def test_gsc_mcp_server_deps_are_declared() -> None:
    names = _requirement_names()
    for dep in GSC_DEPS:
        assert dep in names, f"api/gsc_server.py imports {dep} — declare it in requirements.txt"


@pytest.mark.parametrize(
    "script",
    [
        "python/scripts/sync_ota_rules.py",
        "python/scripts/generate_extension_icons.py",
        "python/scripts/validate_schemas.py",
        "python/scripts/batch_portfolio_audit.py",
    ],
)
def test_legacy_cli_entry_points_answer_help(script: str) -> None:
    """Wired CLIs must start (argparse `--help`) without network or writes."""
    result = subprocess.run(
        [sys.executable, str(ROOT / script), "--help"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, f"{script} --help failed:\n{result.stdout}\n{result.stderr}"
    assert "usage:" in result.stdout.lower()


def test_gsc_mcp_server_imports() -> None:
    if sys.version_info < (3, 11):
        pytest.skip("api/gsc_server.py requires Python 3.11+ (issue #19)")
    for dep in ("mcp", "platformdirs", "google.auth", "googleapiclient"):
        pytest.importorskip(dep)
    import importlib

    module = importlib.import_module("api.gsc_server")
    assert module.mcp.name == "gsc-server"
    assert callable(module.main)
