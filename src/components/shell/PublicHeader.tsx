"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Moon, Sun } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import {
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/index";
import { cn } from "@/lib/utils";

const PUBLIC_NAV_LINKS = [
  { label: "Studio", href: "/" },
  { label: "Templates", href: "/templates" },
  { label: "Strategy Matrix", href: "/strategy-matrix" },
  { label: "Architecture", href: "/architecture" },
  { label: "Extension", href: "/extension" },
];

export function PublicHeader() {
  const pathname = usePathname() || "";
  const [isDark, setIsDark] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      window.localStorage.setItem("seo_studio_theme", next ? "dark" : "light");
    } catch {
      // ignore storage errors
    }
  };

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-border bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-[1200px] items-center justify-between gap-4 px-4 md:px-6">
        <Link href="/" className="shrink-0">
          <BrandMark compact />
        </Link>

        <nav aria-label="Public Navigation" className="hidden items-center gap-1 md:flex">
          {PUBLIC_NAV_LINKS.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-sm px-3 py-1.5 text-body font-medium transition-colors duration-fast ease-telemetry",
                  active ? "bg-surface-2 text-text" : "text-text-muted hover:text-text"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72">
          <SheetHeader>
            <SheetTitle>
              <BrandMark compact />
            </SheetTitle>
          </SheetHeader>
          <nav aria-label="Mobile Navigation" className="flex flex-col gap-1 p-4">
            {PUBLIC_NAV_LINKS.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-sm px-3 py-2 text-body font-medium transition-colors",
                    active ? "bg-surface-2 text-text" : "text-text-muted hover:bg-surface-2 hover:text-text"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
