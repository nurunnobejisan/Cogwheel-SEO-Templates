"""Pytest bootstrap: make the repository root importable.

The Python test-suite imports the application packages by their top-level names
(``python.*`` and ``api.*``). Adding the repository root to ``sys.path`` here
keeps ``pytest tests/python`` working without requiring ``PYTHONPATH`` or an
installed distribution.
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
