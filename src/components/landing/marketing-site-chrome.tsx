"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Info, Menu, ShieldCheck, X } from "lucide-react";
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

/** Public marketing nav links (release-aligned set). "Pricing" matches the
 *  /pricing page H1 ("Simple pricing for contract tracking"); the prior
 *  "Access and pricing" label led with access and drifted from the page.
 *  Contact stays out of the lean top nav and lives in the footer Support
 *  column so the bar reads as a decided product, not a crowded menu. */
const PUBLIC_LINKS = [
  { href: "/product", label: "Product" },
  { href: "/pricing", label: "Pricing" },
  { href: "/security", label: "Security" },
] as const;

/** Footer link map — three scannable columns. Request access also appears as
 *  the primary CTA above; here it is the Product-column sitemap entry. */
const FOOTER_PRODUCT_LINKS = [
  { href: "/product", label: "Product" },
  { href: "/pricing", label: "Pricing" },
] as const;

const FOOTER_LEGAL_LINKS = [
  { href: "/security", label: "Security" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/acceptable-use", label: "Acceptable use" },
  { href: "/accessibility", label: "Accessibility" },
  { href: "/cookies", label: "Cookies" },
] as const;

const FOOTER_SUPPORT_LINKS = [
  { href: "/contact", label: "Contact" },
  { href: "/login", label: "Sign in" },
] as const;

/** Shared ghost recipe for the public nav links: 40px tall (parity with the
 *  CTA + brand tile), full-width left-aligned rows inside the mobile drawer,
 *  auto-width centered pills inline at md+. The active-route treatment (an
 *  accent-soft pill) lives in globals.css so it survives the mode-aware ghost
 *  overrides without a specificity fight. */
const publicLinkClass =
  "ui-btn-ghost inline-flex min-h-10 w-full items-center justify-start whitespace-nowrap px-3 text-[14px] md:w-auto md:justify-center";

/** Focusable elements inside the header, excluding the click-outside scrim. */
const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]):not([tabindex="-1"])';

export function MarketingSiteHeader({ secondaryNav }: MarketingSiteHeaderProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Close the drawer on any nav link tap (the header persists across marketing
  // route changes, so navigation alone won't reset it).
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const closeAndRefocus = useCallback(() => {
    setMenuOpen(false);
    toggleRef.current?.focus();
  }, []);

  // While the drawer is open: move focus into it, close on Escape (restoring
  // focus to the toggle), and trap Tab within the header so focus cannot reach
  // the page behind the click-outside scrim.
  useEffect(() => {
    if (!menuOpen) return;
    navRef.current?.querySelector<HTMLElement>("a[href]")?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        toggleRef.current?.focus();
        return;
      }
      if (e.key !== "Tab") return;
      const root = headerRef.current;
      if (!root) return;
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !root.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <header ref={headerRef} className="ui-footer-shell sticky top-0 z-30 print:hidden">
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
              ref={navRef}
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
              {/* Contact — shown in the mobile drawer and on wide desktop
                  (lg+), but hidden in the medium-width inline nav so the lean
                  3-link bar never wraps at the md→lg range. */}
              <Link
                href="/contact"
                prefetch={false}
                onClick={closeMenu}
                {...navLinkAttrs(pathname, "/contact")}
                className="ui-btn-ghost inline-flex min-h-10 w-full items-center justify-start whitespace-nowrap px-3 text-[14px] md:hidden lg:inline-flex lg:w-auto lg:justify-center"
              >
                Contact
              </Link>
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
              ref={toggleRef}
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
              onClick={closeAndRefocus}
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

/** One footer link column: a caps header over a stacked link list. */
function FooterColumn({
  title,
  links,
  ariaLabel,
}: {
  title: string;
  links: ReadonlyArray<{ href: string; label: string }>;
  ariaLabel?: string;
}) {
  return (
    <nav aria-label={ariaLabel ?? title} className="flex flex-col gap-3">
      <p className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">{title}</p>
      <ul className="flex flex-col gap-2.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              prefetch={false}
              className="rounded-sm text-[12.5px] font-medium leading-none text-[var(--text-secondary)] no-underline transition-colors duration-[var(--ui-duration)] hover:text-[var(--accent-strong)] focus-visible:text-[var(--accent-strong)] focus-visible:underline focus-visible:underline-offset-[3px] focus-visible:outline-none"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function MarketingSiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="ui-footer-shell relative px-4 sm:px-6 print:border-t-0">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        {/* Brand + action as one connected block on the left; link columns on
            the right. Pairing the CTA with the brand (rather than pushing it to
            the far edge) keeps them visually connected and trims footer height. */}
        <div className="grid gap-x-10 gap-y-9 lg:grid-cols-[minmax(0,21rem)_1fr]">
          <div className="space-y-4">
            <Link
              href="/"
              className="group inline-flex items-center gap-2.5 rounded-lg no-underline outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)]"
            >
              <span className="ui-avatar-tile h-9 w-9 text-[15px] font-bold" aria-hidden>
                O
              </span>
              <span className="text-lg font-bold leading-none tracking-tight text-[var(--text-primary)] transition-opacity group-hover:opacity-85">
                Oblixa
              </span>
            </Link>
            <p className="max-w-xs text-[12.5px] leading-snug text-[var(--text-secondary)]">
              Track what signed contracts require next — reviewed dates, owners, requirements,
              evidence, and exportable reports.
            </p>
            {/* Trust signals as a quiet caps line (leading shield + hairline
                separators), not bordered pills that read as stray filters.
                Neutral tertiary tone keeps status colors out of footer chrome. */}
            <div className="ui-caps-2 flex flex-wrap items-center gap-2.5 text-[10px] text-[var(--text-tertiary)]">
              <ShieldCheck size={13} strokeWidth={1.85} aria-hidden className="shrink-0" />
              {trustChipBadges.map((label, index) => (
                <Fragment key={label}>
                  {index > 0 ? (
                    <span
                      aria-hidden
                      className="h-3 w-px bg-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)]"
                    />
                  ) : null}
                  <span>{label}</span>
                </Fragment>
              ))}
            </div>
            {/* Request access is the primary action; the product tour is the
                bordered secondary peer (button weight, not plain text). */}
            <nav aria-label="Account" className="flex flex-wrap items-center gap-2 pt-1">
              <Link
                href="/request-access"
                prefetch={false}
                className="ui-btn-primary inline-flex items-center justify-center whitespace-nowrap text-[13px]"
              >
                Request access
              </Link>
              <Link
                href="/product"
                prefetch={false}
                className="ui-btn-secondary inline-flex items-center justify-center whitespace-nowrap text-[13px]"
              >
                View product tour
              </Link>
            </nav>
          </div>

          {/* Link columns — Product, Legal & policies, Support. */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:gap-x-10">
            <FooterColumn title="Product" links={FOOTER_PRODUCT_LINKS} />
            <FooterColumn title="Legal & policies" ariaLabel="Legal and policies" links={FOOTER_LEGAL_LINKS} />
            <FooterColumn title="Support" links={FOOTER_SUPPORT_LINKS} />
          </div>
        </div>

        {/* Bottom — quiet operational notice (keeps the no-legal-advice +
            user-review markers) and a separate low-emphasis copyright row. */}
        <div className="flex flex-col gap-3 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] pt-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <p className="ui-caps-2 inline-flex items-center gap-1.5 text-[10px] text-[var(--text-tertiary)]">
              <Info size={11} strokeWidth={1.85} aria-hidden className="text-[var(--text-tertiary)]" />
              Operational notice
            </p>
            <p className="max-w-2xl text-[11.5px] leading-[1.55] text-[var(--text-tertiary)]">
              Oblixa is not a law firm and does not provide legal advice. Users are responsible for
              reviewing contract information and making business or legal decisions.
            </p>
          </div>
          <p className="shrink-0 text-[11px] leading-none text-[var(--text-tertiary)] sm:text-right">
            © {year} Oblixa — signed-contract follow-up
          </p>
        </div>
      </div>
    </footer>
  );
}
