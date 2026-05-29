"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { LegalLinks } from "@/components/layout/legal-links";
import { trustChipBadges } from "@/components/landing/landing-content";

type MarketingSiteHeaderProps = {
  /** Optional second row (e.g. landing in-page anchors). Keeps wordmark + section links in one sticky column. */
  secondaryNav?: ReactNode;
};

function navLinkAttrs(pathname: string | null, href: string) {
  const isActive = pathname === href || (href !== "/" && pathname?.startsWith(href + "/"));
  return isActive
    ? ({ "aria-current": "page" as const, "data-active": "true" } as const)
    : ({} as const);
}

export function MarketingSiteHeader({ secondaryNav }: MarketingSiteHeaderProps) {
  const pathname = usePathname();
  return (
    <header className="ui-footer-shell sticky top-0 z-20 print:hidden">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex min-h-[4.4rem] flex-wrap items-center justify-between gap-3 py-2 sm:gap-4 sm:py-0">
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
          <nav className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-x-1 gap-y-0 sm:gap-x-2" aria-label="Site">
            <Link
              href="/product"
              prefetch={false}
              {...navLinkAttrs(pathname, "/product")}
              className="ui-btn-ghost inline-flex min-h-10 items-center justify-center px-2.5 py-2 sm:px-3 sm:text-[14px] data-[active=true]:text-[var(--accent-strong)] data-[active=true]:underline data-[active=true]:underline-offset-4"
            >
              Product
            </Link>
            <Link
              href="/pricing"
              prefetch={false}
              {...navLinkAttrs(pathname, "/pricing")}
              className="ui-btn-ghost inline-flex min-h-10 items-center justify-center px-2.5 py-2 sm:px-3 sm:text-[14px] data-[active=true]:text-[var(--accent-strong)] data-[active=true]:underline data-[active=true]:underline-offset-4"
            >
              Pricing
            </Link>
            <Link
              href="/security"
              prefetch={false}
              {...navLinkAttrs(pathname, "/security")}
              className="ui-btn-ghost inline-flex min-h-10 items-center justify-center px-2.5 py-2 sm:px-3 sm:text-[14px] data-[active=true]:text-[var(--accent-strong)] data-[active=true]:underline data-[active=true]:underline-offset-4"
            >
              Security
            </Link>
            <Link
              href="/contact"
              prefetch={false}
              {...navLinkAttrs(pathname, "/contact")}
              className="ui-btn-ghost inline-flex min-h-10 items-center justify-center px-2.5 py-2 sm:px-3 sm:text-[14px] data-[active=true]:text-[var(--accent-strong)] data-[active=true]:underline data-[active=true]:underline-offset-4"
            >
              Contact
            </Link>
            <Link
              href="/terms"
              prefetch={false}
              {...navLinkAttrs(pathname, "/terms")}
              className="ui-btn-ghost inline-flex min-h-10 items-center justify-center px-2.5 py-2 sm:px-3 sm:text-[14px] data-[active=true]:text-[var(--accent-strong)] data-[active=true]:underline data-[active=true]:underline-offset-4"
            >
              Legal
            </Link>
            <span aria-hidden className="hidden h-5 w-px bg-[var(--border-subtle)] sm:inline-block" />
            <Link
              href="/login"
              prefetch={false}
              className="ui-btn-ghost inline-flex min-h-10 items-center justify-center px-2.5 py-2 sm:px-3 sm:text-[14px]"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="ui-btn-primary inline-flex min-h-10 items-center justify-center px-3.5 py-2 text-sm font-semibold sm:px-4 sm:text-[14px]"
            >
              Start free trial
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
    <footer className="ui-footer-shell relative px-4 py-10 sm:px-6 sm:py-12 lg:py-16 print:border-t-0">
      {/* Section shelf — gradient hairline anchoring the footer to the page. */}
      <div
        aria-hidden
        className="absolute inset-x-0 -top-px h-px"
        style={{
          background:
            "linear-gradient(to right, transparent, color-mix(in oklab, var(--accent) 28%, transparent), transparent)",
        }}
      />
      {/* v9 — Trust chip strip moved here from the deleted standalone Trust band
          on the landing page. Compact horizontal row above the legal/account row. */}
      <div className="mx-auto mb-5 flex max-w-6xl flex-wrap items-center justify-center gap-1.5 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] pb-5 sm:justify-start">
        {trustChipBadges.map((label) => (
          <span
            key={label}
            className="inline-flex items-center gap-1.5 rounded-full border border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[var(--surface-raised)] px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
          >
            <span aria-hidden className="h-1 w-1 rounded-full bg-[var(--accent-strong)]" />
            {label}
          </span>
        ))}
      </div>
      <div className="mx-auto flex max-w-6xl flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xl space-y-2.5">
          <p className="ui-caps-2 inline-flex items-center gap-1.5 text-[10.5px] text-[var(--text-tertiary)]">
            <Info
              size={11}
              strokeWidth={1.85}
              aria-hidden
              className="text-[var(--accent-strong)]"
            />
            Operational notice
          </p>
          <p className="text-[11.5px] leading-[1.55] text-[var(--text-tertiary)]">
            © {new Date().getFullYear()} Oblixa. Contract tracking workspace for signed agreements.
            Oblixa is not a law firm and does not provide legal advice. Users are responsible for
            reviewing contract information and making business or legal decisions.
          </p>
          <LegalLinks className="gap-x-5" />
        </div>
        <nav
          className="flex flex-wrap justify-center gap-3 sm:justify-end sm:pt-0.5"
          aria-label="Account"
        >
          <Link
            href="/contact"
            prefetch={false}
            className="ui-btn-ghost inline-flex min-h-9 items-center px-3 text-[12.5px] font-semibold"
          >
            Book setup call
          </Link>
          <Link
            href="/signup"
            prefetch={false}
            className="ui-btn-primary inline-flex min-h-9 items-center px-3.5 text-[12.5px] font-semibold"
          >
            Start free trial
          </Link>
        </nav>
      </div>
    </footer>
  );
}
