"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Info, Menu, X } from "lucide-react";
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

/** Public marketing nav links (release-aligned set). */
const PUBLIC_LINKS = [
  { href: "/product", label: "Product" },
  { href: "/pricing", label: "Access and pricing" },
  { href: "/security", label: "Security" },
  { href: "/contact", label: "Contact" },
] as const;

/** Shared ghost recipe for the public nav links: 40px tall (parity with the
 *  CTA + brand tile), full-width left-aligned rows inside the mobile drawer,
 *  auto-width centered pills inline at md+, with the active-route treatment. */
const publicLinkClass =
  "ui-btn-ghost inline-flex min-h-10 w-full items-center justify-start whitespace-nowrap px-3 text-[14px] md:w-auto md:justify-center data-[active=true]:text-[var(--accent-strong)] data-[active=true]:underline data-[active=true]:underline-offset-4";

export function MarketingSiteHeader({ secondaryNav }: MarketingSiteHeaderProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  // Close the drawer on any nav link tap (the header persists across marketing
  // route changes, so navigation alone won't reset it).
  const closeMenu = () => setMenuOpen(false);

  // Close the drawer on Escape while it is open.
  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <header className="ui-footer-shell sticky top-0 z-30 print:hidden">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative flex min-h-[3.5rem] items-center justify-between gap-3">
          {/* Brand lockup — one link target; de-glossed 40px tile aligned to the
              nav/CTA height; baseline-centered wordmark. */}
          <Link
            href="/"
            className="group flex items-center gap-2.5 rounded-lg no-underline outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)]"
          >
            <span className="ui-avatar-tile h-10 w-10 text-base font-bold" aria-hidden>
              O
            </span>
            <span className="text-lg font-bold leading-none tracking-tight text-[var(--text-primary)] transition-opacity group-hover:opacity-85 sm:text-xl">
              Oblixa
            </span>
          </Link>

          {/* Right cluster: public nav + Sign in (collapses to a drawer below
              md), then the always-visible primary CTA + the drawer toggle. */}
          <div className="flex items-center gap-2 md:gap-3">
            <nav
              id="site-nav"
              aria-label="Site"
              className={
                (menuOpen ? "flex" : "hidden") +
                " absolute inset-x-0 top-full z-40 flex-col gap-1 rounded-b-xl border-b border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[var(--surface-raised)] p-2.5 shadow-[var(--shadow-2)] md:static md:z-auto md:flex md:flex-row md:items-center md:gap-1 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none"
              }
            >
              {PUBLIC_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  prefetch={false}
                  onClick={closeMenu}
                  {...navLinkAttrs(pathname, link.href)}
                  className={publicLinkClass}
                >
                  {link.label}
                </Link>
              ))}
              {/* public | account separator: vertical hairline inline at md+,
                  a full-width rule inside the mobile drawer. */}
              <span
                aria-hidden
                className="mx-1.5 hidden h-5 w-px bg-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] md:inline-block"
              />
              <span
                aria-hidden
                className="my-1 h-px w-full bg-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] md:hidden"
              />
              <Link
                href="/login"
                prefetch={false}
                onClick={closeMenu}
                className="ui-btn-ghost inline-flex min-h-10 w-full items-center justify-start whitespace-nowrap px-3 text-[14px] md:w-auto md:justify-center"
              >
                Sign in
              </Link>
            </nav>

            {/* CTA matches the base .ui-btn-primary (and the sibling marketing
                pages' CTAs) — radius, height, padding, halo all inherited;
                living outside the Site nav drops the header-only shadow boost. */}
            <Link
              href="/request-access"
              className="ui-btn-primary inline-flex items-center justify-center whitespace-nowrap"
            >
              Request access
            </Link>

            <button
              type="button"
              aria-label="Site menu"
              aria-expanded={menuOpen}
              aria-controls="site-nav"
              onClick={() => setMenuOpen((open) => !open)}
              className="ui-btn-ghost inline-flex h-10 w-10 items-center justify-center rounded-lg md:hidden"
            >
              {menuOpen ? (
                <X className="h-5 w-5" strokeWidth={1.85} aria-hidden />
              ) : (
                <Menu className="h-5 w-5" strokeWidth={1.85} aria-hidden />
              )}
            </button>
          </div>

          {/* Click-outside scrim for the mobile drawer. */}
          {menuOpen ? (
            <button
              type="button"
              aria-label="Close menu"
              tabIndex={-1}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-20 cursor-default md:hidden"
            />
          ) : null}
        </div>

        {secondaryNav != null ? (
          <div className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] py-2 print:hidden">
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
            href="/request-access"
            prefetch={false}
            className="ui-btn-ghost inline-flex min-h-9 items-center px-3 text-[12.5px] font-semibold"
          >
            Request access
          </Link>
          {/* v14: ghost (was primary) so the footer stops competing with the
              page's final CTA; label aligned with the "View product tour"
              secondary CTA. */}
          <Link
            href="/product"
            prefetch={false}
            className="ui-btn-ghost inline-flex min-h-9 items-center px-3.5 text-[12.5px] font-semibold"
          >
            View product tour
          </Link>
        </nav>
      </div>
    </footer>
  );
}
