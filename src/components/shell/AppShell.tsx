"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  HelpCircle,
  Keyboard,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Search,
  Sun,
} from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { SignalPulse } from "@/components/motion";
import {
  Avatar,
  AvatarFallback,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Kbd,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/index";
import { cn } from "@/lib/utils";
import { AppCommandPalette } from "./AppCommandPalette";
import {
  NAV_SECTIONS,
  resolveBreadcrumbs,
  resolveSectionFromPath,
  type NavSection,
  type NavSectionId,
} from "./nav-config";
import { PropertySwitcher } from "./PropertySwitcher";
import { WorkspaceProvider, useWorkspace } from "./WorkspaceContext";

const AutoPilotModal = dynamic(
  () => import("@/components/AutoPilotModal").then((m) => m.AutoPilotModal),
  { ssr: false }
);

const NAV_COLLAPSED_KEY = "seo_studio_nav_collapsed_v1";

function isDevEnv() {
  return process.env.NODE_ENV !== "production";
}

function SectionNavContent({
  section,
  pathname,
  searchQuery,
  onNavigate,
}: {
  section: NavSection;
  pathname: string;
  searchQuery: string;
  onNavigate?: () => void;
}) {
  const showDev = isDevEnv();

  return (
    <div className="space-y-5">
      {section.groups.map((group) => {
        const visibleItems = group.items.filter((item) => !item.devOnly || showDev);
        if (visibleItems.length === 0) return null;
        return (
          <div key={group.label} className="space-y-1">
            <p className="px-2.5 text-overline uppercase text-sidebar-text/60">{group.label}</p>
            <ul className="space-y-0.5">
              {visibleItems.map((item) => {
                const [itemPath, itemQuery] = item.href.split("?");
                const active = itemQuery
                  ? pathname === itemPath && searchQuery === itemQuery
                  : pathname === itemPath && (!itemPath.startsWith("/tasks") || !searchQuery);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex h-9 items-center justify-between rounded-sm px-3 text-body transition-colors duration-fast ease-telemetry",
                        active
                          ? "bg-sidebar-active font-medium text-sidebar-text"
                          : "text-sidebar-text/75 hover:bg-sidebar-active/60 hover:text-sidebar-text"
                      )}
                    >
                      {active && (
                        <span
                          aria-hidden="true"
                          className="absolute bottom-1.5 left-0 top-1.5 w-[3px] rounded-r-full bg-brand"
                        />
                      )}
                      <span className="truncate">{item.label}</span>
                      {item.badge && (
                        <span className="rounded-sm bg-sidebar-active px-1.5 py-0.5 text-caption text-sidebar-text">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const router = useRouter();
  const searchQuery = searchParams?.toString() ?? "";

  const {
    activeProperty,
    isDark,
    toggleTheme,
    autoPilotOpen,
    setAutoPilotOpen,
    setCommandPaletteOpen,
    refreshRuns,
    aiStatus,
  } = useWorkspace();

  const activeSectionId = resolveSectionFromPath(pathname);
  const [selectedSectionId, setSelectedSectionId] = React.useState<NavSectionId>(activeSectionId);
  const [navCollapsed, setNavCollapsed] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [flyoutSection, setFlyoutSection] = React.useState<NavSectionId | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);

  React.useEffect(() => {
    setSelectedSectionId(activeSectionId);
  }, [activeSectionId]);

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(NAV_COLLAPSED_KEY);
      if (saved === "true") setNavCollapsed(true);
    } catch {
      // ignore storage access issues
    }
  }, []);

  const toggleNavPanel = () => {
    setNavCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(NAV_COLLAPSED_KEY, String(next));
      } catch {
        // ignore storage access issues
      }
      return next;
    });
  };

  const activeSection = NAV_SECTIONS.find((s) => s.id === selectedSectionId) ?? NAV_SECTIONS[0];
  const breadcrumbs = resolveBreadcrumbs(pathname);

  return (
    <div className="flex min-h-screen w-full overflow-x-clip bg-canvas text-text">
      {/* Desktop & Tablet 64px Icon Rail */}
      <aside
        aria-label="Primary rail"
        className="sticky top-0 z-30 hidden h-screen w-16 shrink-0 flex-col items-center justify-between border-r border-sidebar-active bg-sidebar py-3 text-sidebar-text md:flex"
      >
        <div className="flex w-full flex-col items-center gap-3">
          <Link
            href="/"
            aria-label="SEO & GEO Studio home"
            className="flex h-10 w-10 items-center justify-center rounded-sm transition-opacity hover:opacity-90"
          >
            <BrandMark showWordmark={false} inverted />
          </Link>

          <nav aria-label="Section switcher" className="flex w-full flex-col items-center gap-1 px-2">
            {NAV_SECTIONS.filter((s) => s.id !== "settings").map((section) => {
              const Icon = section.icon;
              const isCurrent = activeSectionId === section.id;
              return (
                <Popover
                  key={section.id}
                  open={flyoutSection === section.id}
                  onOpenChange={(open) => setFlyoutSection(open ? section.id : null)}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label={section.label}
                          aria-current={isCurrent ? "page" : undefined}
                          onClick={() => {
                            setSelectedSectionId(section.id);
                            if (window.innerWidth >= 1280) {
                              setFlyoutSection(null);
                              router.push(section.href);
                            } else {
                              setFlyoutSection((prev) => (prev === section.id ? null : section.id));
                            }
                          }}
                          className={cn(
                            "relative flex h-10 w-10 items-center justify-center rounded-sm transition-colors duration-fast ease-telemetry",
                            isCurrent
                              ? "bg-sidebar-active text-sidebar-text"
                              : "text-sidebar-text/70 hover:bg-sidebar-active/60 hover:text-sidebar-text"
                          )}
                        >
                          {isCurrent && (
                            <span
                              aria-hidden="true"
                              className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full bg-brand"
                            />
                          )}
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="right">{section.label}</TooltipContent>
                  </Tooltip>
                  <PopoverContent
                    side="right"
                    align="start"
                    className="w-64 border-sidebar-active bg-sidebar p-3 text-sidebar-text xl:hidden"
                  >
                    <div className="mb-3 border-b border-sidebar-active pb-2 text-body font-semibold text-sidebar-text">
                      {section.label}
                    </div>
                    <SectionNavContent
                      section={section}
                      pathname={pathname}
                      searchQuery={searchQuery}
                      onNavigate={() => setFlyoutSection(null)}
                    />
                  </PopoverContent>
                </Popover>
              );
            })}
          </nav>
        </div>

        <div className="flex w-full flex-col items-center gap-1 px-2">
          {(() => {
            const settings = NAV_SECTIONS.find((s) => s.id === "settings")!;
            const SettingsIcon = settings.icon;
            const isCurrent = activeSectionId === "settings";
            return (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={settings.href}
                    aria-label="Settings"
                    aria-current={isCurrent ? "page" : undefined}
                    className={cn(
                      "relative flex h-10 w-10 items-center justify-center rounded-sm transition-colors duration-fast ease-telemetry",
                      isCurrent
                        ? "bg-sidebar-active text-sidebar-text"
                        : "text-sidebar-text/70 hover:bg-sidebar-active/60 hover:text-sidebar-text"
                    )}
                  >
                    {isCurrent && (
                      <span
                        aria-hidden="true"
                        className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full bg-brand"
                      />
                    )}
                    <SettingsIcon className="h-5 w-5" aria-hidden="true" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">Settings</TooltipContent>
              </Tooltip>
            );
          })()}

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleNavPanel}
                aria-label={navCollapsed ? "Expand navigation panel" : "Collapse navigation panel"}
                className="hidden h-10 w-10 items-center justify-center rounded-sm text-sidebar-text/70 transition-colors hover:bg-sidebar-active/60 hover:text-sidebar-text xl:flex"
              >
                {navCollapsed ? (
                  <PanelLeftOpen className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <PanelLeftClose className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {navCollapsed ? "Expand panel" : "Collapse panel"}
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>

      {/* Desktop 240px Collapsible Nav Panel */}
      {!navCollapsed && (
        <aside
          aria-label="Section navigation"
          className="sticky top-0 z-20 hidden h-screen w-60 shrink-0 flex-col justify-between border-r border-sidebar-active bg-sidebar px-3 py-3 text-sidebar-text xl:flex"
        >
          <div className="space-y-5 overflow-y-auto">
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-caption font-semibold text-sidebar-text">SEO &amp; GEO Studio</span>
                <span className="inline-flex items-center gap-1.5 text-caption text-sidebar-text/70">
                  <SignalPulse tone="brand" active={aiStatus.loaded} />
                  v3.0
                </span>
              </div>
              <PropertySwitcher inverted />
            </div>

            <SectionNavContent
              section={activeSection}
              pathname={pathname}
              searchQuery={searchQuery}
            />
          </div>

          <div className="border-t border-sidebar-active pt-3 text-caption text-sidebar-text/70">
            <div className="flex items-center justify-between px-1">
              <span>Training rules</span>
              <Link href="/settings/ai-training" className="nums font-medium text-brand hover:underline">
                {aiStatus.activeRules} active
              </Link>
            </div>
          </div>
        </aside>
      )}

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Sticky 56px Top Bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur-md md:px-6 xl:px-8">
          {/* Mobile Header Left */}
          <div className="flex min-w-0 items-center gap-2 md:hidden">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open navigation menu"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </Button>
            <Link href="/" aria-label="SEO & GEO Studio home" className="shrink-0">
              <BrandMark showWordmark={false} />
            </Link>
            <div className="min-w-0">
              <PropertySwitcher compact />
            </div>
          </div>

          {/* Tablet/Desktop Breadcrumb Left */}
          <div className="hidden min-w-0 items-center gap-3 md:flex">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">SEO &amp; GEO Studio</BreadcrumbLink>
                </BreadcrumbItem>
                {breadcrumbs.map((crumb) => (
                  <React.Fragment key={crumb.label}>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      {crumb.href ? (
                        <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          {/* Top Bar Right Actions */}
          <div className="flex shrink-0 items-center gap-2">
            {/* Run full audit split button */}
            <div className="hidden items-center sm:inline-flex">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setAutoPilotOpen(true)}
                icon={<Play className="h-3.5 w-3.5" aria-hidden="true" />}
                className="rounded-r-none"
              >
                Run full audit
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="primary"
                    size="sm"
                    aria-label="Audit options"
                    className="rounded-l-none border-l border-brand-fg/20 px-2"
                  >
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Targeted Diagnostics</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => router.push("/audit/pages")}>
                    Site Crawl &amp; Pages
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => router.push("/audit/headings")}>
                    Heading Structure (H1–H6)
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => router.push("/audit/images")}>
                    Image Optimization
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => router.push("/audit/sitemap")}>
                    XML Sitemap Audit
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCommandPaletteOpen(true)}
              aria-label="Open command palette"
              icon={<Search className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />}
              className="hidden lg:inline-flex"
            >
              <span className="text-text-muted">Search</span>
              <Kbd>Cmd K</Kbd>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Help and resources" className="hidden md:inline-flex">
                  <HelpCircle className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Resources</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => router.push("/templates")}>
                  Templates Catalog
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push("/strategy-matrix")}>
                  Strategy Matrix
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push("/architecture")}>
                  System Architecture
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push("/extension")}>
                  Extension Install Guide
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setShortcutsOpen(true)}>
                  <Keyboard className="h-4 w-4 text-text-muted" aria-hidden="true" />
                  Keyboard shortcuts
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Link href="/settings/property" aria-label="Property profile and settings" className="shrink-0">
              <Avatar className="h-8 w-8">
                <AvatarFallback>OP</AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </header>

        {/* Fluid App Content (Zero Footer Inside App) */}
        <main className="min-w-0 flex-1 p-4 md:p-6 xl:p-8">{children}</main>
      </div>

      {/* Mobile Drawer combining Rail + Sub-Nav */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-80 bg-sidebar p-0 text-sidebar-text border-sidebar-active">
          <SheetHeader className="border-sidebar-active px-4 py-3.5">
            <SheetTitle className="text-sidebar-text">
              <BrandMark inverted compact />
            </SheetTitle>
            <SheetDescription className="text-sidebar-text/70">
              Switch properties or jump to any module.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            <PropertySwitcher inverted />
            <div className="space-y-5">
              {NAV_SECTIONS.map((section) => (
                <div key={section.id} className="space-y-1.5">
                  <div className="flex items-center gap-2 px-2 text-caption font-semibold text-sidebar-text">
                    <section.icon className="h-4 w-4 text-brand" aria-hidden="true" />
                    <span>{section.label}</span>
                  </div>
                  <SectionNavContent
                    section={section}
                    pathname={pathname}
                    searchQuery={searchQuery}
                    onNavigate={() => setMobileMenuOpen(false)}
                  />
                </div>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Run Full Audit Pipeline Sheet */}
      <Sheet open={autoPilotOpen} onOpenChange={setAutoPilotOpen}>
        <SheetContent side="right" className="max-w-3xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Full Audit Pipeline</SheetTitle>
            <SheetDescription>
              Run crawl, technical diagnostics, schema, title/meta, and heading audits sequentially.
            </SheetDescription>
          </SheetHeader>
          <div className="p-5">
            {autoPilotOpen && (
              <AutoPilotModal
                activeProperty={activeProperty}
                onClose={() => setAutoPilotOpen(false)}
                onCompleted={() => void refreshRuns()}
                onOpenStudio={() => {
                  setAutoPilotOpen(false);
                  router.push("/keywords/matrix");
                }}
                onOpenVisibilityDeck={() => {
                  setAutoPilotOpen(false);
                  router.push("/reports/pptx");
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Keyboard Shortcuts Dialog */}
      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
            <DialogDescription>Navigate and trigger audits without leaving the keyboard.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-5 py-4 text-body">
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Open Command Palette</span>
              <span className="flex items-center gap-1">
                <Kbd>Cmd</Kbd>
                <Kbd>K</Kbd>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Close active dialog or drawer</span>
              <Kbd>Esc</Kbd>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AppCommandPalette />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <AppShellInner>{children}</AppShellInner>
    </WorkspaceProvider>
  );
}
