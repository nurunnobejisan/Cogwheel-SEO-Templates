"use client";

import { useMemo } from "react";
import { injectInternalLinks, type PageManifestItem } from "../../validators/internalLinker";

interface InternalLinkLabProps {
  property?: {
    name: string;
    brand: string;
    city: string;
    state: string;
    url: string;
  };
}

/**
 * Sandbox lab for `validators/internalLinker` (Phase E — validators wired).
 *
 * Deterministic: a fixed four-page manifest rooted at the property URL is run
 * through the real engine with explicit limits — every anchor, target and
 * relationship rendered below is computed by `injectInternalLinks`
 * (topical-relevance ordering, parent/child/sibling classification, one link
 * per target, never inside headings or existing links). No network, no model,
 * no invented numbers.
 */
export function InternalLinkLab({ property }: InternalLinkLabProps) {
  const result = useMemo(() => {
    const root = property?.url || "https://example.com/";
    const abs = (path: string): string => {
      try {
        return new URL(path, root).toString();
      } catch {
        return root;
      }
    };

    const manifest: PageManifestItem[] = [
      {
        url: abs("./"),
        primaryKeyword: "official site",
        secondaryTags: ["brand"],
        categoryHierarchy: ["home"],
      },
      {
        url: abs("rooms/"),
        parentPage: abs("./"),
        primaryKeyword: "guest rooms",
        approvedAnchorVariations: ["guest room"],
        secondaryTags: ["rooms", "stay"],
        categoryHierarchy: ["home", "rooms"],
      },
      {
        url: abs("suites/"),
        parentPage: abs("./"),
        primaryKeyword: "suites",
        approvedAnchorVariations: ["suite"],
        secondaryTags: ["rooms", "stay"],
        categoryHierarchy: ["home", "rooms"],
      },
      {
        url: abs("contact/"),
        parentPage: abs("./"),
        primaryKeyword: "contact us",
        secondaryTags: ["info"],
        categoryHierarchy: ["home", "contact"],
      },
    ];

    // Source page: the rooms page. The body deliberately contains each
    // target's anchor phrase in plain prose (never in the heading) so the
    // engine's guardrails are observable: the <h2> stays link-free.
    const source = manifest[1];
    const body =
      "<h2>Plan Your Stay</h2>\n" +
      "<p>Compare our guest rooms and suites, then book direct on the official site. " +
      "Questions? Contact us before arrival and our team will help you pick the right room.</p>";

    return injectInternalLinks(body, source, manifest, {
      maxLinksPerPage: 3,
      maxLinksPerTarget: 1,
    });
  }, [property]);

  const { html, report } = result;

  return (
    <div className="card-hover flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-950/60">
              <svg className="h-4 w-4 text-sky-600 dark:text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </span>
            <span className="text-body font-bold text-slate-800 dark:text-slate-100">
              Internal Link Suggestions
            </span>
          </div>
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-micro font-bold text-sky-800 dark:bg-sky-900/60 dark:text-sky-300">
            Manifest-Driven Engine
          </span>
        </div>

        <p className="text-caption text-slate-500 dark:text-slate-400 mb-3">
          Runs <code>validators/internalLinker</code> over a four-page manifest rooted at the
          property URL: topical-relevance ordering, parent/child/sibling classification, at most
          one link per target, and never a link inside headings or existing anchors.
        </p>

        <div className="rounded-xl border border-sky-200/60 bg-sky-50/40 p-3 text-caption text-slate-700 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-slate-300">
          <div className="mb-1.5 flex items-center justify-between text-tiny">
            <span className="font-semibold text-sky-900 dark:text-sky-300">
              Injected on {report.sourceUrl}
            </span>
            <span className="font-mono text-slate-600 dark:text-slate-400">
              {report.totalInjected} link{report.totalInjected === 1 ? "" : "s"}
            </span>
          </div>

          {report.links.length > 0 ? (
            <ul className="space-y-1.5">
              {report.links.map((link) => (
                <li
                  key={`${link.targetUrl}-${link.anchorText}`}
                  className="flex flex-wrap items-center justify-between gap-2 text-tiny"
                >
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    &ldquo;{link.anchorText}&rdquo; &rarr; {link.targetUrl}
                  </span>
                  <span className="rounded bg-sky-100 px-1.5 py-0.5 font-bold text-sky-800 dark:bg-sky-900/60 dark:text-sky-300">
                    {link.relationship}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-tiny text-slate-500 dark:text-slate-400">
              No anchor phrase from the manifest appeared in the source body — nothing injected.
            </p>
          )}

          {report.skippedReasons.length > 0 && (
            <p className="mt-2 text-tiny text-slate-500 dark:text-slate-400">
              Skipped: {report.skippedReasons.join("; ")}
            </p>
          )}
        </div>

        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 font-mono text-tiny text-slate-700 dark:bg-slate-950/80 dark:text-slate-300">
          {html}
        </pre>
      </div>

      <div className="mt-3 flex items-center justify-between text-tiny text-slate-400">
        <span>Deterministic engine output &bull; no network &bull; no model</span>
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">100% Offline</span>
      </div>
    </div>
  );
}
