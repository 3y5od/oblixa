"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Menu, ShieldCheck, X } from "lucide-react";
import { trustChipBadges } from "@/components/landing/landing-content";
import { BRAND_TILE_CLASS } from "@/components/ui/brand-tile";

type MarketingSiteHeaderProps = {
  secondaryNav?: ReactNode;
};

function navLinkAttrs(pathname: string | null, href: string) {
  const isActive = pathname === href || (href !== "/" && pathname?.startsWith(href + "/"));
  return isActive
    ? ({ "aria-current": "page" as const, "data-active": "true" } as const)
    : ({} as const);
}

const PUBLIC_LINKS = [
  { href: "/product", label: "Product" },
  { href: "/pricing", label: "Pricing" },
  { href: "/security", label: "Security" },
] as const;

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

const publicLinkClass =
  "ui-btn-ghost inline-flex min-h-10 w-full items-center justify-start whitespace-nowrap px-3 text-[13.5px] md:w-auto md:justify-center";

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]):not([tabindex="-1"])';

export function MarketingSiteHeader({ secondaryNav }: MarketingSiteHeaderProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const closeAndRefocus = useCallback(() => {
    setMenuOpen(false);
    toggleRef.current?.focus();
  }, []);

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
      <div className="lp-container px-4 sm:px-6">
        <div className="relative flex min-h-[4.25rem] items-center justify-between gap-3">
          <Link
            href="/"
            className="group flex items-center gap-2.5 rounded-[4px] no-underline outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)]"
          >
            <span className={`${BRAND_TILE_CLASS} lp-serif h-8 w-8 pb-px text-[17px]`} aria-hidden>
              O
            </span>
            <span className="text-[18px] font-bold leading-none tracking-[-0.02em] text-[var(--text-primary)] transition-opacity group-hover:opacity-85">
              Oblixa
            </span>
          </Link>

          <div className="flex items-center gap-2 md:gap-3">
            <nav
              id="site-nav"
              ref={navRef}
              aria-label="Site"
              className={
                (menuOpen ? "flex" : "hidden") +
                " absolute inset-x-0 top-full z-40 flex-col gap-1 rounded-b-xl border-b border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[var(--surface-raised)] p-2.5 shadow-[var(--shadow-2)] md:static md:z-auto md:flex md:flex-row md:items-center md:gap-0.5 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none"
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
              <Link
                href="/contact"
                prefetch={false}
                onClick={closeMenu}
                {...navLinkAttrs(pathname, "/contact")}
                className="ui-btn-ghost inline-flex min-h-10 w-full items-center justify-start whitespace-nowrap px-3 text-[13.5px] md:hidden lg:inline-flex lg:w-auto lg:justify-center"
              >
                Contact
              </Link>
              <span
                aria-hidden
                className="mx-2 hidden h-[1.05rem] w-px bg-[color:color-mix(in_oklab,var(--border-strong)_70%,transparent)] md:inline-block"
              />
              <span
                aria-hidden
                className="my-1 h-px w-full bg-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] md:hidden"
              />
              <Link
                href="/login"
                prefetch={false}
                onClick={closeMenu}
                className="ui-btn-ghost inline-flex min-h-10 w-full items-center justify-start whitespace-nowrap px-3 text-[13.5px] md:w-auto md:justify-center"
              >
                Sign in
              </Link>
            </nav>

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

function FooterColumn({
  title,
  links,
  ariaLabel,
  twoCol = false,
}: {
  title: string;
  links: ReadonlyArray<{ href: string; label: string }>;
  ariaLabel?: string;
  twoCol?: boolean;
}) {
  return (
    <nav aria-label={ariaLabel ?? title} className="flex flex-col gap-3.5">
      <p className="ui-caps-2 text-[10.5px] text-[var(--text-secondary)]">{title}</p>
      <ul className={twoCol ? "inline-grid grid-cols-2 gap-x-10 gap-y-2.5" : "flex flex-col gap-2.5"}>
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              prefetch={false}
              className="rounded-sm text-[13px] font-medium leading-none text-[var(--text-primary)] no-underline transition-colors duration-[var(--ui-duration)] hover:text-[var(--accent-strong)] focus-visible:text-[var(--accent-strong)] focus-visible:underline focus-visible:underline-offset-[3px] focus-visible:outline-none"
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
    <footer className="ui-footer-shell relative px-4 pb-5 pt-6 sm:px-6 sm:pb-6 sm:pt-7 print:border-t-0">
      <div className="lp-container flex flex-col gap-4">
        <div className="grid gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,23rem)_1fr]">
          <div className="space-y-3">
            <Link
              href="/"
              className="group inline-flex items-center gap-2.5 rounded-[4px] no-underline outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)]"
            >
              <span className={`${BRAND_TILE_CLASS} lp-serif h-8 w-8 pb-px text-[17px]`} aria-hidden>
                O
              </span>
              <span className="text-[19px] font-bold leading-none tracking-[-0.02em] text-[var(--text-primary)] transition-opacity group-hover:opacity-85">
                Oblixa
              </span>
            </Link>
            <p className="max-w-sm text-[13.5px] leading-[1.6] text-[var(--text-secondary)]">
              Track what signed contracts require next — reviewed dates, owners, requirements,
              evidence, and exportable reports.
            </p>
            <div className="grid gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--text-secondary)]">
              {trustChipBadges.map((label) => (
                <span key={label} className="inline-flex items-center gap-1.5">
                  <ShieldCheck size={12} strokeWidth={1.85} aria-hidden className="shrink-0" />
                  {label}
                </span>
              ))}
            </div>
            <nav aria-label="Account" className="flex flex-wrap items-center gap-3">
              <Link
                href="/request-access"
                prefetch={false}
                className="ui-btn-primary inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                Request access
                <ArrowRight className="h-4 w-4" strokeWidth={1.85} aria-hidden />
              </Link>
              <Link
                href="/product"
                prefetch={false}
                className="ui-btn-secondary inline-flex items-center justify-center whitespace-nowrap"
              >
                View product
              </Link>
            </nav>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-6 sm:flex sm:flex-wrap sm:gap-x-14 lg:justify-end lg:gap-x-16 lg:pt-1.5">
            <FooterColumn title="Product" links={FOOTER_PRODUCT_LINKS} />
            <FooterColumn
              title="Legal & policies"
              ariaLabel="Legal and policies"
              links={FOOTER_LEGAL_LINKS}
              twoCol
            />
            <FooterColumn title="Support" links={FOOTER_SUPPORT_LINKS} />
          </div>
        </div>

        <div className="grid gap-3 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-10">
          <p className="max-w-2xl text-[10.5px] leading-[1.55] text-[var(--text-tertiary)]">
            <span className="ui-caps-2 mr-2 text-[9.5px] text-[var(--text-tertiary)]">
              Operational notice
            </span>
            Oblixa is not a law firm and does not provide legal advice. Users are responsible for
            reviewing contract information and making business or legal decisions.
          </p>
          <p className="shrink-0 font-mono text-[10.5px] leading-[1.5] tracking-[0.02em] text-[var(--text-tertiary)] sm:text-right">
            © {year} Oblixa — signed-contract follow-up
          </p>
        </div>
      </div>
    </footer>
  );
}
