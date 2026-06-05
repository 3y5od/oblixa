import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Cog, Cookie, MessagesSquare, ShieldCheck } from "lucide-react";
import { LegalPageJsonLd } from "@/components/landing/legal-page-json-ld";

const title = "Cookies — Oblixa";
const description =
  "How Oblixa uses cookies and similar technologies for sign-in, security, and essential product operation.";
// Static review date — keep `LAST_REVIEWED_ISO` for the trust-compliance marker
// and the machine-readable <time>; the display string is the human format.
const LAST_REVIEWED_ISO = "2026-05-28";
const LAST_REVIEWED_DISPLAY = "May 28, 2026";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/cookies" },
  openGraph: { title, description, url: "/cookies", type: "article" },
  twitter: { card: "summary_large_image", title, description },
};

const HAIRLINE = "border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]";

// At-a-glance posture. Accurate to the deployed product: only essential cookies,
// no analytics, no advertising trackers.
const SUMMARY_FACTS = [
  "Essential only",
  "Authentication",
  "CSRF & security",
  "Interface preferences",
  "No analytics",
  "No advertising trackers",
] as const;

type StorageTone = "essential" | "functional" | "none";

// One row per storage category, with the concrete purpose and a status tag.
// The "Analytics & marketing" row carries the pinned "third-party advertising
// cookies" disclaimer (also present in the intro paragraph).
const STORAGE_ROWS: ReadonlyArray<{ k: string; v: string; tag: string; tone: StorageTone }> = [
  {
    k: "Authentication",
    v: "Keeps you signed in to your workspace.",
    tag: "Essential",
    tone: "essential",
  },
  {
    k: "CSRF & security",
    v: "Protects requests and forms against cross-site abuse.",
    tag: "Essential",
    tone: "essential",
  },
  {
    k: "Session continuity",
    v: "Maintains your authenticated session as you move between pages.",
    tag: "Essential",
    tone: "essential",
  },
  {
    k: "Local and session storage",
    v: "Remembers first-party interface preferences — sidebar state, table density, and unsaved upload drafts. Not used to track you.",
    tag: "Functional",
    tone: "functional",
  },
  {
    k: "Analytics & marketing",
    v: "Not used. These pages load no third-party advertising cookies or cross-site trackers.",
    tag: "Not used",
    tone: "none",
  },
];

const RELATED = [
  { href: "/privacy", label: "Privacy" },
  { href: "/security", label: "Security" },
  { href: "/terms", label: "Terms" },
  { href: "/contact", label: "Contact" },
] as const;

export default function CookiesPage() {
  return (
    <>
      <LegalPageJsonLd path="/cookies" title={title} description={description} />
      <main
        id="main-content"
        tabIndex={-1}
        className="landing-luminous relative isolate flex min-h-full flex-1 flex-col overflow-hidden outline-none"
      >
        {/* Restrained backdrop — base wash + a faint glow, no dotted grid. */}
        <div aria-hidden className="landing-luminous__base" />
        <div aria-hidden className="landing-luminous__glow opacity-40" />
        <div aria-hidden className="product-top-hairline" />

        <div className="relative mx-auto w-full max-w-4xl px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-10">
          <article className="landing-card-premium landing-card-rail relative overflow-hidden rounded-2xl border p-6 sm:p-8">
            {/* Header — icon tile + eyebrow + title on the left, reviewed-date
                metadata chip on the right. */}
            <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
              <div className="flex min-w-0 items-start gap-4">
                <span
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_38%,var(--surface-raised))] text-[var(--accent-strong)] shadow-[var(--shadow-1)]"
                  aria-hidden
                >
                  <Cookie className="h-5 w-5" strokeWidth={1.85} />
                </span>
                <div className="min-w-0">
                  <p className="landing-eyebrow-dot ui-caps-1 text-[11px] text-[var(--accent-strong)]">
                    Cookie policy
                  </p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">
                    Cookies
                  </h1>
                  <p className="mt-1.5 max-w-xl text-[13.5px] leading-snug text-[var(--text-secondary)]">
                    Storage we set for sign-in, CSRF protection, security, and core product operation.
                  </p>
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2.5 py-1">
                <span className="ui-caps-2 text-[9.5px] leading-none text-[var(--text-tertiary)]">
                  Last reviewed
                </span>
                <time dateTime={LAST_REVIEWED_ISO} className="text-[11px] font-medium leading-none text-[var(--text-secondary)]">
                  {LAST_REVIEWED_DISPLAY}
                </time>
              </span>
            </header>

            {/* Related policies — quiet quick-links near the header (sentence-case
                so they don't compete with the caps eyebrow). */}
            <nav aria-label="Related policies" className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
              <span className="text-[var(--text-tertiary)]">See also</span>
              <span aria-hidden className="h-3 w-px bg-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)]" />
              {RELATED.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="font-medium text-[var(--text-secondary)] no-underline transition-colors hover:text-[var(--accent-strong)] hover:underline hover:underline-offset-[3px] focus-visible:text-[var(--accent-strong)] focus-visible:underline focus-visible:underline-offset-[3px]"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* At-a-glance posture — informational list (not a tab control): light
                hairline, no focusable children. */}
            <ul
              aria-label="Cookie posture at a glance"
              className="mt-5 flex flex-col divide-y overflow-hidden rounded-lg border border-[color:color-mix(in_oklab,var(--border-subtle)_42%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_55%,transparent)] text-[11.5px] font-medium text-[var(--text-secondary)] divide-[color:color-mix(in_oklab,var(--border-subtle)_36%,transparent)] sm:flex-row sm:divide-x sm:divide-y-0"
            >
              {SUMMARY_FACTS.map((fact) => (
                <li key={fact} className="flex-1 whitespace-nowrap px-3 py-1.5 text-center">
                  {fact}
                </li>
              ))}
            </ul>

            <p className="mt-6 text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
              Oblixa uses cookies and first-party browser storage to keep you signed in, protect
              sessions, and run core security controls. We set only what the product needs to operate —
              no third-party advertising cookies, and no analytics or cross-site trackers on these pages.
            </p>

            {/* Storage categories — structured key-value rows. */}
            <section aria-labelledby="cookies-storage-h" className={`mt-7 border-t pt-6 ${HAIRLINE}`}>
              <p className="ui-caps-2 inline-flex items-center gap-1.5 text-[10px] text-[var(--text-tertiary)]">
                <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                What we store
              </p>
              <h2
                id="cookies-storage-h"
                className="mt-1.5 text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)]"
              >
                Essential cookies and browser storage
              </h2>
              <dl className="mt-3">
                {STORAGE_ROWS.map((row) => (
                  <StorageRow key={row.k} k={row.k} v={row.v} tag={row.tag} tone={row.tone} />
                ))}
              </dl>
            </section>

            {/* No-advertising note — quiet and flat; a small success dot signals the
                affirmative "nothing tracks you" state without dominating. */}
            <div className="mt-5 flex items-start gap-2.5 rounded-lg bg-[color:color-mix(in_oklab,var(--surface-raised)_55%,transparent)] px-3.5 py-2.5">
              <span
                className="mt-[5px] inline-flex h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: "color-mix(in oklab, var(--success-ink) 80%, transparent)" }}
                aria-hidden
              />
              <p className="text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                <span className="font-semibold text-[var(--text-primary)]">Only essential cookies are used.</span>{" "}
                No non-essential cookies or cross-site advertising trackers are set.
              </p>
            </div>

            {/* Managing cookies — practical support section. */}
            <section aria-labelledby="cookies-managing-h" className={`mt-7 border-t pt-6 ${HAIRLINE}`}>
              <p className="ui-caps-2 inline-flex items-center gap-1.5 text-[10px] text-[var(--text-tertiary)]">
                <Cog className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                Controls
              </p>
              <h2
                id="cookies-managing-h"
                className="mt-1.5 text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)]"
              >
                Managing cookies
              </h2>
              <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-[var(--text-secondary)]">
                You can clear or block cookies and site data through your browser settings. Blocking
                essential cookies prevents sign-in; clearing them signs you out until you authenticate
                again and resets stored interface preferences.
              </p>
            </section>

            {/* Questions — context lead plus one peer action cluster (a single
                privacy link, with contact as its peer). */}
            <section
              aria-labelledby="cookies-questions-h"
              className={`mt-7 flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between ${HAIRLINE}`}
            >
              <div className="min-w-0">
                <p className="ui-caps-2 inline-flex items-center gap-1.5 text-[10px] text-[var(--text-tertiary)]">
                  <MessagesSquare className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                  Questions
                </p>
                <h2
                  id="cookies-questions-h"
                  className="mt-1.5 text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)]"
                >
                  Cookies or data handling
                </h2>
                <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-[var(--text-secondary)]">
                  Cookie and data-handling questions are answered in our privacy policy. For anything
                  else, get in touch.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Link
                  href="/privacy"
                  className="ui-btn-secondary inline-flex min-h-9 max-w-max items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold"
                >
                  Privacy policy
                </Link>
                <Link
                  href="/contact"
                  className="ui-btn-ghost inline-flex min-h-9 max-w-max items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold"
                >
                  Contact
                </Link>
              </div>
            </section>

            {/* Related-policy footer strip. */}
            <footer className={`mt-6 flex flex-wrap items-center gap-x-2 gap-y-2 border-t pt-5 ${HAIRLINE}`}>
              <span className="ui-caps-2 mr-1 text-[10px] text-[var(--text-tertiary)]">Related</span>
              {RELATED.map((link, i) => (
                <span key={link.href} className="inline-flex items-center gap-x-2">
                  {i > 0 ? (
                    <span aria-hidden className="h-3 w-px bg-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)]" />
                  ) : null}
                  <Link
                    href={link.href}
                    className="text-[12px] font-medium text-[var(--text-secondary)] no-underline transition-colors hover:text-[var(--accent-strong)] hover:underline hover:underline-offset-[3px] focus-visible:text-[var(--accent-strong)] focus-visible:underline focus-visible:underline-offset-[3px]"
                  >
                    {link.label}
                  </Link>
                </span>
              ))}
            </footer>
          </article>
        </div>
      </main>
    </>
  );
}

/** One storage category: caps key + status tag on the first line, concrete
 *  purpose in a consistent description column. Hairline-separated; no per-row
 *  icon medallions. Fixed label column keeps descriptions aligned; equal-width
 *  status tags keep the chips visually balanced. */
function StorageRow({ k, v, tag, tone }: { k: string; v: string; tag: string; tone: StorageTone }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_42%,transparent)] py-3 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] sm:items-baseline sm:gap-x-6">
      <dt className="flex items-center gap-2">
        <span className="text-[12.5px] font-semibold tracking-tight text-[var(--text-primary)]">{k}</span>
        <StatusTag tone={tone}>{tag}</StatusTag>
      </dt>
      <dd className="text-[12.5px] leading-snug text-[var(--text-secondary)]">{v}</dd>
    </div>
  );
}

/** Small caps status chip — fixed width so Essential / Functional / Not used
 *  read as a balanced set. Accent for the always-on essential category; quiet
 *  neutral tones for functional and not-used so color stays a real signal. */
function StatusTag({ tone, children }: { tone: StorageTone; children: ReactNode }) {
  const styles: Record<StorageTone, string> = {
    essential:
      "border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_24%,var(--surface-raised))] text-[var(--accent-strong)]",
    functional: "border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)]",
    none: "border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-raised)_70%,transparent)] text-[var(--text-tertiary)]",
  };
  return (
    <span
      className={`ui-caps-2 inline-flex w-[5rem] shrink-0 items-center justify-center rounded-full border px-1.5 py-0.5 text-[9px] leading-none ${styles[tone]}`}
    >
      {children}
    </span>
  );
}
