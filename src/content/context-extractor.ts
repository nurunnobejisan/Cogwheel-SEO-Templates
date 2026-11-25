export interface ExtractedImage {
  src: string;
  alt: string | null;
  hasDimensions: boolean;
  isModernFormat: boolean;
  selector: string;
}

export interface PageContext {
  url: string;
  domain: string;
  title: string;
  metaDescription: string;
  canonicalUrl: string;
  robotsMeta: string;
  openGraph: Record<string, string>;
  headings: Record<'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6', string[]>;
  jsonLdSchemas: Record<string, unknown>[];
  scriptSrcs: string[];
  hasBookingParameters: boolean;
  wordCount: number;
  bodySample: string;
  internalLinks: string[];
  externalLinks: { href: string; hasSafeRel: boolean }[];
  images: ExtractedImage[];
  navigationTiming?: PerformanceNavigationTiming;
}

export function extractPageContext(): PageContext {
  const getMeta = (selector: string): string =>
    document.querySelector<HTMLMetaElement>(selector)?.content?.trim() ?? '';

  const openGraph: Record<string, string> = {};
  document.querySelectorAll<HTMLMetaElement>('meta[property^="og:"]').forEach((el) => {
    const prop = el.getAttribute('property');
    if (prop) openGraph[prop] = el.content.trim();
  });

  const headings = {
    h1: [],
    h2: [],
    h3: [],
    h4: [],
    h5: [],
    h6: [],
  } as PageContext['headings'];
  (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const).forEach((tag) => {
    headings[tag] = Array.from(document.querySelectorAll(tag))
      .map((el) => el.textContent?.trim() ?? '')
      .filter(Boolean);
  });

  const jsonLdSchemas: Record<string, unknown>[] = [];
  document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
    try {
      const parsed = JSON.parse(script.textContent || '{}');
      if (Array.isArray(parsed)) jsonLdSchemas.push(...parsed);
      else jsonLdSchemas.push(parsed);
    } catch {
      // malformed JSON will be caught later by schema audit
    }
  });

  const scriptSrcs = Array.from(document.querySelectorAll<HTMLScriptElement>('script[src]')).map(
    (s) => s.src
  );

  // Detect booking parameters without hotel‑specific CSS classes
  const formInputs = Array.from(document.querySelectorAll('input, select')).map((el) =>
    `${el.getAttribute('name') ?? ''} ${el.getAttribute('id') ?? ''}`.toLowerCase()
  );
  const hasBookingParameters = formInputs.some((attr) =>
    /(check[-_]?in|check[-_]?out|arrival|departure|room[-_]?type)/.test(attr)
  );

  const visibleText = document.body?.innerText ?? '';
  const words = visibleText.split(/\s+/).filter(Boolean);

  const origin = window.location.origin;
  const internalLinks: string[] = [];
  const externalLinks: { href: string; hasSafeRel: boolean }[] = [];

  document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
    if (!a.href.startsWith('http')) return;
    if (a.href.startsWith(origin)) {
      internalLinks.push(a.href);
    } else {
      const rel = (a.getAttribute('rel') ?? '').toLowerCase();
      externalLinks.push({
        href: a.href,
        hasSafeRel: rel.includes('noopener') || rel.includes('noreferrer'),
      });
    }
  });

  const images: ExtractedImage[] = Array.from(document.querySelectorAll('img')).map((img, idx) => {
    const src = img.currentSrc || img.src || '';
    return {
      src,
      alt: img.hasAttribute('alt') ? img.getAttribute('alt') : null,
      hasDimensions: Boolean(img.getAttribute('width') && img.getAttribute('height')),
      isModernFormat: /\.(webp|avif)(\?|$)/i.test(src),
      selector: img.id ? `img#${img.id}` : `img:nth-of-type(${idx + 1})`,
    };
  });

  const navEntry = performance.getEntriesByType('navigation')[0] as
    | PerformanceNavigationTiming
    | undefined;

  return {
    url: window.location.href,
    domain: window.location.hostname,
    title: document.title.trim(),
    metaDescription: getMeta('meta[name="description"]'),
    canonicalUrl: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? '',
    robotsMeta: getMeta('meta[name="robots"]'),
    openGraph,
    headings,
    jsonLdSchemas,
    scriptSrcs,
    hasBookingParameters,
    wordCount: words.length,
    bodySample: words.slice(0, 400).join(' '),
    internalLinks: Array.from(new Set(internalLinks)),
    externalLinks,
    images,
    navigationTiming: navEntry,
  };
}
