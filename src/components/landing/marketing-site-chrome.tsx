import Link from "next/link";
import type { ReactNode } from "react";

type MarketingSiteHeaderProps = {
  /** Optional second row (e.g. landing in-page anchors). Keeps wordmark + section links in one sticky column. */
  secondaryNav?: ReactNode;
};

export function MarketingSiteHeader({ secondaryNav }: MarketingSiteHeaderProps) {
  return (
    <header className="sticky top-0 z-20 bg-surface/90 backdrop-blur-md print:hidden">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="flex min-h-14 items-center justify-between gap-4 border-b border-[var(--border-subtle)] py-2 sm:min-h-[3.75rem] sm:py-0">
          <Link
            href="/"
            className="shrink-0 text-xl font-bold tracking-tight text-zinc-950 no-underline transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)] sm:text-2xl"
          >
            Oblixa
          </Link>
          <nav className="flex shrink-0 items-center gap-1 sm:gap-2" aria-label="Site">
            <Link
              href="/login"
              prefetch={false}
              className="inline-flex min-h-10 items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)] sm:px-4 sm:text-[15px]"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="ui-btn-primary inline-flex min-h-10 items-center justify-center px-4 py-2 text-sm font-semibold sm:text-[15px]"
            >
              Get started
            </Link>
          </nav>
        </div>
        {secondaryNav != null ? (
          <div className="border-b border-[var(--border-subtle)] bg-surface/95 py-2.5 sm:py-3 print:hidden">
            <nav
              className="flex flex-wrap items-center gap-x-0.5 gap-y-1 sm:gap-x-1"
              aria-label="On this page"
            >
              {secondaryNav}
            </nav>
          </div>
        ) : null}
      </div>
    </header>
  );
}

export function MarketingSiteFooter() {
  return (
    <footer className="border-t border-[var(--border-subtle)] bg-surface px-4 py-8 sm:px-6 print:border-t-0">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xl space-y-3">
          <p className="text-xs text-zinc-600">
            © {new Date().getFullYear()} Oblixa. Contract execution platform. Oblixa does not
            provide legal advice, legal analysis, or a substitute for qualified counsel. Always
            verify critical terms against the original documents and your own policies.
          </p>
          <nav
            className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium"
            aria-label="Legal and policies"
          >
            <Link href="/security" prefetch={false} className="text-zinc-600 hover:text-zinc-900 ui-link">
              Security
            </Link>
            <Link href="/privacy" prefetch={false} className="text-zinc-600 hover:text-zinc-900 ui-link">
              Privacy
            </Link>
            <Link href="/terms" prefetch={false} className="text-zinc-600 hover:text-zinc-900 ui-link">
              Terms
            </Link>
            <Link
              href="/accessibility"
              prefetch={false}
              className="text-zinc-600 hover:text-zinc-900 ui-link"
            >
              Accessibility
            </Link>
            <Link href="/cookies" prefetch={false} className="text-zinc-600 hover:text-zinc-900 ui-link">
              Cookies
            </Link>
          </nav>
        </div>
        <nav
          className="flex flex-wrap justify-center gap-4 text-xs font-medium sm:justify-end sm:pt-0.5"
          aria-label="Account"
        >
          <Link href="/login" prefetch={false} className="text-zinc-600 hover:text-zinc-900 ui-link min-h-9 inline-flex items-center">
            Sign in
          </Link>
          <Link href="/signup" prefetch={false} className="text-zinc-600 hover:text-zinc-900 ui-link min-h-9 inline-flex items-center">
            Sign up
          </Link>
        </nav>
      </div>
    </footer>
  );
}
