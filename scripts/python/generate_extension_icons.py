#!/usr/bin/env python3
"""Cogwheel SEO Studio — Extension Icon Asset Generator.

Generates multi-resolution icon assets (16x16, 32x32, 48x48, 128x128)
for the Manifest V3 Chrome Extension.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parent.parent


def create_icon(size: int) -> Any:
    """Create a brand cogwheel icon at specified pixel dimensions.

    Args:
        size: Target pixel width and height (e.g. 16, 32, 48, 128).

    Returns:
        PIL Image object if Pillow is installed, otherwise None.
    """
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        print("Pillow (PIL) is not installed. Skipping dynamic PNG creation.")
        return None

    # Slate dark background with vibrant emerald cogwheel
    img = Image.new("RGBA", (size, size), (15, 23, 42, 255))
    draw = ImageDraw.Draw(img)

    margin = max(1, int(size * 0.08))
    center = size / 2.0
    r_outer = (size - 2 * margin) / 2.0

    # Draw accent circle
    draw.ellipse(
        [center - r_outer, center - r_outer, center + r_outer, center + r_outer],
        fill=(30, 41, 59, 255),
        outline=(16, 185, 129, 255),
        width=max(1, int(size * 0.06)),
    )

    # Inner brand badge
    r_inner = r_outer * 0.65
    draw.ellipse(
        [center - r_inner, center - r_inner, center + r_inner, center + r_inner],
        fill=(16, 185, 129, 255),
    )

    # Center aperture
    r_center = r_inner * 0.4
    draw.ellipse(
        [center - r_center, center - r_center, center + r_center, center + r_center],
        fill=(255, 255, 255, 255),
    )

    return img


def generate_all_icons(output_dir: Path) -> None:
    """Generate all standard Chrome extension icon sizes.

    Args:
        output_dir: Directory where icons will be saved.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    sizes = [16, 32, 48, 128]

    for s in sizes:
        icon = create_icon(s)
        if icon:
            target_path = output_dir / f"icon{s}.png"
            icon.save(str(target_path))
            print(f"Generated icon: {target_path}")


def main() -> int:
    """CLI execution entrypoint.

    Returns:
        0 on success.
    """
    parser = argparse.ArgumentParser(description="Generate Chrome Extension icon assets.")
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT_DIR / "extension" / "icons",
        help="Target icons directory",
    )
    args = parser.parse_args()

    generate_all_icons(args.output)
    return 0


if __name__ == "__main__":
    main()
