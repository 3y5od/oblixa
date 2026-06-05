import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  CircleDollarSign,
  ListChecks,
  ShieldCheck,
} from "lucide-react";
import { LegalPageJsonLd } from "@/components/landing/legal-page-json-ld";
import { GradientPhrase } from "@/components/ui/gradient-phrase";
import { KeyValueChip } from "@/components/ui/key-value-chip";

const title = "Pricing — Oblixa";
const description =
  "Oblixa Core is $249 per month, per workspace, billed month-to-month. Access is reviewed first; you are charged only after access is approved and you complete checkout.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/pricing" },
  openGraph: { title, description, url: "/pricing", type: "article" },
  twitter: { card: "summary_large_image", title, description },
};

// Published public Core price. This is the release-contract figure
// (oblixa-release-state.md §Billing, Pricing, And Cancellation). The in-app
// billing layer (src/lib/billing/spec-prices.ts) is the system of record for
// what Stripe charges and must be kept in sync with this published price.
const CORE_PRICE = "$249";

// Code-owned Core inclusion limits (mirror SETTINGS_BILLING_STRINGS.coreLimits).
const planFacts = [
  { label: "Contracts", value: "Up to 500" },
  { label: "Users", value: "Up to 10" },
  { label: "Billing", value: "Month-to-month" },
  { label: "Checkout", value: "After approval" },
] as const;

// Included Core capabilities, grouped by workflow stage.
const capabilities = [
  { group: "Add", detail: "Upload signed PDFs and DOCX, or import a spreadsheet tracker" },
  { group: "Review", detail: "Approve source-backed suggested fields" },
  { group: "Track", detail: "Owners, renewals, notice dates, and work" },
  { group: "Collect", detail: "Request and review evidence" },
  { group: "Report", detail: "Operational reports and CSV export" },
  { group: "Admin", detail: "Team access and workspace settings" },
] as const;

const policy = [
  {
    label: "Access",
    value: "Request access first — review keeps contract data and setup bounded.",
  },
  {
    label: "Checkout",
    value: "Charged only after approval and explicit checkout.",
  },
  {
    label: "Term",
    value: "Month-to-month. Cancel and export any time.",
  },
] as const;

const exclusions = [
  "Self-serve signup",
  "Annual lock-in",
  "Plan tiers or add-ons",
  "Custom migration",
  "Legal review",
  "Guaranteed SLAs",
] as const;

const faq = [
  {
    question: "What does Oblixa cost?",
    answer:
      "Core is one plan — $249 per workspace, billed each month. No separate tiers or add-ons, and billing starts only after your access is approved and you complete checkout.",
  },
  {
    question: "What happens after access is approved?",
    answer:
      "You create your workspace, upload or import a small set of signed contracts, and review the first source-backed fields. Paid Core continues monthly once you complete checkout.",
  },
  {
    question: "Do we need to migrate every contract?",
    answer:
      "No. The recommended start is a small subset or a redacted sample set so the workflow can be validated before any larger migration.",
  },
  {
    question: "Does Oblixa replace contract drafting or e-signature tools?",
    answer:
      "No. Oblixa starts after contracts are signed and focuses on tracking dates, owners, obligations, evidence, and reports. It does not draft, redline, or e-sign, and it does not provide legal advice.",
  },
  {
    question: "Can we cancel or export our data?",
    answer:
      "Yes. You can export contract records and operational reports at any time, and export access remains during the cancellation window.",
  },
  {
    question: "When would paid use start?",
    answer:
      "Only after approval and explicit checkout. There is no automatic charge on access request, account creation, upload, import, or workspace activation.",
  },
] as const;

export default function PricingPage() {
  return (
    <>
      <LegalPageJsonLd path="/pricing" title={title} description={description} />
      <main
        id="main-content"
        tabIndex={-1}
        className="landing-luminous relative isolate flex min-h-full flex-1 flex-col overflow-hidden outline-none"
      >
        <div aria-hidden className="landing-luminous__base" />
        <div aria-hidden className="landing-luminous__glow opacity-30" />
        <div aria-hidden className="product-top-hairline" />

        <div className="relative mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-7">
          {/* Hero — identity on the left, the focal price card (wider column) on
              the right. Columns top-align so the title block and card share a top
              axis; the price reads larger than the headline so the card wins. */}
          <section className="grid items-start gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
            <div className="text-center lg:text-left">
              <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--accent-strong)]">
                <span className="landing-eyebrow-dot" aria-hidden />
                Pricing
              </p>
              <h1
                className="mt-3 text-balance text-[2rem] font-bold leading-[1.06] tracking-tight text-[var(--text-primary)] sm:text-[2.75rem]"
                style={{ letterSpacing: "-0.02em" }}
              >
                Simple pricing for contract <GradientPhrase>tracking</GradientPhrase>.
              </h1>
              <p className="mx-auto mt-4 max-w-sm text-balance text-[14.5px] leading-[1.6] text-[var(--text-secondary)] sm:text-[15.5px] lg:mx-0">
                Oblixa Core is one paid plan. Access is reviewed first, so each workspace
                starts with a clear owner and a bounded contract set.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                <Link
                  href="/request-access"
                  className="product-cta-halo ui-btn-primary inline-flex min-h-10 items-center gap-1.5 px-4 py-2 text-[13px] font-semibold"
                >
                  Request access
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                </Link>
                <Link
                  href="#included"
                  className="ui-btn-ghost inline-flex min-h-10 items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold"
                >
                  See included features
                </Link>
              </div>
            </div>

            {/* Focal surface: the one premium card on the page. */}
            <article className="landing-card-premium landing-card-static relative overflow-hidden rounded-3xl border p-6 sm:p-7">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,var(--surface-raised))] text-[var(--accent-strong)] shadow-[var(--shadow-1)]"
                >
                  <CircleDollarSign className="h-5 w-5" strokeWidth={1.85} />
                </span>
                <div className="min-w-0">
                  <p className="ui-caps-1 text-[10.5px] text-[var(--accent-strong)]">Core plan</p>
                  <p className="text-[12.5px] text-[var(--text-secondary)]">
                    One workspace for signed-contract follow-up
                  </p>
                </div>
              </div>

              <div className="mt-5 flex items-baseline gap-1.5">
                <span className="text-[3.75rem] font-bold leading-none tabular-nums tracking-[-0.02em] text-[var(--text-primary)]">
                  {CORE_PRICE}
                </span>
                <span className="text-[17px] font-semibold text-[var(--text-secondary)]">/month</span>
              </div>
              <p className="mt-2 text-[12.5px] text-[var(--text-tertiary)]">
                Per workspace.
              </p>

              <div className="mt-5 grid grid-cols-2 justify-items-start gap-2 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] pt-4">
                {planFacts.map((fact) => (
                  <KeyValueChip key={fact.label} label={fact.label} value={fact.value} />
                ))}
              </div>
            </article>
          </section>

          {/* Offer detail — inclusions lead (3fr); the access/billing policy is the
              quieter companion (2fr). Equal-height (grid default stretch). */}
          <section
            id="included"
            className="mt-8 grid gap-4 lg:grid-cols-[3fr_2fr]"
            aria-labelledby="pricing-included-heading"
          >
            <article className="ui-card-raised flex flex-col rounded-2xl border p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,var(--surface-raised))] text-[var(--accent-strong)] shadow-[var(--shadow-1)]"
                >
                  <ListChecks className="h-5 w-5" strokeWidth={1.85} />
                </span>
                <div className="min-w-0">
                  <p className="ui-caps-1 text-[10.5px] text-[var(--accent-strong)]">Included in Core</p>
                  <h2
                    id="pricing-included-heading"
                    className="text-[1.2rem] font-semibold leading-tight tracking-tight text-[var(--text-primary)]"
                  >
                    From upload to report
                  </h2>
                </div>
              </div>

              <dl className="mt-5 grid gap-x-6 gap-y-3.5 sm:grid-cols-2">
                {capabilities.map((cap) => (
                  <div key={cap.group}>
                    <dt className="ui-caps-2 text-[var(--text-tertiary)]">{cap.group}</dt>
                    <dd className="mt-0.5 text-[12.5px] leading-[1.45] text-[var(--text-secondary)]">
                      {cap.detail}
                    </dd>
                  </div>
                ))}
              </dl>

              <p className="mt-auto border-t border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] pt-4 text-[12px] leading-[1.5] text-[var(--text-tertiary)]">
                <span className="ui-caps-2 text-[var(--text-secondary)]">Start small</span>
                {" — begin with a bounded contract set before any larger migration."}
              </p>
            </article>

            <aside className="ui-card flex flex-col rounded-2xl border p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-secondary)] shadow-[var(--shadow-1)]"
                >
                  <ShieldCheck className="h-5 w-5" strokeWidth={1.85} />
                </span>
                <div className="min-w-0">
                  <p className="ui-caps-1 text-[10.5px] text-[var(--text-tertiary)]">How it works</p>
                  <h2 className="text-[1.1rem] font-semibold leading-tight tracking-tight text-[var(--text-primary)]">
                    Access and billing
                  </h2>
                </div>
              </div>

              <dl className="mt-5 grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-3">
                {policy.map((item) => (
                  <Fragment key={item.label}>
                    <dt className="ui-caps-2 text-[var(--text-tertiary)]">{item.label}</dt>
                    <dd className="text-[12.5px] leading-[1.5] text-[var(--text-secondary)]">
                      {item.value}
                    </dd>
                  </Fragment>
                ))}
              </dl>

              <div className="mt-auto border-t border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] pt-4">
                <p className="ui-caps-2 text-[var(--text-tertiary)]">Exclusions</p>
                <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1.5 text-[11.5px] leading-[1.5] text-[var(--text-tertiary)] sm:grid-cols-2">
                  {exclusions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </aside>
          </section>

          {/* Pricing questions — single column; cost answer open by default. */}
          <section className="mt-6" aria-labelledby="pricing-faq-heading">
            <header className="mx-auto max-w-2xl text-center">
              <h2
                id="pricing-faq-heading"
                className="text-[1.5rem] font-semibold tracking-tight text-[var(--text-primary)] sm:text-[1.8rem]"
              >
                Pricing questions
              </h2>
              <p className="mt-2 text-[14px] leading-[1.6] text-[var(--text-secondary)]">
                Plain answers about the Core offer and paid continuation.
              </p>
            </header>
            <div className="landing-faq-list mx-auto mt-6 max-w-3xl border-t border-[color:color-mix(in_oklab,var(--border-subtle)_65%,transparent)]">
              {faq.map((item, idx) => (
                <details
                  key={item.question}
                  open={idx === 0}
                  className="landing-faq-row group border-b border-[color:color-mix(in_oklab,var(--border-subtle)_65%,transparent)]"
                >
                  <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg px-3 py-4 outline-none transition-colors marker:hidden hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_50%,transparent)] focus-visible:bg-[color:color-mix(in_oklab,var(--surface-muted)_50%,transparent)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--focus-ring)] [&::-webkit-details-marker]:hidden">
                    <h3 className="flex-1 text-[14.5px] font-semibold leading-snug tracking-tight text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-strong)]">
                      {item.question}
                    </h3>
                    <ChevronDown
                      className="h-5 w-5 shrink-0 self-center text-[var(--text-tertiary)] transition-transform group-open:rotate-180 group-hover:text-[var(--accent-strong)]"
                      strokeWidth={1.85}
                      aria-hidden
                    />
                  </summary>
                  <div className="max-w-[60ch] pb-4 pl-3 pr-10 text-[13.5px] leading-[1.65] text-[var(--text-secondary)]">
                    {item.answer}
                  </div>
                </details>
              ))}
            </div>
          </section>

          {/* Deliberate close — a light strip sitting close under the FAQ. */}
          <section className="mt-6">
            <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_45%,transparent)] px-6 py-5 text-center sm:flex-row sm:gap-4 sm:text-left">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold leading-snug text-[var(--text-primary)]">
                  Request access for Core at {CORE_PRICE}/month.
                </p>
                <p className="mt-1 text-[12px] leading-[1.5] text-[var(--text-tertiary)]">
                  Charged only after approval and checkout.
                </p>
              </div>
              <Link
                href="/request-access"
                className="product-cta-halo ui-btn-primary inline-flex min-h-10 shrink-0 items-center gap-1.5 px-4 py-2 text-[13px] font-semibold"
              >
                Request access
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              </Link>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
