import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Kbd,
  Skeleton,
  Textarea,
} from "../src/components/ui/index";
import { BrandMark } from "../src/components/BrandMark";

describe("Phase 0 — UI primitives", () => {
  it("renders Button variants and non-jumping loading state", () => {
    const html = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement(Button, { variant: "primary" }, "Save"),
        createElement(Button, { variant: "secondary", size: "sm" }, "Cancel"),
        createElement(Button, { variant: "destructive", loading: true }, "Deleting")
      )
    );
    expect(html).toContain("bg-brand text-brand-fg");
    expect(html).toContain("border-border bg-surface");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("invisible");
  });

  it("renders semantic Badge variants without raw palette colors", () => {
    const html = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement(Badge, { variant: "error", dot: true }, "Critical"),
        createElement(Badge, { variant: "success" }, "Passed"),
        createElement(Badge, { variant: "warning" }, "Needs work"),
        createElement(Badge, { variant: "notice" }, "Info")
      )
    );
    expect(html).toContain("bg-error-soft");
    expect(html).toContain("bg-success-soft");
    expect(html).toContain("bg-warning-soft");
    expect(html).toContain("bg-notice-soft");
  });

  it("renders Input and Textarea with accessible labels and error descriptions", () => {
    const html = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement(Input, { label: "Domain", error: "Required field" }),
        createElement(Textarea, { label: "Notes", helperText: "Max 200 chars" })
      )
    );
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("Required field");
    expect(html).toContain("Max 200 chars");
  });

  it("renders Card, Breadcrumb, Kbd, Skeleton, and BrandMark", () => {
    const html = renderToStaticMarkup(
      createElement(
        Card,
        null,
        createElement(
          CardHeader,
          null,
          createElement(CardTitle, null, "Audit"),
          createElement(CardDescription, null, "11 dimensions")
        ),
        createElement(
          CardContent,
          null,
          createElement(BrandMark),
          createElement(Kbd, null, "Cmd+K"),
          createElement(Skeleton, { className: "h-4 w-24" }),
          createElement(
            Breadcrumb,
            null,
            createElement(
              BreadcrumbList,
              null,
              createElement(BreadcrumbItem, null, createElement(BreadcrumbLink, { href: "/" }, "Home")),
              createElement(BreadcrumbSeparator, null),
              createElement(BreadcrumbItem, null, createElement(BreadcrumbPage, null, "Audit"))
            )
          )
        )
      )
    );
    expect(html).toContain("SEO &amp; GEO Studio");
    expect(html).toContain("surface-card");
    expect(html).toContain("skeleton-shimmer");
    expect(html).toContain('aria-current="page"');
  });
});
