export interface MockNode {
  tagName: string;
  attrs: Record<string, string>;
  textContent: string;
  children: MockNode[];
  parent?: MockNode;
  shadowRoot?: MockNode | null;
  isRemoved?: boolean;
  contentDocument?: Document | null;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  remove(): void;
  cloneNode(deep?: boolean): MockNode;
  querySelectorAll(selector: string): MockNode[];
  querySelector(selector: string): MockNode | null;
  attachShadow?(init: { mode: "open" | "closed" }): MockNode;
}

export function createMockElement(tag: string, attrs: Record<string, string> = {}, text = ""): MockNode {
  const el: MockNode = {
    tagName: tag.toUpperCase(),
    attrs: { ...attrs },
    textContent: text,
    children: [],
    getAttribute(name: string) {
      const lower = name.toLowerCase();
      for (const [k, v] of Object.entries(this.attrs)) {
        if (k.toLowerCase() === lower) return v;
      }
      return null;
    },
    setAttribute(name: string, value: string) {
      this.attrs[name] = value;
    },
    remove() {
      this.isRemoved = true;
      if (this.parent) {
        this.parent.children = this.parent.children.filter((c) => c !== this);
      }
    },
    cloneNode(deep = true): MockNode {
      const cloned = createMockElement(this.tagName, { ...this.attrs }, this.textContent);
      if (deep) {
        cloned.children = this.children
          .filter((c) => !c.isRemoved)
          .map((c) => {
            const childClone = c.cloneNode(true);
            childClone.parent = cloned;
            return childClone;
          });
      }
      Object.defineProperty(cloned, "textContent", {
        get() {
          if (this.children.length === 0) return this._rawText || "";
          return this.children
            .filter((c: MockNode) => !c.isRemoved)
            .map((c: MockNode) => c.textContent)
            .join(" ");
        },
        set(v: string) {
          this._rawText = v;
        },
      });
      (cloned as any)._rawText = this.textContent;
      return cloned;
    },
    attachShadow(init: { mode: "open" | "closed" }): MockNode {
      const shadow = createMockElement("#shadow-root");
      shadow.parent = this;
      (shadow as any).mode = init.mode;
      this.shadowRoot = shadow;
      return shadow;
    },
    querySelectorAll(selector: string): MockNode[] {
      const matches: MockNode[] = [];
      const parts = selector.split(",").map((s) => s.trim());

      const testSingle = (node: MockNode, sel: string): boolean => {
        if (node.isRemoved) return false;
        if (sel === "*") return true;
        if (sel === '[aria-hidden="true"]') return node.getAttribute("aria-hidden") === "true";
        if (sel === "[hidden]") return node.getAttribute("hidden") !== null;
        if (sel.startsWith("#")) {
          return node.getAttribute("id") === sel.slice(1);
        }
        if (sel.startsWith(".")) {
          const cls = sel.slice(1);
          return (node.getAttribute("class") || "").split(/\s+/).includes(cls);
        }
        if (sel.includes("[")) {
          const match = sel.match(/^([a-z0-9_-]+)?\[([a-z0-9_-]+)(?:="([^"]*)")?\]/i);
          if (match) {
            const [, sTag, attr, val] = match;
            if (sTag && node.tagName.toLowerCase() !== sTag.toLowerCase()) return false;
            const actual = node.getAttribute(attr);
            if (val !== undefined) return actual === val;
            return actual !== null;
          }
        }
        return node.tagName.toLowerCase() === sel.toLowerCase();
      };

      const testNode = (node: MockNode): boolean => parts.some((p) => testSingle(node, p));

      const traverse = (node: MockNode) => {
        for (const child of node.children) {
          if (child.isRemoved) continue;
          if (testNode(child)) matches.push(child);
          traverse(child);
        }
      };
      traverse(this);
      return matches;
    },
    querySelector(selector: string): MockNode | null {
      const res = this.querySelectorAll(selector);
      return res.length > 0 ? res[0] : null;
    },
  };
  return el;
}

export function createMockDocument(html: string, url = "https://example.com"): Document {
  const root = createMockElement("html");
  const head = createMockElement("head");
  const body = createMockElement("body");
  head.parent = root;
  body.parent = root;
  root.children.push(head, body);

  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  const titleText = titleMatch ? titleMatch[1].trim() : "";
  if (titleMatch) {
    const titleEl = createMockElement("title", {}, titleText);
    titleEl.parent = head;
    head.children.push(titleEl);
  }

  const metaRegex = /<meta\s+([^>]+)>/gi;
  let m: RegExpExecArray | null;
  while ((m = metaRegex.exec(html)) !== null) {
    const attrStr = m[1];
    const attrs: Record<string, string> = {};
    const attrRegex = /([a-z0-9:_-]+)="([^"]*)"/gi;
    let am: RegExpExecArray | null;
    while ((am = attrRegex.exec(attrStr)) !== null) {
      attrs[am[1]] = am[2];
    }
    const metaEl = createMockElement("meta", attrs);
    metaEl.parent = head;
    head.children.push(metaEl);
  }

  const linkRegex = /<link\s+([^>]+)>/gi;
  while ((m = linkRegex.exec(html)) !== null) {
    const attrStr = m[1];
    const attrs: Record<string, string> = {};
    const attrRegex = /([a-z0-9_-]+)="([^"]*)"/gi;
    let am: RegExpExecArray | null;
    while ((am = attrRegex.exec(attrStr)) !== null) {
      attrs[am[1]] = am[2];
    }
    const linkEl = createMockElement("link", attrs);
    linkEl.parent = head;
    head.children.push(linkEl);
  }

  const scriptRegex = /<script\s*([^>]*)>([\s\S]*?)<\/script>/gi;
  while ((m = scriptRegex.exec(html)) !== null) {
    const attrStr = m[1] || "";
    const scriptContent = m[2];
    const attrs: Record<string, string> = {};
    const attrRegex = /([a-z0-9:_-]+)="([^"]*)"/gi;
    let am: RegExpExecArray | null;
    while ((am = attrRegex.exec(attrStr)) !== null) {
      attrs[am[1]] = am[2];
    }
    const scriptEl = createMockElement("script", attrs, scriptContent);
    scriptEl.parent = head;
    head.children.push(scriptEl);
  }

  // Parse Main container if present
  let mainEl: MockNode | null = null;
  const mainMatch = html.match(/<main([^>]*)>([\s\S]*?)<\/main>/i);
  if (mainMatch) {
    const attrStr = mainMatch[1];
    const mainAttrs: Record<string, string> = {};
    const attrRegex = /([a-z0-9:_-]+)="([^"]*)"/gi;
    let am: RegExpExecArray | null;
    while ((am = attrRegex.exec(attrStr)) !== null) {
      mainAttrs[am[1]] = am[2];
    }
    mainEl = createMockElement("main", mainAttrs);
    mainEl.parent = body;
    body.children.push(mainEl);

    // Parse elements inside main
    const tagRegex = /<([a-z0-9_-]+)([^>]*)>([\s\S]*?)<\/\1>|<(input|img|br|hr)\s*([^>]*)\/?>/gi;
    let tm: RegExpExecArray | null;
    while ((tm = tagRegex.exec(mainMatch[2])) !== null) {
      const tag = tm[1] || tm[4];
      const tagAttrs: Record<string, string> = {};
      const aStr = tm[2] || tm[5] || "";
      while ((am = attrRegex.exec(aStr)) !== null) {
        tagAttrs[am[1]] = am[2];
      }
      const text = (tm[3] || "").replace(/<[^>]+>/g, "").trim();
      const childEl = createMockElement(tag, tagAttrs, text);
      childEl.parent = mainEl;
      mainEl.children.push(childEl);
    }
  }

  // Parse elements directly under body (e.g., header, nav, cookie banners, forms)
  const bodyBlock = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyBlock) {
    const tagRegex = /<([a-z0-9_-]+)([^>]*)>([\s\S]*?)<\/\1>|<(input|img|br|hr)\s*([^>]*)\/?>/gi;
    let bm: RegExpExecArray | null;
    while ((bm = tagRegex.exec(bodyBlock[1])) !== null) {
      const tag = bm[1] || bm[4];
      if (tag.toLowerCase() === "main") continue;
      const tagAttrs: Record<string, string> = {};
      const aStr = bm[2] || bm[5] || "";
      const attrRegex = /([a-z0-9:_-]+)="([^"]*)"/gi;
      let am: RegExpExecArray | null;
      while ((am = attrRegex.exec(aStr)) !== null) {
        tagAttrs[am[1]] = am[2];
      }
      const text = (bm[3] || "").replace(/<[^>]+>/g, "").trim();
      const childEl = createMockElement(tag, tagAttrs, text);
      childEl.parent = body;
      body.children.push(childEl);
    }
  }

  const doc = {
    documentElement: { lang: "en" },
    location: {
      href: url,
      hostname: new URL(url).hostname,
    },
    title: titleText,
    head,
    body,
    getElementById(id: string) {
      return root.querySelector(`#${id}`);
    },
    querySelector(selector: string) {
      if (selector === "title") return head.querySelector("title");
      if (selector === "main") return mainEl || root.querySelector("main");
      if (selector === "body") return body;
      return root.querySelector(selector);
    },
    querySelectorAll(selector: string) {
      return root.querySelectorAll(selector);
    },
    createElement(tag: string) {
      return createMockElement(tag);
    },
  };

  return doc as unknown as Document;
}
