import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import {
  Accessibility,
  Activity,
  ArrowRight,
  Eye,
  FormInput,
  Info,
  Keyboard,
  ListTree,
  Mail,
  MessagesSquare,
  MonitorSmartphone,
} from "lucide-react";
import { LegalPageJsonLd } from "@/components/landing/legal-page-json-ld";
import { ActionChip } from "@/components/ui/action-chip";

const title = "Accessibility — Oblixa";
const description =
  "Oblixa's accessibility posture: keyboard operation, visible focus, semantic structure, labelled forms, reduced motion, and how to report a barrier.";

// Review date — machine form for the <time> element, display form for humans.
const LAST_REVIEWED_ISO = "2026-05-28";
const LAST_REVIEWED_DISPLAY = "May 28, 2026";

// Public, already-published support address (the same general inbox billing and
// security recovery copy uses). Accessibility feedback routes through the public
// /contact route or this inbox — both reach the support team, no account needed.
const SUPPORT_EMAIL = "support@oblixa.com";
const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=Accessibility%20feedback`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/accessibility" },
  openGraph: { title, description, url: "/accessibility", type: "article" },
  twitter: { card: "summary_large_image", title, description },
};

const HAIRLINE = "border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]";

// Compact "at a glance" tokens — concrete and supportable. Quiet caps pills
// (not a segmented bar) so the strip reads as metadata, not a tab control.
const SUMMARY_FACTS = [
  "Keyboard-operable",
  "Visible focus",
  "Semantic landmarks",
  "WCAG AA contrast target",
  "Reduced motion honored",
] as const;

// The six commitments — concise, even-length bodies, even count → balanced grid.
const COMMITMENTS: ReadonlyArray<{ icon: LucideIcon; title: string; body: string }> = [
  {
    icon: Keyboard,
    title: "Keyboard navigation",
    body:
      "Navigation, forms, and disclosures are keyboard-reachable in visual order, with a skip link straight to the main content.",
  },
  {
    icon: Eye,
    title: "Visible focus",
    body:
      "Every interactive element keeps a visible focus ring, and standard text is designed toward WCAG AA contrast in light and dark mode.",
  },
  {
    icon: ListTree,
    title: "Semantic structure",
    body:
      "Landmark regions and ordered headings let screen readers move between sections; ARIA is used only where a native element falls short.",
  },
  {
    icon: FormInput,
    title: "Forms and labels",
    body:
      "Fields carry programmatic labels, required fields are marked for assistive technology, and errors are announced next to the field.",
  },
  {
    icon: Activity,
    title: "Reduced motion",
    body:
      "When your system requests reduced motion, non-essential animation is dropped and transitions are turned off instead of moving content.",
  },
  {
    icon: MonitorSmartphone,
    title: "Responsive and zoom",
    body:
      "Layouts reflow down to small screens and stay usable at 200% browser zoom without hiding content or primary actions.",
  },
];

// What helps us reproduce a reported barrier.
const REPORT_HINTS = [
  "The page or link where it happened",
  "What you were trying to do",
  "Your browser and device",
  "Any assistive technology you use",
  "How you'd like us to reply",
] as const;

const RELATED = [
  { label: "Security", href: "/security" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Contact", href: "/contact" },
] as const;

export default function AccessibilityPage() {
  return (
    <>
      <LegalPageJsonLd path="/accessibility" title={title} description={description} />
      <main
        id="main-content"
        tabIndex={-1}
        className="landing-luminous relative isolate flex min-h-full flex-1 flex-col overflow-hidden outline-none"
      >
        {/* Restrained backdrop — base wash + faint glow, no dotted grid. */}
        <div aria-hidden className="landing-luminous__base" />
        <div aria-hidden className="landing-luminous__glow opacity-40" />
        <div aria-hidden className="product-top-hairline" />

        <div className="relative mx-auto w-full max-w-4xl px-4 pb-12 pt-6 sm:px-6 sm:pb-16 sm:pt-8">
          {/* Focal header card — the single premium surface on the page. */}
          <article className="landing-card-premium landing-card-rail relative overflow-hidden rounded-2xl border p-6 sm:p-7">
            <div className="flex items-start gap-3.5">
              <span
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_36%,var(--surface-raised))] text-[var(--accent-strong)] shadow-[var(--shadow-1)]"
                aria-hidden
              >
                <Accessibility className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />
              </span>
              <div className="min-w-0">
                <p>
                  <span className="landing-eyebrow-dot ui-caps-1 text-[10.5px] text-[var(--accent-strong)]">
                    Inclusive design
                  </span>
                </p>
                <h1 className="mt-1 text-[1.75rem] font-semibold leading-[1.1] tracking-tight text-[var(--text-primary)] sm:text-[2rem]">
                  Accessibility
                </h1>
                <p className="mt-1.5 max-w-2xl text-[13.5px] leading-snug text-[var(--text-secondary)]">
                  How Oblixa designs the product to work with a keyboard, a screen reader, and
                  reduced motion — and how to tell us when something gets in the way.
                </p>
                <p className="mt-2 text-[11px] leading-none">
                  <span className="ui-caps-2 text-[var(--text-tertiary)]">Reviewed</span>{" "}
                  <time
                    dateTime={LAST_REVIEWED_ISO}
                    className="ml-0.5 font-medium tabular-nums text-[var(--text-secondary)]"
                  >
                    {LAST_REVIEWED_DISPLAY}
                  </time>
                </p>
              </div>
            </div>

            {/* At-a-glance tokens — quiet caps pills, wrap cleanly, not a tab bar. */}
            <div className={`mt-4 border-t pt-3.5 ${HAIRLINE}`}>
              <ul className="flex flex-wrap gap-1.5">
                {SUMMARY_FACTS.map((fact) => (
                  <li
                    key={fact}
                    className="ui-caps-3 inline-flex items-center rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-raised)_55%,transparent)] px-2.5 py-1 text-[10px] text-[var(--text-tertiary)]"
                  >
                    {fact}
                  </li>
                ))}
              </ul>
            </div>
          </article>

          {/* Commitments — flat 2-column grid of icon-led rows. Neutral tiles keep
              accent reserved for the page identity, actions, and links. */}
          <section aria-labelledby="a11y-commit-h" className={`mt-7 border-t pt-6 ${HAIRLINE}`}>
            <p className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">Commitments</p>
            <h2
              id="a11y-commit-h"
              className="mt-1 text-[0.95rem] font-semibold tracking-tight text-[var(--text-primary)]"
            >
              What we keep accessible
            </h2>
            <p className="mt-1 max-w-2xl text-[12.5px] leading-snug text-[var(--text-tertiary)]">
              Public pages and a defined set of product routes are checked with automated
              accessibility scans in our test suite.
            </p>
            <div className="mt-5 grid gap-x-10 gap-y-5 sm:grid-cols-2">
              {COMMITMENTS.map((item) => (
                <Commitment key={item.title} icon={item.icon} title={item.title} body={item.body} />
              ))}
            </div>
          </section>

          {/* Report a barrier — the page's primary action area. Quiet accent band,
              lighter than the premium header card. */}
          <section aria-labelledby="a11y-report-h" className="mt-7">
            <div className="rounded-2xl border border-[color:color-mix(in_oklab,var(--accent)_18%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_12%,var(--surface-raised))] p-5 sm:p-6">
              <div className="flex items-start gap-3.5">
                <span
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_28%,var(--border-subtle))] bg-[var(--surface-raised)] text-[var(--accent-strong)] shadow-[var(--shadow-1)]"
                  aria-hidden
                >
                  <MessagesSquare className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="ui-caps-1 text-[10.5px] text-[var(--accent-strong)]">Support</p>
                  <h2
                    id="a11y-report-h"
                    className="mt-1 text-[1.15rem] font-semibold tracking-tight text-[var(--text-primary)]"
                  >
                    Report a barrier
                  </h2>
                  <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-[var(--text-secondary)]">
                    If something stops you from completing a task, tell us and we&apos;ll route it to
                    the team that can fix it. You don&apos;t need an Oblixa account to send a report.
                  </p>

                  <div className="mt-4">
                    <p className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">
                      What helps us fix it faster
                    </p>
                    <ul className="mt-2 grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
                      {REPORT_HINTS.map((hint) => (
                        <li
                          key={hint}
                          className="flex items-start gap-2 text-[12px] leading-snug text-[var(--text-secondary)]"
                        >
                          <span
                            aria-hidden
                            className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--border-strong)]"
                          />
                          <span>{hint}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Link
                      href="/contact"
                      prefetch={false}
                      className="ui-btn-primary inline-flex min-h-10 items-center gap-1.5 px-4 py-2 text-[13px] font-semibold"
                    >
                      Contact us
                      <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                    </Link>
                    <Link
                      href={SUPPORT_MAILTO}
                      className="ui-btn-secondary inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold"
                    >
                      <Mail className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                      <span>
                        Email <span className="font-mono">{SUPPORT_EMAIL}</span>
                      </span>
                    </Link>
                  </div>
                  <p className="mt-2 text-[11.5px] leading-snug text-[var(--text-tertiary)]">
                    Either option reaches the Oblixa support team.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Conformance — quiet, honest boundary (no over-claim). */}
          <section aria-labelledby="a11y-conformance-h" className={`mt-7 flex gap-3 border-t pt-6 ${HAIRLINE}`}>
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden />
            <div className="min-w-0">
              <p className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">Conformance</p>
              <h2
                id="a11y-conformance-h"
                className="mt-1 text-[0.95rem] font-semibold tracking-tight text-[var(--text-primary)]"
              >
                What we target, and what we don&apos;t claim
              </h2>
              <p className="mt-1 max-w-2xl text-[12.5px] leading-[1.5] text-[var(--text-secondary)]">
                We don&apos;t claim formal conformance or third-party certification. Oblixa targets
                WCAG 2.2 AA, and we treat reported barriers as priority fixes.
              </p>
            </div>
          </section>

          {/* Related policies / contact — same ActionChip link primitive as /security. */}
          <nav aria-label="Related policies" className={`mt-7 border-t pt-6 ${HAIRLINE}`}>
            <p className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">Related</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {RELATED.map((link) => (
                <ActionChip key={link.href} verb={link.label} href={link.href} />
              ))}
            </div>
          </nav>
        </div>
      </main>
    </>
  );
}

/** Icon-led commitment row: neutral tile + title + concise body. Flat (no card)
 *  so the six rows read as one grouped set, not a wall of boxes. */
function Commitment({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="flex gap-3.5">
      <span
        className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)]"
        aria-hidden
      >
        <Icon className="h-4 w-4" strokeWidth={1.85} />
      </span>
      <div className="min-w-0">
        <h3 className="text-[13.5px] font-semibold tracking-tight text-[var(--text-primary)]">{title}</h3>
        <p className="mt-1 text-[12.5px] leading-snug text-[var(--text-secondary)]">{body}</p>
      </div>
    </div>
  );
}
