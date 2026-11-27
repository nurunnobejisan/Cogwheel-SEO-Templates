"""SEO Studio ML pipeline.

Layout (see ``ml/README.md``):

- ``ml.registry``   licence gate — the Python half of ``ml/sources.yaml``
- ``ml.collect``    sitemaps, robots, Common Crawl CDX, Lighthouse labelling
- ``ml.extract``    JSON-LD / Open Graph / meta / headings, main-content text
- ``ml.clean``      PII stripping, MinHash dedup, text normalisation
- ``ml.dataset``    WDC subsets, Wikidata entity grounding, dataset cards

Everything in here is import-safe with the root ``requirements.txt`` alone.
Optional accelerators (``trafilatura``, ``extruct``, ``datatrove``) are
imported lazily and always have a standard-library or ``bs4`` fallback, because
the CI Python job never installs ``ml/requirements-ml.txt``.
"""

__all__ = ["registry", "collect", "extract", "clean", "dataset"]
