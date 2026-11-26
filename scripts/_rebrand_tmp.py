#!/usr/bin/env python3
"""One-off de-branding pass: SEO Studio -> SEO Studio, Nurunnobe Jisan -> Nurunnobe Jisan.

Run once, inspect `git diff`, then delete this file.
Everything that keys into persistence/infra is protected and left byte-identical.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# --- Tokens that MUST NOT change (they key into stored data / infra / integrations) ---
PROTECT: list[str] = [
    # env vars (set in Vercel / CI)
    "COGWHEEL_ALLOW_LOCAL_PYTHON",
    "COGWHEEL_ALLOW_LOCAL_MAIL_CLI",
    "COGWHEEL_API_BEARER_TOKEN",
    "COGWHEEL_API_ENDPOINT",
    "COGWHEEL_DATA_DIR",
    "COGWHEEL_GEO_STORE",
    "COGWHEEL_MAIL_ACCOUNT",
    "COGWHEEL_MAIL_CLI_PATH",
    # generated update artifact + chrome extension bundle
    "cogwheel-seo-studio.zip",
    "cogwheel-chrome-extension.zip",
    # persisted secrets / vault key / salt
    "cogwheel-dev-insecure-vault-key",
    "cogwheel-extension-secret-salt-v1",
    "cogwheel-local-dev-secret",
    # IndexedDB + runtime globals
    "CogwheelTrainingVaultDB",
    "__cogwheelPlatformRuntime__",
    # storage keys (chrome.storage / localStorage)
    "cogwheel_update_state",
    "cogwheel_theme_dark",
    "cogwheel_theme",
    "cogwheel_bookmarks",
    "cogwheel_favorite_templates",
    "cogwheel_ota_config",
    "cogwheel_extension_options_v1",
    "cogwheel_custom_model_config",
    "cogwheel_auto_update_check",
    "cogwheel_api_sync_config",
    "cogwheel_compset_override",
    "razib_active_property_v1",
    # CMS / Shopify metafields + theme entry keys
    "_cogwheel_twitter_card",
    "_cogwheel_seo_title",
    "_cogwheel_og_title",
    "_cogwheel_og_description",
    "_cogwheel_canonical_url",
    "_cogwheel_schema_json",
    "_cogwheel_meta_description",
    "__cogwheel_injected_schema__",
    "__cogwheel_preview_schema__",
    "cogwheel-wordpress-seo-entry",
    # model registry identifiers
    "cogwheel-seo-unified-tuned",
    "cogwheel-seo-unified",
    "cogwheel-seo-prod",
    "cogwheel-tuned",
    # bot user-agents + third-party / external domains (identity + real sites)
    "CogwheelSeoBot",
    "CogwheelSEOSitemapBot",
    "CogwheelImageAudit",
    "CogwheelHeadingAudit",
    "CogwheelSiteMapper",
    "CogwheelAuditor",
    "Cogwheel-Python-OTA-Sync",
    "cogwheel.ai",
    "cogwheel.hospitality",
    "cogwheel.dev",
    "cogwheel.com",
    "cogwheelmarketing.com",
    "cogwheelanalytics.com",
    "api.cogwheel-seo.com",
    "CogwheelAPI",
    "razibmarketing-hf-dnr",
    # live deployment domain (functional links must keep resolving)
    "cogwheel-seo-templates.vercel.app",
    "cogwheel-seo@example.com",
]

# --- Ordered literal replacements (applied top-down) ---
REPLACE: list[tuple[str, str]] = [
    # GitHub owner / repo
    ("nurunnobejisan", "nurunnobejisan"),
    ("nurunnobejisan", "nurunnobejisan"),
    ("SEO-Studio", "SEO-Studio"),
    ("seo-studio", "seo-studio"),
    # compound brand phrases
    ("SEO Studio", "SEO Studio"),
    ("SEO Studio", "SEO Studio"),
    # brand text
    ("NURUNNOBE JISAN", "NURUNNOBE JISAN"),
    ("Nurunnobe Jisan", "Nurunnobe Jisan"),
    ("nurunnobejisan@users.noreply.github.com", "nurunnobejisan@users.noreply.github.com"),
    ("github.com/nurunnobejisan", "github.com/nurunnobejisan"),
    ("nurunnobe-logo", "nurunnobe-logo"),
    ("Nurunnobe", "Nurunnobe"),
    ("nurunnobe", "nurunnobe"),
    # module / file stems
    ("seo_studio_auto", "seo_studio_auto"),
    # identifiers (PascalCase / camelCase / UPPER)
    ("SEO_STUDIO_TEMPLATES", "SEO_STUDIO_TEMPLATES"),
    ("SEO_STUDIO_OPTIMAL_AUDIT_DATA", "SEO_STUDIO_OPTIMAL_AUDIT_DATA"),
    ("SEO_STUDIO_CHECK_UPDATES", "SEO_STUDIO_CHECK_UPDATES"),
    ("SEO_STUDIO_SPA_HOOKS__", "SEO_STUDIO_SPA_HOOKS__"),
    ("SEO_STUDIO_MESSAGE_LISTENER__", "SEO_STUDIO_MESSAGE_LISTENER__"),
    ("seoStudioTemplates", "seoStudioTemplates"),
    ("seoStudioDataFile", "seoStudioDataFile"),
    ("seoStudioDataDir", "seoStudioDataDir"),
    ("isSeoStudio", "isSeoStudio"),
    ("SeoStudioTemplate", "SeoStudioTemplate"),
    ("SeoStudioAutoRunner", "SeoStudioAutoRunner"),
    ("SeoStudioAuto", "SeoStudioAuto"),
    ("SeoStudioContent", "SeoStudioContent"),
    ("SeoStudioUpdateSeo", "SeoStudioUpdateSeo"),
    ("SeoStudioRestoreSeo", "SeoStudioRestoreSeo"),
    ("SeoStudioProductSeo", "SeoStudioProductSeo"),
    ("SeoStudioSchemaMetafield", "SeoStudioSchemaMetafield"),
    ("SEO_Studio_Visibility_Deck_", "SEO_Studio_Visibility_Deck_"),
    ("SEO_Studio_Monthly_Visibility_Audit_", "SEO_Studio_Monthly_Visibility_Audit_"),
    ("SEO-Studio-Unified-SEO-SFT-v1", "SEO-Studio-Unified-SEO-SFT-v1"),
    # remaining blanket
    ("SEO Studio", "SEO Studio"),
    ("SEO_STUDIO_", "SEO_STUDIO_"),
    ("SEO STUDIO", "SEO STUDIO"),
    ("seo-studio", "seo-studio"),
]

TEXT_EXT = {
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".mdx", ".txt",
    ".yml", ".yaml", ".toml", ".py", ".css", ".scss", ".html", ".xml", ".svg",
    ".example", ".gitignore", ".gitattributes", ".sh", ".env", ".cfg", ".ini",
}


def tracked_files() -> list[Path]:
    out = subprocess.run(
        ["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, check=True
    ).stdout
    return [ROOT / line for line in out.splitlines() if line.strip()]


def is_text(path: Path) -> bool:
    if path.suffix.lower() in TEXT_EXT:
        return True
    # extensionless / dotfiles like .gitignore, .env.example, LICENSE
    if path.name in {".gitignore", ".gitattributes", "LICENSE", "CODEOWNERS", "Procfile"}:
        return True
    if path.name.startswith(".env"):
        return True
    return False


def main() -> int:
    changed: list[str] = []
    for path in tracked_files():
        if not is_text(path) or not path.is_file():
            continue
        try:
            original = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, PermissionError):
            continue

        text = original
        # 1. protect
        for i, token in enumerate(PROTECT):
            text = text.replace(token, f"\x00P{i}\x00")
        # 2. replace
        for src, dst in REPLACE:
            text = text.replace(src, dst)
        # 3. restore
        for i, token in enumerate(PROTECT):
            text = text.replace(f"\x00P{i}\x00", token)

        if text != original:
            path.write_text(text, encoding="utf-8")
            changed.append(str(path.relative_to(ROOT)))

    print(f"files changed: {len(changed)}")
    for c in changed:
        print(f"  {c}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
