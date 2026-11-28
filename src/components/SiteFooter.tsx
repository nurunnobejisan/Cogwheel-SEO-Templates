import Link from "next/link";
import { BrandMark, OWNER_CREDIT, PRODUCT_NAME } from "./BrandMark";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface py-8 text-text-muted">
      <div className="mx-auto max-w-[1200px] px-4 md:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <BrandMark compact />
            <p className="max-w-[72ch] text-caption text-text-muted">
              Universal search and generative engine optimization suite across six vertical packs, hotel first.
            </p>
          </div>

          <nav aria-label="Footer Navigation" className="flex flex-wrap items-center gap-4 text-caption font-medium">
            <Link href="/" className="transition-colors hover:text-text">
              Studio
            </Link>
            <Link href="/templates" className="transition-colors hover:text-text">
              Templates
            </Link>
            <Link href="/strategy-matrix" className="transition-colors hover:text-text">
              Strategy Matrix
            </Link>
            <Link href="/architecture" className="transition-colors hover:text-text">
              Architecture
            </Link>
            <Link href="/extension" className="transition-colors hover:text-text">
              Extension
            </Link>
          </nav>
        </div>

        <div className="mt-6 flex flex-col gap-2 border-t border-border pt-5 text-caption text-text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} {PRODUCT_NAME}. Created by{" "}
            <a
              href="https://github.com/nurunnobejisan"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-text underline decoration-border-strong underline-offset-2 hover:text-link"
            >
              {OWNER_CREDIT}
            </a>{" "}
            &amp; Contributors. MIT License.
          </p>
          <span>v3.0.0</span>
        </div>
      </div>
    </footer>
  );
}
