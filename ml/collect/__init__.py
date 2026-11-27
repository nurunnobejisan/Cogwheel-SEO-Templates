"""Collection layer — sitemaps, robots, Common Crawl, Lighthouse labelling.

Everything here is stdlib-first: the CI Python job installs only the root
``requirements.txt``, so optional accelerators are imported lazily and always
have a fallback. Nothing in this package performs network I/O at import time.
"""

from . import commoncrawl, lighthouse, robots, sitemaps  # noqa: F401
from .commoncrawl import CdxQuery, CdxRecord, build_cdx_url, iter_html, parse_cdx
from .lighthouse import cross_check, labels_from_report, parse_report, to_example_input
from .robots import RobotsRules, parse_robots
from .sitemaps import ParsedSitemap, SitemapEntry, parse_sitemap

__all__ = [
    "sitemaps",
    "robots",
    "commoncrawl",
    "lighthouse",
    "parse_sitemap",
    "ParsedSitemap",
    "SitemapEntry",
    "parse_robots",
    "RobotsRules",
    "CdxQuery",
    "CdxRecord",
    "build_cdx_url",
    "parse_cdx",
    "iter_html",
    "labels_from_report",
    "cross_check",
    "parse_report",
    "to_example_input",
]
