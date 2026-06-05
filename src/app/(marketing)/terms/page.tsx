import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  BookOpen,
  CreditCard,
  Download,
  FileText,
  Files,
  KeyRound,
  Landmark,
  Mail,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { LegalPageJsonLd } from "@/components/landing/legal-page-json-ld";
import { ActionChip } from "@/components/ui/action-chip";

const title = "Terms of use — Oblixa";
const description =
  "How Oblixa's terms of use work: reviewed access, the paid Core plan, workspace responsibilities, customer content, AI-assisted suggestions, and the no-legal-advice boundary.";

// Hardcoded review date (no runtime date — the trust-compliance check forbids a
// computed review date so the freshness window stays auditable). LAST_REVIEWED_ISO
// also carries the source marker the legal/trust check looks for.
const LAST_REVIEWED_ISO = "2026-05-28";
const LAST_REVIEWED_DISPLAY = "May 28, 2026";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/terms" },
  openGraph: { title, description, url: "/terms", type: "article" },
  twitter: { card: "summary_large_image", title, description },
};

// Quick-read posture facts (single-line, no two-line chips), mirroring the
// trust-facts strip on /security for cross-page chrome parity.
const SUMMARY_FACTS = [
  "Reviewed access",
  "Paid Core plan",
  "Workspace responsibility",
  "No legal advice",
] as const;

// On-this-page anchor strip for the long policy article.
const ANCHORS = [
  { id: "using", label: "Using Oblixa" },
  { id: "accounts", label: "Accounts & access" },
  { id: "billing", label: "Billing" },
  { id: "acceptable-use", label: "Acceptable use" },
  { id: "content", label: "Customer content" },
  { id: "ai", label: "AI suggestions" },
  { id: "exports", label: "Exports & deletion" },
  { id: "disclaimers", label: "Disclaimers" },
  { id: "changes", label: "Changes" },
  { id: "governing", label: "Governing terms" },
  { id: "contact", label: "Contact" },
] as const;

// Related policies near the header (a focused subset; the full set sits in the
// page footer below).
const HEADER_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/security", label: "Security" },
  { href: "/acceptable-use", label: "Acceptable use" },
  { href: "/contact", label: "Contact" },
] as const;

const FOOTER_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/security", label: "Security" },
  { href: "/acceptable-use", label: "Acceptable use" },
  { href: "/cookies", label: "Cookies" },
  { href: "/accessibility", label: "Accessibility" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
] as const;

// Structured responsibility rows — caps label + value, the spec-sheet idiom
// shared with /security so account/billing terms read as facts, not prose.
const ACCOUNT_FACTS: ReadonlyArray<{ k: string; v: string }> = [
  { k: "Access", v: "By approved request or workspace invite" },
  { k: "Account creation", v: "Gated by a valid grant or invite" },
  { k: "Credentials", v: "You safeguard your own sign-in" },
  { k: "Admins", v: "Responsible for their team's use" },
  { k: "Suspected misuse", v: "Notify your admin and Oblixa" },
];

const BILLING_FACTS: ReadonlyArray<{ k: string; v: string }> = [
  { k: "Core plan", v: "$249/month per workspace" },
  { k: "Term", v: "Month-to-month" },
  { k: "When charged", v: "After access approval and explicit checkout" },
  { k: "Included", v: "Up to 500 contracts and 10 users" },
  { k: "Cancellation", v: "Effective at the end of the paid period" },
  { k: "Refunds", v: "No prorated refunds by default" },
];

const EXPORT_FACTS: ReadonlyArray<{ k: string; v: string }> = [
  { k: "Export", v: "Contract records and reports as CSV" },
  { k: "Deletion", v: "Workspace data deletion on request" },
  { k: "Report files", v: "Download links expire after 7 days" },
  { k: "After deletion", v: "Removed within 30 days of the recovery window" },
];

export default function TermsPage() {
  return (
    <>
      <LegalPageJsonLd path="/terms" title={title} description={description} />
      <main
        id="main-content"
        tabIndex={-1}
        className="landing-luminous relative isolate flex min-h-full flex-1 flex-col overflow-hidden outline-none"
      >
        {/* Restrained backdrop — base wash + softened glow, no dotted grid, so
            the policy content reads quietly (parity with /security). */}
        <div aria-hidden className="landing-luminous__base" />
        <div aria-hidden className="landing-luminous__glow opacity-50" />
        <div aria-hidden className="product-top-hairline" />

        <div className="relative mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
          {/* Header — the single focal surface: premium legal shell with icon
              tile + eyebrow + title, quiet date metadata, intro, posture strip,
              and related-policy links. */}
          <header className="landing-card-premium landing-card-rail relative overflow-hidden rounded-2xl border p-6 sm:p-8">
            <div className="flex items-start gap-3.5">
              <span
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_38%,var(--surface-raised))] text-[var(--accent-strong)] shadow-[var(--shadow-1)]"
                aria-hidden
              >
                <FileText className="h-5 w-5" strokeWidth={1.85} />
              </span>
              <div className="min-w-0">
                <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[10.5px] text-[var(--accent-strong)]">
                  <span className="landing-eyebrow-dot" aria-hidden />
                  Service terms
                </p>
                <h1 className="mt-1.5 text-[1.85rem] font-semibold leading-[1.1] tracking-tight text-[var(--text-primary)] sm:text-[2.25rem]">
                  Terms of use
                </h1>
                <p className="ui-caps-3 mt-1.5 text-[var(--text-tertiary)]">
                  Last updated{" "}
                  <time dateTime={LAST_REVIEWED_ISO}>{LAST_REVIEWED_DISPLAY}</time>
                </p>
              </div>
            </div>

            <p className="mt-5 max-w-2xl text-[13.5px] leading-[1.6] text-[var(--text-secondary)]">
              These terms are a general, public-facing summary for teams evaluating Oblixa. Binding
              commercial terms for your organization may be set out in a separate agreement, order
              form, or online checkout flow, and those controlling terms take precedence over this
              summary. Have qualified counsel review any contract before you rely on it.
            </p>

            {/* Posture strip — quick single-line answers. */}
            <div className="mt-6">
              <ul className="inline-flex flex-col divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] overflow-hidden rounded-lg border border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_70%,transparent)] text-[11.5px] font-medium text-[var(--text-secondary)] sm:flex-row sm:divide-x sm:divide-y-0">
                {SUMMARY_FACTS.map((fact) => (
                  <li key={fact} className="whitespace-nowrap px-3.5 py-1.5 text-center">
                    {fact}
                  </li>
                ))}
              </ul>
            </div>

            <nav
              aria-label="Related policies"
              className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] pt-4"
            >
              <span className="ui-caps-3 text-[var(--text-tertiary)]">Related</span>
              {HEADER_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-[12.5px] font-medium text-[var(--text-secondary)] underline-offset-[3px] transition-colors hover:text-[var(--accent-strong)] hover:underline"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </header>

          {/* On-this-page anchor strip. */}
          <nav
            aria-label="On this page"
            className="mt-3 flex flex-wrap gap-1 rounded-xl border border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_55%,transparent)] p-1.5"
          >
            {ANCHORS.map((anchor) => (
              <a
                key={anchor.id}
                href={`#${anchor.id}`}
                className="ui-caps-3 rounded-lg px-2.5 py-1 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--accent-strong)]"
              >
                {anchor.label}
              </a>
            ))}
          </nav>

          {/* Using Oblixa — sets the scope before the detailed terms. */}
          <section className="mt-3">
            <QuietCard
              id="using"
              eyebrow="Service scope"
              title="Using Oblixa"
              icon={BookOpen}
              scrollMargin
            >
              <p className="text-[13px] leading-[1.6] text-[var(--text-secondary)]">
                Oblixa is a workspace for signed-contract follow-up — reviewing key fields, assigning
                owners, tracking renewal and notice dates, managing obligations, requesting evidence,
                and exporting reports. It does not draft, negotiate, or sign agreements, and it does
                not make decisions for you. Use it only for agreements your organization is
                authorized to track.
              </p>
            </QuietCard>
          </section>

          {/* Accounts + Billing — paired structured-row cards. */}
          <section className="mt-3 grid gap-3 md:grid-cols-2 md:items-stretch">
            <QuietCard
              id="accounts"
              eyebrow="Accounts and access"
              title="Accounts and workspace access"
              icon={KeyRound}
              scrollMargin
            >
              <dl>
                {ACCOUNT_FACTS.map((fact) => (
                  <KeyFact key={fact.k} k={fact.k} v={fact.v} />
                ))}
              </dl>
            </QuietCard>

            <QuietCard
              id="billing"
              eyebrow="Billing"
              title="Billing and paid continuation"
              icon={CreditCard}
              scrollMargin
            >
              <dl>
                {BILLING_FACTS.map((fact) => (
                  <KeyFact key={fact.k} k={fact.k} v={fact.v} />
                ))}
              </dl>
            </QuietCard>
          </section>

          {/* Acceptable use — short summary that links to the full policy. */}
          <section className="mt-3">
            <QuietCard
              id="acceptable-use"
              eyebrow="Acceptable use"
              title="Use the service responsibly"
              icon={ShieldCheck}
              scrollMargin
            >
              <p className="text-[13px] leading-[1.6] text-[var(--text-secondary)]">
                Don&apos;t misuse the service — including attempting to reach workspaces you are not
                authorized for, probing it in ways that harm availability or security, scraping or
                reselling it, or uploading unlawful content. Each workspace is responsible for its
                members&apos; actions.
              </p>
              <div className="mt-3">
                <ActionChip verb="Read the acceptable use policy" href="/acceptable-use" />
              </div>
            </QuietCard>
          </section>

          {/* Customer content + AI — paired cards. */}
          <section className="mt-3 grid gap-3 md:grid-cols-2 md:items-stretch">
            <QuietCard
              id="content"
              eyebrow="Your data"
              title="Customer content and contract files"
              icon={Files}
              scrollMargin
            >
              <p className="text-[13px] leading-[1.6] text-[var(--text-secondary)]">
                You keep ownership of the agreements, files, and data you upload, and you confirm you
                have the right to store and process them in your workspace. Workspace data is scoped
                to your organization and visible by role. Don&apos;t upload regulated data classes
                without a written addendum that covers them.
              </p>
            </QuietCard>

            <QuietCard
              id="ai"
              eyebrow="AI and review"
              title="AI-assisted suggestions"
              icon={Sparkles}
              scrollMargin
            >
              <p className="text-[13px] leading-[1.6] text-[var(--text-secondary)]">
                Where you use extraction, uploaded contract text may be sent to our AI provider only
                to suggest fields. Suggestions stay tied to a source snippet and remain suggested
                until a person on your team reviews them. Oblixa does not guarantee extraction
                accuracy, and suggested values are not trusted data until reviewed.
              </p>
            </QuietCard>
          </section>

          {/* Exports/deletion + Changes — paired cards. */}
          <section className="mt-3 grid gap-3 md:grid-cols-2 md:items-stretch">
            <QuietCard
              id="exports"
              eyebrow="Portability"
              title="Exports and deletion"
              icon={Download}
              scrollMargin
            >
              <dl>
                {EXPORT_FACTS.map((fact) => (
                  <KeyFact key={fact.k} k={fact.k} v={fact.v} />
                ))}
              </dl>
            </QuietCard>

            <QuietCard
              id="changes"
              eyebrow="Updates"
              title="Changes to these terms"
              icon={RefreshCw}
              scrollMargin
            >
              <p className="text-[13px] leading-[1.6] text-[var(--text-secondary)]">
                We may update these terms. Material changes to customer agreements are handled
                through the channel that governs your subscription — for example, updated terms
                presented in the product or through your vendor process. Continued use after an
                update means you accept the revised terms.
              </p>
            </QuietCard>
          </section>

          {/* Disclaimers — quiet hairline legal note carrying the required
              "does not provide legal advice" boundary. */}
          <section
            id="disclaimers"
            aria-labelledby="terms-disclaimers-h"
            className="mt-6 flex scroll-mt-24 gap-3 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-5"
          >
            <span
              aria-hidden
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-tertiary)]"
            >
              <Scale className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.85} />
            </span>
            <div className="min-w-0">
              <p className="ui-caps-3 text-[var(--text-tertiary)]">Legal note</p>
              <h2
                id="terms-disclaimers-h"
                className="mt-0.5 text-[1rem] font-semibold tracking-tight text-[var(--text-primary)]"
              >
                Disclaimers and limits
              </h2>
              <p className="mt-1 max-w-2xl text-[13px] leading-[1.6] text-[var(--text-secondary)]">
                Oblixa helps teams run signed-contract follow-up. It does not provide legal advice,
                legal analysis, or a substitute for qualified counsel, and it is provided without
                warranties beyond those required by law. You remain responsible for your agreements,
                compliance obligations, and decisions.
              </p>
            </div>
          </section>

          {/* Governing terms — non-placeholder fallback; the controlling
              agreement always wins. */}
          <section
            id="governing"
            aria-labelledby="terms-governing-h"
            className="mt-6 flex scroll-mt-24 gap-3 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-5"
          >
            <span
              aria-hidden
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-tertiary)]"
            >
              <Landmark className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.85} />
            </span>
            <div className="min-w-0">
              <p className="ui-caps-3 text-[var(--text-tertiary)]">Precedence</p>
              <h2
                id="terms-governing-h"
                className="mt-0.5 text-[1rem] font-semibold tracking-tight text-[var(--text-primary)]"
              >
                Governing terms
              </h2>
              <p className="mt-1 max-w-2xl text-[13px] leading-[1.6] text-[var(--text-secondary)]">
                Where a separate signed agreement, order form, or checkout governs your subscription,
                that agreement controls and overrides this public summary. Governing law and venue
                follow the controlling agreement; if none applies, the standard terms presented at
                sign-up govern. This page does not create rights beyond your executed terms.
              </p>
            </div>
          </section>

          {/* Contact — terms, billing, and access questions. */}
          <section className="mt-6">
            <QuietCard
              id="contact"
              eyebrow="Questions"
              title="Terms, billing, or access questions"
              icon={Mail}
              scrollMargin
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-prose text-[13px] leading-[1.6] text-[var(--text-secondary)]">
                  Reach us asynchronously about these terms, billing, or workspace access and
                  we&apos;ll route it to the right place.
                </p>
                <ActionChip verb="Contact Oblixa" href="/contact" className="shrink-0" />
              </div>
            </QuietCard>
          </section>

          {/* Intentional ending — related policies + review date. */}
          <footer className="mt-8 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-5">
            <nav
              aria-label="Policies"
              className="flex flex-wrap items-center gap-x-5 gap-y-2"
            >
              {FOOTER_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="ui-caps-3 text-[var(--text-tertiary)] underline-offset-[3px] transition-colors hover:text-[var(--accent-strong)] hover:underline"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <p className="mt-3 text-[11.5px] leading-[1.55] text-[var(--text-tertiary)]">
              Oblixa is a workspace for signed-contract follow-up, not a law firm. Last updated{" "}
              <time dateTime={LAST_REVIEWED_ISO}>{LAST_REVIEWED_DISPLAY}</time>.
            </p>
          </footer>
        </div>
      </main>
    </>
  );
}

/** Caps label + value on a hairline — a structured replacement for "Label:
 *  value" prose, so account/billing terms scan as a spec sheet (parity with
 *  /security). */
function KeyFact({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_50%,transparent)] py-2 first:border-t-0 first:pt-0">
      <dt className="ui-caps-3 shrink-0 text-[var(--text-tertiary)]">{k}</dt>
      <dd className="min-w-0 text-right text-[12.5px] leading-snug text-[var(--text-secondary)]">
        {v}
      </dd>
    </div>
  );
}

/** Quiet supporting card — neutral icon tile keeps accent reserved for links
 *  and the focal header, so the article reads calmly below the premium shell. */
function QuietCard({
  id,
  eyebrow,
  title,
  icon: Icon,
  scrollMargin = false,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  icon: LucideIcon;
  scrollMargin?: boolean;
  children: ReactNode;
}) {
  return (
    <article
      id={id}
      className={`relative flex flex-col rounded-2xl border border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_55%,transparent)] p-5${
        scrollMargin ? " scroll-mt-24" : ""
      }`}
    >
      <span
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)]"
        aria-hidden
      >
        <Icon className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.85} />
      </span>
      <p className="ui-caps-1 mt-3.5 text-[10.5px] text-[var(--accent-strong)]">{eyebrow}</p>
      <h2 className="mt-1.5 text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)]">
        {title}
      </h2>
      <div className="mt-3 flex-1">{children}</div>
    </article>
  );
}
