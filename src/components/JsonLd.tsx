/** Minimal server-safe JSON-LD emitter for page-level structured data. */

type Schema = Record<string, unknown>;

export function JsonLd({ data }: { data: Schema | Schema[] }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
