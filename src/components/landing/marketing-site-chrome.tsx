import Link from "next/link";
import type { ReactNode } from "react";
import { LegalLinks } from "@/components/layout/legal-links";

type MarketingSiteHeaderProps = {
  /** Optional second row (e.g. landing in-page anchors). Keeps wordmark + section links in one sticky column. */
  secondaryNav?: ReactNode;
};

export function MarketingSiteHeader({ secondaryNav }: MarketingSiteHeaderProps) {
  return (
    <header className="ui-footer-shell sticky top-0 z-20 print:hidden">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex min-h-[4.4rem] flex-wrap items-center justify-between gap-4 py-2 sm:flex-nowrap sm:py-0">
          <Link
            href="/"
            className="flex items-center gap-3 no-underline"
          >
            <span className="ui-avatar-tile h-10 w-10 text-[var(--accent-fg)] shadow-[var(--shadow-2)] [background:linear-gradient(180deg,color-mix(in_oklab,var(--accent)_76%,white),var(--accent-strong))]">
              O
            </span>
            <span className="text-xl font-bold tracking-tight text-[var(--text-primary)] transition-opacity hover:opacity-85 sm:text-2xl">
              Oblixa
            </span>
          </Link>
          <nav className="flex shrink-0 flex-wrap items-center justify-end gap-1 sm:flex-nowrap sm:gap-2" aria-label="Site">
            <Link
              href="/login"
              prefetch={false}
              className="ui-btn-ghost inline-flex min-h-10 items-center justify-center px-3 py-2 sm:px-4 sm:text-[15px]"
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
          <div className="border-t border-[var(--border-subtle)] py-2.5 sm:py-3 print:hidden">
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
    <footer className="ui-footer-shell px-4 py-8 sm:px-6 print:border-t-0">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xl space-y-3">
          <p className="text-xs text-[var(--text-secondary)]">
            © {new Date().getFullYear()} Oblixa. Contract execution platform. Oblixa does not
            provide legal advice, legal analysis, or a substitute for qualified counsel. Always
            verify critical terms against the original documents and your own policies.
          </p>
          <LegalLinks className="text-xs" />
        </div>
        <nav
          className="flex flex-wrap justify-center gap-4 text-xs font-medium sm:justify-end sm:pt-0.5"
          aria-label="Account"
        >
          <Link href="/login" prefetch={false} className="ui-link min-h-9 inline-flex items-center">
            Sign in
          </Link>
          <Link href="/signup" prefetch={false} className="ui-link min-h-9 inline-flex items-center">
            Sign up
          </Link>
        </nav>
      </div>
    </footer>
  );
}
