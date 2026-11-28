"use client";

import * as React from "react";
import { Building2, Check, ChevronsUpDown, Globe, Plus } from "lucide-react";
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/index";
import { cn } from "@/lib/utils";
import { useWorkspace, type ActiveProperty } from "./WorkspaceContext";

/**
 * Searchable cmdk property switcher that loads matching properties from
 * `/api/properties/search` on demand instead of embedding 300+ clients in HTML.
 */
export function PropertySwitcher({
  compact = false,
  inverted = false,
}: {
  compact?: boolean;
  inverted?: boolean;
}) {
  const { activeProperty, recentProperties, selectProperty, autofillPropertyByUrl } = useWorkspace();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<ActiveProperty[]>([]);
  const [loading, setLoading] = React.useState(false);

  const [addModalOpen, setAddModalOpen] = React.useState(false);
  const [urlInput, setUrlInput] = React.useState("");
  const [addBusy, setAddBusy] = React.useState(false);
  const [addError, setAddError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/properties/search?q=${encodeURIComponent(query.trim())}&limit=20`);
        if (!res.ok) return;
        const json = (await res.json()) as { matches?: ActiveProperty[] };
        if (!cancelled && json.matches) {
          setResults(json.matches);
        }
      } catch {
        // ignore network issues
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query]);

  async function handleAddByUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!urlInput.trim()) {
      setAddError("Enter a property website URL.");
      return;
    }
    setAddError(null);
    setAddBusy(true);
    try {
      await autofillPropertyByUrl(urlInput);
      setUrlInput("");
      setAddModalOpen(false);
      setOpen(false);
    } catch (err) {
      setAddError((err as Error).message);
    } finally {
      setAddBusy(false);
    }
  }

  const listboxId = React.useId();

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-label="Switch active property"
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-sm border px-2.5 text-left transition-colors duration-fast ease-telemetry",
              compact ? "h-8 max-w-44" : "h-9",
              inverted
                ? "border-sidebar-active bg-sidebar-active/70 text-sidebar-text hover:bg-sidebar-active"
                : "border-border bg-surface text-text hover:border-border-strong"
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Building2 className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
              <span className="truncate text-caption font-medium">
                {activeProperty.name || "Select property"}
              </span>
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-0">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search name, brand, or city..."
              value={query}
              onValueChange={setQuery}
            />
            <CommandList id={listboxId}>
              {loading && (
                <div className="px-3 py-2 text-caption text-text-muted">Searching properties...</div>
              )}
              {!loading && results.length === 0 && (
                <CommandEmpty>No matching properties found.</CommandEmpty>
              )}

              {recentProperties.length > 0 && !query.trim() && (
                <>
                  <CommandGroup heading="Recent">
                    {recentProperties.map((prop) => {
                      const active = prop.name === activeProperty.name && prop.url === activeProperty.url;
                      return (
                        <CommandItem
                          key={`recent-${prop.name}-${prop.url}`}
                          value={`recent-${prop.name}`}
                          onSelect={() => {
                            selectProperty(prop);
                            setOpen(false);
                          }}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-body font-medium text-text">{prop.name}</p>
                            <p className="truncate text-caption text-text-muted">
                              {[prop.brand, prop.city, prop.state].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          {active && <Check className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}

              <CommandGroup heading={query.trim() ? "Matches" : "Trained Properties"}>
                {results.map((prop) => {
                  const active = prop.name === activeProperty.name && prop.url === activeProperty.url;
                  return (
                    <CommandItem
                      key={`${prop.name}-${prop.url}`}
                      value={`${prop.name}-${prop.city}`}
                      onSelect={() => {
                        selectProperty(prop);
                        setOpen(false);
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body font-medium text-text">{prop.name}</p>
                        <p className="truncate text-caption text-text-muted">
                          {[prop.brand, prop.city, prop.state].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      {active && <Check className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>

              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  value="add-property-by-url"
                  onSelect={() => {
                    setOpen(false);
                    setAddModalOpen(true);
                  }}
                >
                  <span className="inline-flex items-center gap-2 font-medium text-link">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add property by URL
                  </span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add property by URL</DialogTitle>
            <DialogDescription>
              Fetch metadata and detect property name, brand, and market automatically.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddByUrl} className="space-y-4 px-5 py-4">
            <Input
              label="Property Website URL"
              type="url"
              placeholder="https://www.example.com/hotel/"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              error={addError ?? undefined}
              autoFocus
            />
            <DialogFooter className="border-t-0 px-0 pb-0 pt-2">
              <Button variant="secondary" onClick={() => setAddModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={addBusy}
                icon={<Globe className="h-4 w-4" aria-hidden="true" />}
              >
                Detect &amp; Select
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
