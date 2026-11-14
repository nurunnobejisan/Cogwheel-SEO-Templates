/**
 * Cogwheel SEO Templates — HTML5 CMS Exporter
 * 
 * Generates standards-compliant HTML5 output with complete metadata,
 * canonical links, environment-aware robots directives, and serialized JSON-LD.
 */

export interface HtmlExportPayload {
  title: string;
  metaDescription: string;
  canonicalUrl: string;
  robotsDirective?: string;
  jsonLdScript?: string;
  bodyContent: string;
  lang?: string;
  charset?: string;
}

export interface HtmlExportOptions {
  minify?: boolean;
}

export function exportToHtml(payload: HtmlExportPayload, options: HtmlExportOptions = {}): string {
  const lang = payload.lang || "en";
  const charset = payload.charset || "UTF-8";
  const robots = payload.robotsDirective || '<meta name="robots" content="index, follow" />';
  const jsonLd = payload.jsonLdScript ? `\n    ${payload.jsonLdScript}` : "";

  let html = `<!DOCTYPE html>
<html lang="${lang}">
  <head>
    <meta charset="${charset}">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${payload.title}</title>
    <meta name="description" content="${payload.metaDescription}">
    <link rel="canonical" href="${payload.canonicalUrl}">
    ${robots}${jsonLd}
  </head>
  <body>
    ${payload.bodyContent}
  </body>
</html>`;

  if (options.minify) {
    html = html
      .replace(/\n\s+/g, "\n")
      .replace(/>\s+</g, "><")
      .trim();
  }

  return html;
}
