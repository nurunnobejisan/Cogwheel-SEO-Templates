"use client";

import * as React from "react";
import { Check, Download, Globe, Moon, Plus, Search, Settings, Sparkles, Sun, Trash2 } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { AnimatedNumber, FadeSlide, SignalPulse, TelemetryGrid } from "@/components/motion";
import { CrawlPulseScene, GeoRadarSweep, SerpPixelMeter } from "@/components/motion/TelemetryScenes";
import {
  CategoryCard,
  DataTable,
  DeltaBadge,
  DistributionChart,
  EmptyState,
  FilterTabs,
  InlineAlert,
  IssueTable,
  KpiTile,
  MetricRow,
  PageHeader,
  ScoreRing,
  SeverityFilter,
  StatusIcon,
  TrendChart,
  VitalsBar,
  type AuditSeverity,
} from "@/components/data/index";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
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
  Checkbox,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Kbd,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RadioGroup,
  RadioGroupItem,
  SelectField,
  SelectItem,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Skeleton,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  toast,
} from "@/components/ui/index";

const COLOR_TOKENS = [
  { name: "canvas", cls: "bg-canvas" },
  { name: "surface", cls: "bg-surface" },
  { name: "surface-2", cls: "bg-surface-2" },
  { name: "sidebar", cls: "bg-sidebar" },
  { name: "brand", cls: "bg-brand" },
  { name: "link", cls: "bg-link" },
  { name: "error", cls: "bg-error" },
  { name: "warning", cls: "bg-warning" },
  { name: "notice", cls: "bg-notice" },
  { name: "success", cls: "bg-success" },
];

export function DevUiShowcase() {
  const [dark, setDark] = React.useState(false);
  const [loadingBtn, setLoadingBtn] = React.useState(false);
  const [checked, setChecked] = React.useState(true);
  const [switched, setSwitched] = React.useState(true);
  const [radio, setRadio] = React.useState("desktop");
  const [selectVal, setSelectVal] = React.useState("hotel");
  const [score, setScore] = React.useState(86);
  const [filterView, setFilterView] = React.useState("all");
  const [severities, setSeverities] = React.useState<AuditSeverity[]>(["error", "warning", "notice"]);

  React.useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  return (
    <div className="min-h-screen bg-canvas px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
          <div className="space-y-1">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Studio</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>UI Kit (/dev/ui)</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="flex items-center gap-3 pt-1">
              <BrandMark />
              <Badge variant="brand" dot>
                Phase 0 Tokens &amp; Primitives
              </Badge>
            </div>
            <h1 className="text-title text-text">Design System &amp; Component Kit</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={toggleTheme}
              icon={dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            >
              {dark ? "Light theme" : "Dark theme"}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => toast.success("Telemetry tokens verified", { description: "All CSS variables active." })}
            >
              Trigger toast
            </Button>
          </div>
        </header>

        <FadeSlide>
          <TelemetryGrid className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <SignalPulse tone="brand" />
                  <span className="text-overline uppercase text-text-muted">Live Telemetry Preview</span>
                </div>
                <p className="text-display text-text">
                  <AnimatedNumber value={score} suffix="/100" />
                </p>
                <p className="max-w-[72ch] text-caption text-text-muted">
                  Geist Sans + Geist Mono self-hosted fonts with tabular numerals and architectural dot-grid surface.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setScore((s) => (s === 86 ? 94 : 86))}>
                  Animate score
                </Button>
              </div>
            </div>
          </TelemetryGrid>
        </FadeSlide>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Color Tokens &amp; Status Badges</CardTitle>
              <CardDescription>RGB channel CSS variables with semantic -soft tints and WCAG AA contrast.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {COLOR_TOKENS.map((t) => (
                <div key={t.name} className="flex items-center gap-2.5 rounded-sm border border-border p-2.5">
                  <span className={`h-6 w-6 shrink-0 rounded-sm border border-border ${t.cls}`} />
                  <span className="font-mono text-caption text-text">{t.name}</span>
                </div>
              ))}
            </div>
            <Separator />
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="neutral">Neutral</Badge>
              <Badge variant="error" dot>Error</Badge>
              <Badge variant="warning" dot>Warning</Badge>
              <Badge variant="notice" dot>Notice</Badge>
              <Badge variant="success" dot>Success</Badge>
              <Badge variant="brand" dot>Brand</Badge>
              <Badge variant="outline">Outline</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Typography Scale</CardTitle>
              <CardDescription>Self-hosted Geist Sans and Geist Mono.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-display text-text">Display 12,480</div>
            <div className="text-title text-text">Page Title — Website Audit</div>
            <div className="text-heading text-text">Section Heading — Technical Health</div>
            <p className="max-w-[72ch] text-body text-text">
              Body text at 14px with cv11 and ss01 enabled for readable SEO diagnostics and remediation steps.
            </p>
            <div className="text-table nums font-mono text-text-muted">/en-us/hotels/denver-downtown/ — 200 OK — 142ms</div>
            <div className="text-caption text-text-muted">Caption helper text and metadata (12px)</div>
            <div className="text-overline uppercase text-text-muted">Overline table header</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Buttons, Avatars &amp; Shortcuts</CardTitle>
              <CardDescription>Variants, sizes, and non-jumping loading state.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <Button variant="primary" icon={<Plus className="h-4 w-4" />}>Primary</Button>
              <Button variant="secondary" icon={<Download className="h-4 w-4" />}>Secondary</Button>
              <Button variant="ghost" icon={<Settings className="h-4 w-4" />}>Ghost</Button>
              <Button variant="destructive" icon={<Trash2 className="h-4 w-4" />}>Destructive</Button>
              <Button variant="link">Text link</Button>
              <Button
                variant="primary"
                loading={loadingBtn}
                onClick={() => {
                  setLoadingBtn(true);
                  setTimeout(() => setLoadingBtn(false), 900);
                }}
              >
                Test loading
              </Button>
              <Button variant="secondary" size="icon" aria-label="Search">
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" variant="secondary">Small 32px</Button>
              <Button size="md" variant="secondary">Medium 36px</Button>
              <Button size="lg" variant="secondary">Large 40px</Button>
              <Avatar>
                <AvatarImage src="/nurunnobe-logo.png" alt="Operator avatar" />
                <AvatarFallback>NJ</AvatarFallback>
              </Avatar>
              <Kbd>Cmd</Kbd>
              <Kbd>K</Kbd>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Form Controls</CardTitle>
              <CardDescription>36px inputs and selects with accessible labels and feedback.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <Input label="Property URL" placeholder="https://www.example.com" helperText="Include https:// protocol" />
            <Input label="API Endpoint" defaultValue="invalid-url" error="Enter a valid HTTPS URL" />
            <SelectField
              label="Vertical Pack"
              value={selectVal}
              onValueChange={setSelectVal}
              helperText="Pack #1 is Hospitality / Hotels"
            >
              <SelectItem value="hotel">Hotel &amp; Hospitality</SelectItem>
              <SelectItem value="ecommerce">Ecommerce</SelectItem>
              <SelectItem value="saas">SaaS &amp; Software</SelectItem>
            </SelectField>
            <Textarea label="Brand Guardrail Note" placeholder="Avoid discount phrasing in primary title tags..." />
            <div className="space-y-3">
              <Checkbox
                label="Run headless DOM audit"
                helperText="Measures rendered H1, alt coverage, and JSON-LD"
                checked={checked}
                onCheckedChange={(v) => setChecked(Boolean(v))}
              />
              <Switch
                label="Strict brand suffix lock"
                helperText="Enforce franchise title rules"
                checked={switched}
                onCheckedChange={setSwitched}
              />
            </div>
            <RadioGroup value={radio} onValueChange={setRadio}>
              <RadioGroupItem value="desktop" label="Desktop (580 px title limit)" />
              <RadioGroupItem value="mobile" label="Mobile (920 px snippet limit)" />
            </RadioGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Tabs, Overlays &amp; Command</CardTitle>
              <CardDescription>Underline tabs, Dialog, Sheet, Popover, DropdownMenu, Tooltip, Skeleton.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="issues">Issues</TabsTrigger>
                <TabsTrigger value="schema">Schema</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="text-body text-text-muted">
                Underline tab panel using 2 px brand indicator.
              </TabsContent>
              <TabsContent value="issues" className="text-body text-text-muted">
                Audit issues view preview.
              </TabsContent>
              <TabsContent value="schema" className="text-body text-text-muted">
                JSON-LD entity validation view.
              </TabsContent>
            </Tabs>

            <div className="flex flex-wrap items-center gap-2.5">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="secondary" size="sm">Open Dialog</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirm Full Crawl</DialogTitle>
                    <DialogDescription>Dialog uses 14 px radius and overlay shadow.</DialogDescription>
                  </DialogHeader>
                  <p className="px-5 py-4 text-body text-text-muted">
                    This will crawl up to 50 pages and evaluate 11 SEO &amp; GEO dimensions.
                  </p>
                  <DialogFooter>
                    <Button variant="primary" size="sm">Start Crawl</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="secondary" size="sm">Open Sheet</Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Page Telemetry</SheetTitle>
                    <SheetDescription>Inspect URL diagnostics without leaving the workspace.</SheetDescription>
                  </SheetHeader>
                  <div className="p-5 space-y-3">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                  <SheetFooter>
                    <Button variant="secondary" size="sm">Export JSON</Button>
                  </SheetFooter>
                </SheetContent>
              </Sheet>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="secondary" size="sm">Popover</Button>
                </PopoverTrigger>
                <PopoverContent>
                  <p className="text-caption text-text">Severity filter popover with shadow-pop.</p>
                </PopoverContent>
              </Popover>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm">Menu</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Check className="h-4 w-4 text-success" /> Export CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Sparkles className="h-4 w-4 text-brand" /> Run GEO Check
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm">Hover tooltip</Button>
                </TooltipTrigger>
                <TooltipContent>Accessible Radix tooltip</TooltipContent>
              </Tooltip>
            </div>

            <div className="rounded border border-border">
              <Command>
                <CommandInput placeholder="Search commands or routes..." />
                <CommandList>
                  <CommandEmpty>No matching commands.</CommandEmpty>
                  <CommandGroup heading="Quick Actions">
                    <CommandItem>
                      <span>Run full audit</span>
                      <CommandShortcut>R</CommandShortcut>
                    </CommandItem>
                    <CommandItem>
                      <span>Switch property</span>
                      <CommandShortcut>P</CommandShortcut>
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Phase 2 Data Display, Charts &amp; Telemetry</CardTitle>
              <CardDescription>PageHeader, KPIs, ScoreRing, DistributionChart, VitalsBar, IssueTable, DataTable.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <PageHeader
              title="Sample Audit Header"
              description="Fluid workspace frame with single primary CTA and responsive More menu."
              primaryAction={<Button variant="primary" size="sm">Run audit</Button>}
              secondaryActions={[{ label: "Export CSV", onClick: () => toast.info("Exported sample") }]}
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="surface-card p-4">
                <ScoreRing score={score} />
              </div>
              <KpiTile label="Errors" value={14} delta={-4} goodWhen="down" sparkline={[24, 21, 18, 14]} caption="vs last crawl" />
              <KpiTile label="Warnings" value={38} delta={6} goodWhen="down" caption="vs last crawl" />
              <KpiTile label="Field INP" value={null} />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <DistributionChart
                className="lg:col-span-2"
                data={[
                  { category: "Security", errors: 2, warnings: 4, notices: 1 },
                  { category: "Meta", errors: 5, warnings: 11, notices: 3 },
                  { category: "Headings", errors: 3, warnings: 8, notices: 4 },
                  { category: "Images", errors: 4, warnings: 15, notices: 6 },
                ]}
              />
              <VitalsBar
                desktop={[
                  { label: "LCP", goodPct: 78, needsWorkPct: 16, poorPct: 6 },
                  { label: "INP", goodPct: 86, needsWorkPct: 10, poorPct: 4 },
                  { label: "CLS", goodPct: 92, needsWorkPct: 6, poorPct: 2 },
                ]}
                mobile={[
                  { label: "LCP", goodPct: 58, needsWorkPct: 27, poorPct: 15 },
                  { label: "INP", goodPct: 72, needsWorkPct: 18, poorPct: 10 },
                  { label: "CLS", goodPct: 88, needsWorkPct: 8, poorPct: 4 },
                ]}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <TrendChart
                data={[
                  { date: "Nov 1", score: 71, issues: 42 },
                  { date: "Nov 14", score: 79, issues: 28 },
                  { date: "Nov 28", score: 86, issues: 14 },
                ]}
              />
              <div className="space-y-4">
                <CrawlPulseScene label="Crawler active" sublabel="Scanning 24 discovered URLs" />
                <SerpPixelMeter label="Title pixel budget" pixels={492} limitPx={580} />
                <GeoRadarSweep
                  score={78}
                  engines={[
                    { name: "ChatGPT", value: 72, connected: true },
                    { name: "Perplexity", value: 84, connected: true },
                    { name: "Gemini", value: 65, connected: true },
                    { name: "AIO", value: null, connected: false },
                  ]}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <FilterTabs
                value={filterView}
                onChange={setFilterView}
                options={[
                  { id: "all", label: "All", count: 52 },
                  { id: "new", label: "New", count: 9 },
                  { id: "fixed", label: "Fixed", count: 14 },
                ]}
              />
              <SeverityFilter selected={severities} onChange={setSeverities} counts={{ error: 14, warning: 38, notice: 12 }} />
              <DeltaBadge value={-12} goodWhen="down" />
              <StatusIcon status="success" />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <CategoryCard
                href="/audit/issues?category=security"
                name="Security & HTTPS"
                icon={<Globe className="h-4 w-4" />}
                errorCount={2}
                warningCount={4}
                selected
              />
              <div className="surface-card p-3.5">
                <MetricRow label="Indexable pages" value={148} delta={12} goodWhen="up" />
                <MetricRow label="Average response time" value="184 ms" delta={-24} goodWhen="down" />
              </div>
            </div>

            <IssueTable
              items={[
                {
                  id: "missing-h1",
                  title: "Pages missing primary H1 heading",
                  severity: "error",
                  pagesCount: 4,
                  fixedCount: 2,
                  newCount: 1,
                  description: "Four crawled room templates omit a semantic H1 heading.",
                  howToFix: "Add one concise H1 matching the page's primary keyword and property market.",
                  affectedUrls: ["https://example.com/rooms/king-suite", "https://example.com/dining/rooftop"],
                },
              ]}
            />

            <DataTable
              data={[
                { url: "/rooms/king-suite", status: 200, words: 642 },
                { url: "/dining/rooftop", status: 200, words: 418 },
              ]}
              columns={[
                { accessorKey: "url", header: "URL" },
                { accessorKey: "status", header: "Status" },
                { accessorKey: "words", header: "Words" },
              ]}
            />

            <InlineAlert
              variant="warning"
              title="Search Console not connected"
              description="Connect Google Search Console credentials to measure clicks, impressions, and cannibalization."
            />
            <EmptyState
              title="No custom rules yet"
              description="Add a guardrail rule to tailor outputs to brand standards."
              action={<Button variant="secondary" size="sm">Create rule</Button>}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
