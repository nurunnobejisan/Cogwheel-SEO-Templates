import {
  LayoutDashboard,
  ShieldCheck,
  Hash,
  Sparkles,
  ListChecks,
  FileBarChart2,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavSectionId =
  | "dashboard"
  | "audit"
  | "keywords"
  | "geo"
  | "tasks"
  | "reports"
  | "settings";

export interface NavItem {
  label: string;
  href: string;
  badge?: string;
  devOnly?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export interface NavSection {
  id: NavSectionId;
  label: string;
  icon: LucideIcon;
  href: string;
  groups: NavGroup[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/",
    groups: [
      {
        label: "Workspace",
        items: [
          { label: "Overview", href: "/" },
          { label: "Search Console", href: "/search-console" },
          { label: "Content Studio", href: "/content" },
        ],
      },
    ],
  },
  {
    id: "audit",
    label: "Website Audit",
    icon: ShieldCheck,
    href: "/audit",
    groups: [
      {
        label: "Site Diagnostics",
        items: [
          { label: "Audit Overview", href: "/audit" },
          { label: "Issue Report", href: "/audit/issues" },
          { label: "Crawled Pages", href: "/audit/pages" },
        ],
      },
      {
        label: "Focused Audits",
        items: [
          { label: "Headings (H1–H6)", href: "/audit/headings" },
          { label: "Images & Alt Text", href: "/audit/images" },
          { label: "XML Sitemap", href: "/audit/sitemap" },
          { label: "Search Console", href: "/search-console" },
        ],
      },
    ],
  },
  {
    id: "keywords",
    label: "Keywords",
    icon: Hash,
    href: "/keywords",
    groups: [
      {
        label: "Keyword Strategy",
        items: [
          { label: "Keyword Research", href: "/keywords" },
          { label: "Keyword Matrix", href: "/keywords/matrix" },
          { label: "Content Studio", href: "/content" },
        ],
      },
    ],
  },
  {
    id: "geo",
    label: "AI & GEO",
    icon: Sparkles,
    href: "/geo",
    groups: [
      {
        label: "Generative Search",
        items: [
          { label: "AI & GEO Radar", href: "/geo" },
          { label: "AI Visibility", href: "/geo/visibility" },
          { label: "Local Comp-Set", href: "/geo/compset" },
        ],
      },
    ],
  },
  {
    id: "tasks",
    label: "Tasks",
    icon: ListChecks,
    href: "/tasks",
    groups: [
      {
        label: "Workflow Sections",
        items: [
          { label: "All Ready Tasks", href: "/tasks" },
          { label: "On Page", href: "/tasks?section=On+Page" },
          { label: "Technical", href: "/tasks?section=Technical" },
          { label: "Off Page", href: "/tasks?section=Off+Page" },
          { label: "Local", href: "/tasks?section=Local" },
          { label: "Reporting", href: "/tasks?section=Reporting" },
        ],
      },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: FileBarChart2,
    href: "/reports",
    groups: [
      {
        label: "Deliverables",
        items: [
          { label: "All Deliverables", href: "/reports" },
          { label: "Pitch Deck (PDF)", href: "/reports/deck" },
          { label: "Visibility Deck (PPTX)", href: "/reports/pptx" },
          { label: "Executive Memo", href: "/reports/memo" },
          { label: "Client Email", href: "/reports/email" },
          { label: "Run History", href: "/reports/history" },
        ],
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    href: "/settings/ai-training",
    groups: [
      {
        label: "Configuration",
        items: [
          { label: "AI Training Rules", href: "/settings/ai-training" },
          { label: "Property Profile", href: "/settings/property" },
          { label: "Operator Console", href: "/platform" },
          { label: "Chrome Extension", href: "/extension" },
          { label: "Diagnostic Sandbox", href: "/labs", devOnly: true },
        ],
      },
    ],
  },
];

export function resolveSectionFromPath(pathname: string): NavSectionId {
  if (pathname.startsWith("/audit") || pathname.startsWith("/search-console")) return "audit";
  if (pathname.startsWith("/keywords") || pathname.startsWith("/content")) return "keywords";
  if (pathname.startsWith("/geo")) return "geo";
  if (pathname.startsWith("/tasks")) return "tasks";
  if (pathname.startsWith("/reports")) return "reports";
  if (pathname.startsWith("/settings") || pathname.startsWith("/platform") || pathname.startsWith("/labs")) {
    return "settings";
  }
  return "dashboard";
}

export interface BreadcrumbTrailItem {
  label: string;
  href?: string;
}

const ROUTE_BREADCRUMBS: Record<string, BreadcrumbTrailItem[]> = {
  "/": [{ label: "Dashboard" }],
  "/audit": [{ label: "Website Audit", href: "/audit" }, { label: "Overview" }],
  "/audit/issues": [{ label: "Website Audit", href: "/audit" }, { label: "Issue Report" }],
  "/audit/pages": [{ label: "Website Audit", href: "/audit" }, { label: "Crawled Pages" }],
  "/audit/headings": [{ label: "Website Audit", href: "/audit" }, { label: "Headings" }],
  "/audit/images": [{ label: "Website Audit", href: "/audit" }, { label: "Images" }],
  "/audit/sitemap": [{ label: "Website Audit", href: "/audit" }, { label: "XML Sitemap" }],
  "/search-console": [{ label: "Website Audit", href: "/audit" }, { label: "Search Console" }],
  "/keywords": [{ label: "Keywords", href: "/keywords" }, { label: "Keyword Research" }],
  "/keywords/matrix": [{ label: "Keywords", href: "/keywords" }, { label: "Keyword Matrix" }],
  "/content": [{ label: "Keywords", href: "/keywords" }, { label: "Content Studio" }],
  "/geo": [{ label: "AI & GEO", href: "/geo" }, { label: "Readiness Radar" }],
  "/geo/visibility": [{ label: "AI & GEO", href: "/geo" }, { label: "AI Visibility" }],
  "/geo/compset": [{ label: "AI & GEO", href: "/geo" }, { label: "Local Comp-Set" }],
  "/tasks": [{ label: "Tasks" }],
  "/reports": [{ label: "Reports" }],
  "/reports/history": [{ label: "Reports", href: "/reports" }, { label: "Run History" }],
  "/settings/ai-training": [{ label: "Settings", href: "/settings/ai-training" }, { label: "AI Training" }],
  "/settings/property": [{ label: "Settings", href: "/settings/ai-training" }, { label: "Property Profile" }],
  "/platform": [{ label: "Settings", href: "/settings/ai-training" }, { label: "Operator Console" }],
  "/labs": [{ label: "Settings", href: "/settings/ai-training" }, { label: "Sandbox" }],
};

export function resolveBreadcrumbs(pathname: string): BreadcrumbTrailItem[] {
  if (ROUTE_BREADCRUMBS[pathname]) return ROUTE_BREADCRUMBS[pathname];
  if (pathname.startsWith("/reports/")) {
    const slug = pathname.replace("/reports/", "").toUpperCase();
    return [{ label: "Reports", href: "/reports" }, { label: slug }];
  }
  return [{ label: "Workspace" }];
}
