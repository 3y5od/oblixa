import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronRight,
  Compass,
  KeyRound,
  LogIn,
  Mail,
  Scale,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { LegalPageJsonLd } from "@/components/landing/legal-page-json-ld";

const title = "Contact — Oblixa";
const description =
  "Contact paths for Oblixa workspace access, security, privacy, legal, billing, and existing workspace support.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/contact" },
  openGraph: { title, description, url: "/contact", type: "article" },
  twitter: { card: "summary_large_image", title, description },
};

// General async contact. Matches the support address published on /accessibility
// and in the in-app billing/settings surfaces. Security reports have their own
// path on /security (security@oblixa.io, mirrored in /.well-known/security.txt).
const GENERAL_EMAIL = "support@oblixa.com";
const GENERAL_MAILTO = `mailto:${GENERAL_EMAIL}?subject=Oblixa%20question`;

// Published public Core price (mirrors /pricing + src/lib/billing/spec-prices.ts).
const CORE_PRICE = "$249";

const HAIRLINE = "border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]";

type DirectoryRow = {
  href: string;
  icon: LucideIcon;
  title: string;
  body: string;
  verb: string;
};

// Self-serve destinations as a quiet directory. The titles
// "Security and vulnerability reports" and "Existing workspace or billing issue"
// are release-pinned positioning markers (voice-sweep + audit-release-state +
// operational launch / legal-trust config) — keep them verbatim.
const directory: DirectoryRow[] = [
  {
    href: "/security",
    icon: ShieldCheck,
    title: "Security and vulnerability reports",
    body: "Security basics, data-handling boundaries, and the vulnerability disclosure path.",
    verb: "Open security",
  },
  {
    href: "/privacy",
    icon: Scale,
    title: "Privacy, terms, and policy questions",
    body: "Public policies for privacy, terms, acceptable use, and cookies.",
    verb: "View policies",
  },
  {
    href: "/login",
    icon: LogIn,
    title: "Existing workspace or billing issue",
    body: "Sign in first so support and billing stay tied to your workspace.",
    verb: "Sign in",
  },
  {
    href: "/product",
    icon: Compass,
    title: "See how Oblixa works",
    body: "A short tour of contracts, review, renewals, work, evidence, and reports.",
    verb: "View tour",
  },
  {
    href: "/pricing",
    icon: Tag,
    title: "View Core pricing",
    body: `Core is ${CORE_PRICE}/month per workspace, charged only after approval.`,
    verb: "View pricing",
  },
];

/** Quiet directory row — the whole row is the link (large hit area); a
 *  hover/focus-revealed caps verb chip telegraphs intent (§8.6). No per-row
 *  card border (§11.14); hairlines separate rows. */
function DirectoryRowLink({ row }: { row: DirectoryRow }) {
  const Icon = row.icon;
  return (
    <Link
      href={row.href}
      aria-label={`${row.verb} — ${row.title}`}
      className={`group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3.5 border-t ${HAIRLINE} px-2 py-3.5 no-underline outline-none transition-colors first:border-t-0 hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_8%,transparent)] focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]`}
    >
      <span
        aria-hidden
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-contrast)_72%,var(--surface-raised))] text-[var(--text-tertiary)] transition-colors group-hover:border-[color:color-mix(in_oklab,var(--accent)_24%,var(--border-subtle))] group-hover:text-[var(--accent-strong)]"
      >
        <Icon className="h-4 w-4" strokeWidth={1.85} />
      </span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold leading-snug tracking-tight text-[var(--text-primary)]">
          {row.title}
        </span>
        <span className="mt-0.5 block text-[12.5px] leading-snug text-[var(--text-secondary)]">
          {row.body}
        </span>
      </span>
      <span
        aria-hidden
        className="inline-flex justify-end opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
      >
        <span className="ui-caps-2 inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-[var(--border-card)] bg-[var(--surface-raised)] px-1.5 py-1 text-[10px] leading-none text-[var(--accent-strong)]">
          {row.verb}
          <ChevronRight className="h-2.5 w-2.5" strokeWidth={1.85} />
        </span>
      </span>
    </Link>
  );
}

export default function ContactPage() {
  return (
    <>
      <LegalPageJsonLd path="/contact" title={title} description={description} />
      <main
        id="main-content"
        tabIndex={-1}
        className="landing-luminous relative isolate flex min-h-full flex-1 flex-col overflow-hidden outline-none"
      >
        {/* Restrained backdrop — base wash + faint glow, no dotted grid (parity
            with /security and /pricing). */}
        <div aria-hidden className="landing-luminous__base" />
        <div aria-hidden className="landing-luminous__glow opacity-30" />
        <div aria-hidden className="product-top-hairline" />

        <div className="relative mx-auto w-full max-w-5xl px-4 pb-12 pt-6 sm:px-6 sm:pb-16 sm:pt-8">
          <header className="mx-auto max-w-2xl text-center">
            <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--accent-strong)]">
              <span className="landing-eyebrow-dot" aria-hidden />
              Contact
            </p>
            <h1
              className="mx-auto mt-3 max-w-[14ch] text-balance text-[2rem] font-bold leading-[1.05] text-[var(--text-primary)] sm:text-[2.75rem]"
              style={{ letterSpacing: "-0.02em" }}
            >
              Contact Oblixa.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-balance text-[13.5px] leading-[1.6] text-[var(--text-secondary)] sm:text-[14.5px]">
              New workspace access starts on the request-access page; this page routes support,
              security, privacy, legal, and billing questions.
            </p>
          </header>

          {/* Primary paths — the one accent surface (request access) paired with a
              plain async email path. 60/40 split at lg so they read as connected. */}
          <section aria-label="Primary contact paths" className="mt-8 grid gap-4 lg:grid-cols-[3fr_2fr]">
            {/* Focal: request workspace access. */}
            <Link
              href="/request-access"
              className="landing-card-premium landing-card-rail group relative flex flex-col overflow-hidden rounded-2xl border p-5 no-underline outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)] sm:p-6"
            >
              <span
                aria-hidden
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_34%,var(--surface-raised))] text-[var(--accent-strong)] shadow-[var(--shadow-1)]"
              >
                <KeyRound className="h-5 w-5" strokeWidth={1.85} />
              </span>
              <p className="ui-caps-1 mt-4 text-[10.5px] text-[var(--accent-strong)]">Workspace access</p>
              <h2 className="mt-1 text-[1.25rem] font-semibold tracking-tight text-[var(--text-primary)]">
                Request workspace access
              </h2>
              <p className="mt-2 text-[13.5px] leading-[1.55] text-[var(--text-secondary)]">
                For new teams replacing a manual signed-contract follow-up tracker.
              </p>
              <p className="mt-auto pt-4 text-[12px] leading-snug text-[var(--text-tertiary)]">
                Requesting access does not create an account or charge a card.
              </p>
              <span className="ui-btn-primary mt-3 inline-flex max-w-max items-center gap-1.5 px-4 py-2 text-[13px] font-semibold">
                Request access
                <ArrowRight
                  className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                  strokeWidth={1.85}
                  aria-hidden
                />
              </span>
            </Link>

            {/* General async email — a real contact path for anyone, no sign-in. */}
            <Link
              href={GENERAL_MAILTO}
              className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-[var(--surface-raised)] p-5 no-underline shadow-[var(--shadow-1)] outline-none transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_28%,var(--border-subtle))] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)] sm:p-6 ${HAIRLINE}`}
            >
              <span
                aria-hidden
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-contrast)_72%,var(--surface-raised))] text-[var(--text-tertiary)]"
              >
                <Mail className="h-5 w-5" strokeWidth={1.85} />
              </span>
              <p className="ui-caps-1 mt-4 text-[10.5px] text-[var(--text-tertiary)]">General questions</p>
              <h2 className="mt-1 text-[1.25rem] font-semibold tracking-tight text-[var(--text-primary)]">
                Email the team
              </h2>
              <p className="mt-2 flex-1 text-[13.5px] leading-[1.55] text-[var(--text-secondary)]">
                Not sure which path fits? Send a note — async email, no account needed.
              </p>
              <span className="ui-btn-secondary mt-5 inline-flex max-w-max items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-semibold">
                <Mail className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                <span className="font-mono">{GENERAL_EMAIL}</span>
              </span>
            </Link>
          </section>

          {/* Self-serve directory — quiet hairline rows under a caps eyebrow. */}
          <section aria-label="Find the right page" className={`mt-8 border-t pt-5 ${HAIRLINE}`}>
            <p className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">Find the right page</p>
            <div className="mt-1.5">
              {directory.map((row) => (
                <DirectoryRowLink key={row.href} row={row} />
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
