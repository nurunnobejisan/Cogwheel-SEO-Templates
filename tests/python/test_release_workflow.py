"""Guards for the Chrome extension release workflow's safety rails."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / ".github" / "workflows" / "auto-release.yml"


def _text() -> str:
    return WORKFLOW.read_text(encoding="utf-8")


def test_release_job_is_time_bounded() -> None:
    text = _text()
    assert "timeout-minutes:" in text
    assert "cancel-in-progress: false" in text


def test_manual_release_cannot_target_a_feature_branch() -> None:
    assert "github.event_name == 'push' || github.ref == 'refs/heads/main'" in _text()


def test_manifest_version_is_validated_before_tagging() -> None:
    text = _text()
    assert "grep -Eq '^[0-9]+\\.[0-9]+\\.[0-9]+$'" in text
    assert "manifest version must be X.Y.Z" in text


def test_tag_probe_distinguishes_missing_tag_from_git_failure() -> None:
    text = _text()
    assert "git ls-remote --exit-code --tags" in text
    assert "could not check remote tags" in text


def test_packaged_artifact_is_checked_before_publishing() -> None:
    text = _text()
    assert "test -d dist" in text
    assert "test -s" in text and "seo-studio.zip" in text


def test_workflow_uses_least_privilege_permissions() -> None:
    text = _text()
    assert text.index("permissions:") < text.index("jobs:")
    assert "    permissions:\n      contents: write" in text
