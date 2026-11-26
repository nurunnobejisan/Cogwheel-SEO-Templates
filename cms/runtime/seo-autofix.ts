/**
 * Universal Fallback Runtime — `seo-autofix.js` (Phase 3)
 *
 * A dependency-free (< 4KB) client-side engine for platforms with restricted
 * write APIs (Webflow, Wix, custom architectures). Injected as a single async
 * script tag, it fetches the patch configuration for the active URL from the
 * API edge and overrides missing/incorrect titles, meta tags and JSON-LD in the
 * DOM before crawlers render the page.
 *
 * This module *generates* the runtime and its embed snippet; serve the output
 * from your CDN/edge.
 */

export const SEO_AUTOFIX_VERSION = "1.0.0";
/** Hard budget for the generated runtime, per the roadmap. */
export const SEO_AUTOFIX_MAX_BYTES = 4096;

export interface RuntimePatchConfig {
  url: string;
  clientId: string;
  title?: string;
  metaDescription?: string;
  canonical?: string;
  robots?: string;
  viewport?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  og?: Record<string, string>;
  twitter?: Record<string, string>;
  updatedAt: string;
}

export interface SeoAutofixScriptOptions {
  /** API edge base, e.g. "https://cdn.platform.com". */
  apiBase: string;
  /** Optional attribute name override for the client id. */
  clientIdAttribute?: string;
}

/**
 * Generate the minified runtime. It is written as a self-invoking function that
 * discovers its own <script> tag via document.currentScript.
 */
export function buildSeoAutofixScript(options: SeoAutofixScriptOptions): string {
  const apiBase = options.apiBase.replace(/\/+$/, "");
  const attr = options.clientIdAttribute ?? "data-client-id";
  // Kept intentionally compact + ES5-safe so it runs in any crawler sandbox.
  return (
    `/* SEO Studio Auto-Fix Runtime v${SEO_AUTOFIX_VERSION} */` +
    `(function(){` +
    `var s=document.currentScript||document.querySelector('script[${attr}]');` +
    `if(!s)return;` +
    `var cid=s.getAttribute('${attr}');if(!cid)return;` +
    `var u=location.href;` +
    `var base='${apiBase}';` +
    `function setMeta(k,v){var m=document.head.querySelector('meta['+k+']');` +
    `if(!m){m=document.createElement('meta');` +
    `var i=k.indexOf('=');var n=k.slice(0,i);var val=k.slice(i+1).replace(/["']/g,'');` +
    `m.setAttribute(n,val);document.head.appendChild(m);}m.setAttribute('content',v);}` +
    `function setLink(rel,href){var l=document.head.querySelector('link[rel="'+rel+'"]');` +
    `if(!l){l=document.createElement('link');l.setAttribute('rel',rel);document.head.appendChild(l);}l.setAttribute('href',href);}` +
    `function setJsonLd(j){document.querySelectorAll('script[type="application/ld+json"][data-seo-studio]').forEach(function(n){n.remove();});` +
    `var a=Array.isArray(j)?j:[j];a.forEach(function(o){var t=document.createElement('script');` +
    `t.type='application/ld+json';t.setAttribute('data-seo-studio','1');` +
    `t.textContent=JSON.stringify(o);document.head.appendChild(t);});}` +
    `function apply(p){if(!p)return;` +
    `if(p.title)document.title=p.title;` +
    `if(p.metaDescription)setMeta('name="description"',p.metaDescription);` +
    `if(p.canonical)setLink('canonical',p.canonical);` +
    `if(p.robots)setMeta('name="robots"',p.robots);` +
    `if(p.viewport)setMeta('name="viewport"',p.viewport);` +
    `if(p.og)Object.keys(p.og).forEach(function(k){setMeta('property="'+k+'"',p.og[k]);});` +
    `if(p.twitter)Object.keys(p.twitter).forEach(function(k){setMeta('name="'+k+'"',p.twitter[k]);});` +
    `if(p.jsonLd)setJsonLd(p.jsonLd);}` +
    `try{fetch(base+'/v1/seo-patches?clientId='+encodeURIComponent(cid)+'&url='+encodeURIComponent(u),` +
    `{credentials:'omit'}).then(function(r){return r.ok?r.json():null;})` +
    `.then(function(d){if(d)apply(d.config||d);}).catch(function(){});}catch(e){}` +
    `})();`
  );
}

/** Byte length of a generated script (UTF-8). */
export function measureScriptBytes(script: string): number {
  return Buffer.byteLength(script, "utf8");
}

/**
 * The embed snippet recommended in the roadmap: a single async script tag with
 * the public client id.
 */
export function buildSeoAutofixSnippet(params: {
  clientId: string;
  cdn?: string;
}): string {
  const cdn = (params.cdn ?? "https://cdn.platform.com").replace(/\/+$/, "");
  return [
    "<!-- SEO Auto-Fix Universal Dynamic Runtime -->",
    "<script",
    `  src="${cdn}/v1/seo-autofix.js"`,
    `  data-client-id="${params.clientId}"`,
    "  async>",
    "</script>",
  ].join("\n");
}
