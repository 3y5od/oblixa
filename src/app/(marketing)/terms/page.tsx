import type { Metadata } from "next";
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
import { KeyFact, QuietCard } from "./terms-components";
import * as terms from "./terms-content";

export const metadata: Metadata = {
  title: terms.title,
  description: terms.description,
  alternates: { canonical: "/terms" },
  openGraph: { title: terms.title, description: terms.description, url: "/terms", type: "article" },
  twitter: { card: "summary_large_image", title: terms.title, description: terms.description },
};

export default function TermsPage() {
  return (
    <>
      <LegalPageJsonLd path="/terms" title={terms.title} description={terms.description} />
      <main
        id="main-content"
        tabIndex={-1}
        className="landing-luminous relative isolate flex min-h-full flex-1 flex-col overflow-hidden outline-none"
      >
        <div aria-hidden className="landing-luminous__base" />
        <div aria-hidden className="landing-luminous__glow opacity-50" />
        <div aria-hidden className="product-top-hairline" />

        <div className="relative mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
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
                  <time dateTime={terms.LAST_REVIEWED_ISO}>{terms.LAST_REVIEWED_DISPLAY}</time>
                </p>
              </div>
            </div>

            <p className="mt-5 max-w-2xl text-[13.5px] leading-[1.6] text-[var(--text-secondary)]">
              These terms are a general, public-facing summary for teams evaluating Oblixa. Binding
              commercial terms for your organization may be set out in a separate agreement, order
              form, or online checkout flow, and those controlling terms take precedence over this
              summary. Have qualified counsel review any contract before you rely on it.
            </p>

            <div className="mt-6">
              <ul className="inline-flex flex-col divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] overflow-hidden rounded-lg border border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_70%,transparent)] text-[11.5px] font-medium text-[var(--text-secondary)] sm:flex-row sm:divide-x sm:divide-y-0">
                {terms.SUMMARY_FACTS.map((fact) => (
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
              {terms.HEADER_LINKS.map((link) => (
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

          <nav
            aria-label="On this page"
            className="mt-3 flex flex-wrap gap-1 rounded-xl border border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_55%,transparent)] p-1.5"
          >
            {terms.ANCHORS.map((anchor) => (
              <a
                key={anchor.id}
                href={`#${anchor.id}`}
                className="ui-caps-3 rounded-lg px-2.5 py-1 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--accent-strong)]"
              >
                {anchor.label}
              </a>
            ))}
          </nav>

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

          <section className="mt-3 grid gap-3 md:grid-cols-2 md:items-stretch">
            <QuietCard
              id="accounts"
              eyebrow="Accounts and access"
              title="Accounts and workspace access"
              icon={KeyRound}
              scrollMargin
            >
              <dl>
                {terms.ACCOUNT_FACTS.map((fact) => (
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
                {terms.BILLING_FACTS.map((fact) => (
                  <KeyFact key={fact.k} k={fact.k} v={fact.v} />
                ))}
              </dl>
            </QuietCard>
          </section>

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

          <section className="mt-3 grid gap-3 md:grid-cols-2 md:items-stretch">
            <QuietCard
              id="exports"
              eyebrow="Portability"
              title="Exports and deletion"
              icon={Download}
              scrollMargin
            >
              <dl>
                {terms.EXPORT_FACTS.map((fact) => (
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

          <footer className="mt-8 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-5">
            <nav
              aria-label="Policies"
              className="flex flex-wrap items-center gap-x-5 gap-y-2"
            >
              {terms.FOOTER_LINKS.map((link) => (
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
              <time dateTime={terms.LAST_REVIEWED_ISO}>{terms.LAST_REVIEWED_DISPLAY}</time>.
            </p>
          </footer>
        </div>
      </main>
    </>
  );
}
