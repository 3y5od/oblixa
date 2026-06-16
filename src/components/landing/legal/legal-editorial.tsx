import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { LegalSectionIndex, type LegalAnchor } from "./legal-section-index";

export type { LegalAnchor };

type LinkItem = { href: string; label: string };

/**
 * Shared editorial shell for the public legal/policy surfaces. Replaces the
 * per-page `landing-luminous` boilerplate that each policy page used to
 * hand-copy. Renders the warm-paper document desk (page grain), a single
 * consistent content width, a compact mobile "On this page" disclosure, and a
 * sticky desktop section index in a right rail. Sections compose as open
 * editorial blocks separated by document rules — not a stack of cards.
 */
export function LegalEditorialShell({
  anchors,
  children,
}: {
  anchors?: readonly LegalAnchor[];
  children: ReactNode;
}) {
  const hasIndex = !!anchors && anchors.length > 0;
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="relative isolate flex min-h-full flex-1 flex-col outline-none"
    >
      <div aria-hidden className="lp-grain" />
      <div aria-hidden className="product-top-hairline" />
      <div className="relative mx-auto w-full max-w-6xl px-4 py-9 sm:px-6 sm:py-14">
        {hasIndex && (
          <details className="group mb-6 overflow-hidden rounded-lg border border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_70%,transparent)] xl:hidden">
            <summary className="ui-caps-3 flex cursor-pointer list-none items-center justify-between px-3.5 py-2.5 text-[var(--text-secondary)] [&::-webkit-details-marker]:hidden">
              On this page
              <ChevronDown
                className="h-4 w-4 text-[var(--text-tertiary)] transition-transform group-open:rotate-180"
                strokeWidth={1.85}
                aria-hidden
              />
            </summary>
            <ul className="flex flex-col gap-0.5 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] p-2">
              {anchors!.map((anchor) => (
                <li key={anchor.id}>
                  <a
                    href={`#${anchor.id}`}
                    className="block rounded px-2 py-1.5 text-[13px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--accent-strong)]"
                  >
                    {anchor.label}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        )}
        <div className={hasIndex ? "xl:grid xl:grid-cols-[minmax(0,1fr)_13rem] xl:gap-x-12" : ""}>
          <div className="min-w-0">{children}</div>
          {hasIndex && (
            <aside className="hidden xl:block">
              <LegalSectionIndex items={anchors!} />
            </aside>
          )}
        </div>
      </div>
    </main>
  );
}

/**
 * Editorial document header — a warm-paper sheet framed as an artifact, opened
 * by the legal-pad margin rule (`lp-doc-margin`) and a serif title. Metadata is
 * shown as editorial label/value blocks, not pill chips.
 */
export function LegalHeader({
  eyebrow,
  title,
  lead,
  lastReviewedIso,
  lastReviewedLabel,
  lastReviewedPrefix = "Last reviewed",
  icon: Icon,
  facts,
  related,
}: {
  eyebrow: string;
  title: string;
  lead?: ReactNode;
  lastReviewedIso: string;
  lastReviewedLabel: string;
  lastReviewedPrefix?: string;
  icon?: LucideIcon;
  facts?: ReadonlyArray<{ label: string; value: ReactNode }>;
  related?: ReadonlyArray<LinkItem>;
}) {
  return (
    <header className="lp-doc-margin lp-artifact relative mb-9 overflow-hidden">
      <div aria-hidden className="lp-grain" />
      <div className="relative py-7 pl-10 pr-5 sm:py-9 sm:pl-[4.5rem] sm:pr-9">
        <p className="lp-eyebrow text-[var(--accent-strong)]">
          {Icon && <Icon className="h-4 w-4" strokeWidth={1.9} aria-hidden />}
          {eyebrow}
        </p>
        <h1 className="lp-serif mt-3 text-[2rem] leading-[1.05] text-[var(--text-primary)] sm:text-[2.6rem]">
          {title}
        </h1>
        <p className="ui-caps-3 mt-3 text-[var(--text-tertiary)]">
          {lastReviewedPrefix}{" "}
          <time dateTime={lastReviewedIso}>{lastReviewedLabel}</time>
        </p>
        {lead && (
          <p className="mt-4 max-w-2xl text-[14px] leading-[1.65] text-[var(--text-secondary)]">
            {lead}
          </p>
        )}
        {facts && facts.length > 0 && (
          <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-3 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] pt-4">
            {facts.map((fact) => (
              <div key={fact.label} className="min-w-0">
                <dt className="ui-caps-3 text-[var(--text-tertiary)]">{fact.label}</dt>
                <dd className="mt-1 max-w-[16rem] text-[12.5px] leading-snug text-[var(--text-secondary)]">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {related && related.length > 0 && (
          <nav
            aria-label="Related policies"
            className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] pt-4"
          >
            <span className="ui-caps-3 text-[var(--text-tertiary)]">Related</span>
            {related.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[12.5px] font-medium text-[var(--text-secondary)] underline-offset-[3px] transition-colors hover:text-[var(--accent-strong)] hover:underline"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}

/**
 * Open editorial section, opened by a document rule (no card box). `tone="note"`
 * renders the quieter legal-note treatment (neutral eyebrow, smaller serif) used
 * for disclaimers and precedence statements.
 */
export function LegalSection({
  id,
  eyebrow,
  title,
  lead,
  icon: Icon,
  tone = "section",
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lead?: ReactNode;
  icon?: LucideIcon;
  tone?: "section" | "note";
  children?: ReactNode;
}) {
  const isNote = tone === "note";
  return (
    <section
      id={id}
      aria-labelledby={`${id}-h`}
      className="lp-frame-rule mt-9 scroll-mt-24 pt-7"
    >
      <div className="flex items-start gap-3.5">
        {Icon && (
          <span
            aria-hidden
            className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)]"
          >
            <Icon className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.85} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p
            className={
              isNote
                ? "ui-caps-3 text-[var(--text-tertiary)]"
                : "ui-caps-1 text-[10.5px] text-[var(--accent-strong)]"
            }
          >
            {eyebrow}
          </p>
          <h2
            id={`${id}-h`}
            className={`lp-serif mt-1 text-[var(--text-primary)] ${
              isNote ? "text-[1.15rem] leading-snug" : "text-[1.4rem] leading-tight"
            }`}
          >
            {title}
          </h2>
          {lead && (
            <p className="mt-2 max-w-2xl text-[13.5px] leading-[1.6] text-[var(--text-secondary)]">
              {lead}
            </p>
          )}
          {children && <div className="mt-4">{children}</div>}
        </div>
      </div>
    </section>
  );
}

/**
 * Framed ledger artifact — a quiet caption band over fine label/value rule rows.
 * Used for the factual policy ledgers (accounts, billing, exports) where a
 * scannable record reads better than prose.
 */
export function LegalLedger({
  caption,
  rows,
}: {
  caption?: string;
  rows: ReadonlyArray<{ label: string; value: ReactNode }>;
}) {
  return (
    <div className="lp-artifact">
      {caption && (
        <div className="lp-ledger-head px-4 py-2">
          <p className="ui-caps-2 text-[10.5px] text-[var(--text-tertiary)]">{caption}</p>
        </div>
      )}
      <dl className="px-4 py-1">
        {rows.map((row) => (
          <div
            key={row.label}
            className="lp-rule-item flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5 first:border-t-0"
          >
            <dt className="ui-caps-3 shrink-0 text-[var(--text-tertiary)]">{row.label}</dt>
            <dd className="min-w-0 text-right text-[12.5px] leading-snug text-[var(--text-secondary)]">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Restrained contact action band — a quiet ruled surface with the action(s) on
 * the right. Not an oversized card.
 */
export function LegalContactBand({
  id,
  eyebrow,
  title,
  body,
  actions,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  body: ReactNode;
  actions: ReactNode;
}) {
  return (
    <section id={id} className="lp-frame-rule mt-9 scroll-mt-24 pt-7">
      <div className="flex flex-col gap-4 rounded-lg border border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_55%,transparent)] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="ui-caps-3 text-[var(--text-tertiary)]">{eyebrow}</p>
          <h2 className="lp-serif mt-1 text-[1.15rem] text-[var(--text-primary)]">{title}</h2>
          <p className="mt-1.5 max-w-prose text-[13px] leading-[1.6] text-[var(--text-secondary)]">
            {body}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      </div>
    </section>
  );
}

/** Quiet page footer — policy links and a non-promotional statement. */
export function LegalFooter({
  links,
  note,
}: {
  links: ReadonlyArray<LinkItem>;
  note: ReactNode;
}) {
  return (
    <footer className="mt-10 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-5">
      <nav aria-label="Policies" className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="ui-caps-3 text-[var(--text-tertiary)] underline-offset-[3px] transition-colors hover:text-[var(--accent-strong)] hover:underline"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <p className="mt-3 text-[11.5px] leading-[1.55] text-[var(--text-tertiary)]">{note}</p>
    </footer>
  );
}
