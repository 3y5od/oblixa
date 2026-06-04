import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ChevronDown, FileSpreadsheet, MinusCircle, TimerReset } from "lucide-react";
import { LegalPageJsonLd } from "@/components/landing/legal-page-json-ld";
import { GradientPhrase } from "@/components/ui/gradient-phrase";

const title = "Access and Pricing — Oblixa";
const description =
  "Oblixa is paid after access approval and price disclosure, with one Core offer for signed-contract tracking.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/pricing" },
  openGraph: { title, description, url: "/pricing", type: "article" },
  twitter: { card: "summary_large_image", title, description },
};

const included = [
  "Contract upload and CSV tracker import for a bounded workspace start",
  "Source-backed suggestions reviewed by your team",
  "Renewal, notice, owner, obligation, evidence, and report workflows",
  "Exportable contract records and operational reports",
  "Product support during workspace activation",
] as const;

const notIncluded = [
  "Open self-serve signup",
  "Required annual commitments",
  "Plan tiers or add-on packages",
  "Custom migration, cleanup, or legal review by Oblixa",
  "Guaranteed response times or procurement readiness",
] as const;

const faq = [
  {
    question: "What does Oblixa cost?",
    answer:
      "Pricing is disclosed during access review or immediately after approval before you are charged. The release has one Core paid offer.",
  },
  {
    question: "What happens after access is approved?",
    answer:
      "You can activate a workspace and choose whether to continue as a paid month-to-month customer after price disclosure.",
  },
  {
    question: "Do we need to migrate every contract?",
    answer:
      "No. The recommended start is a small subset or a redacted sample set so the workflow can be validated before any larger migration.",
  },
  {
    question: "Does Oblixa replace contract drafting or e-signature tools?",
    answer:
      "No. Oblixa starts after contracts are signed and focuses on tracking dates, owners, obligations, evidence, and reports.",
  },
  {
    question: "Can we cancel or export our data?",
    answer:
      "Yes. You can export contract records and operational reports at any time. Paid continuation is month-to-month by default with no annual commitment.",
  },
  {
    question: "When would paid use start?",
    answer:
      "Only after approval and explicit checkout. There is no automatic charge on access request, account creation, upload, import, or workspace activation.",
  },
] as const;

const posture = [
  "Price disclosed before charge",
  "Month-to-month when paid",
  "No annual commitment",
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
        <div aria-hidden className="landing-luminous__glow opacity-60" />
        <div aria-hidden className="product-top-hairline" />

        <div className="relative mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          <header className="mx-auto max-w-3xl text-center">
            <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--accent-strong)]">
              <span className="landing-eyebrow-dot" aria-hidden />
              Access and pricing
            </p>
            <h1
              className="mx-auto mt-3 max-w-[20ch] text-balance text-[2.25rem] font-bold leading-[1.05] tracking-tight text-[var(--text-primary)] sm:text-[3.25rem]"
              style={{ letterSpacing: "-0.02em" }}
            >
              Simple pricing for contract <GradientPhrase>tracking</GradientPhrase>.
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-balance text-[15px] leading-[1.6] text-[var(--text-secondary)] sm:text-[16px]">
              Request access first. Approved workspaces can continue on a simple monthly
              Core plan after price disclosure and explicit checkout.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/request-access"
                className="product-cta-halo ui-btn-primary inline-flex min-h-10 items-center gap-1.5 px-4 py-2 text-[13px] font-semibold"
              >
                Request access
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              </Link>
              <Link
                href="/product"
                prefetch={false}
                className="ui-btn-ghost inline-flex min-h-10 items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold"
              >
                View product tour
              </Link>
            </div>
            <div className="mt-6 flex justify-center">
              <div className="inline-flex flex-col divide-y sm:flex-row sm:divide-x sm:divide-y-0 divide-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] overflow-hidden rounded-lg border border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_70%,transparent)] text-[12px] text-[var(--text-secondary)]">
                {posture.map((item) => (
                  <span key={item} className="px-3.5 py-1.5 text-center">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </header>

          <section className="mt-8 grid items-start gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <article className="landing-card-premium landing-card-static relative overflow-hidden rounded-3xl border p-5 sm:p-6">
              <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--accent-strong)]">
                <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                Access first
              </p>
              <h2 className="mt-3 text-[1.5rem] font-semibold leading-tight tracking-tight text-[var(--text-primary)]">
                Start with a small contract set.
              </h2>
              <p className="mt-3 text-[14px] leading-[1.65] text-[var(--text-secondary)]">
                Use a small set of signed contracts to see whether reviewed fields, owners,
                dates, work, evidence, and reports improve your current tracker.
              </p>
              <ul className="mt-5 grid gap-1.5">
                {included.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[13.5px] leading-[1.55] text-[var(--text-secondary)]">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success-ink)]" strokeWidth={2} aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-3xl border border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_55%,transparent)] p-5 sm:p-6">
              <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
                <TimerReset className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                Not public self-serve
              </p>
              <h2 className="mt-3 text-[1.5rem] font-semibold leading-tight tracking-tight text-[var(--text-primary)]">
                What access and pricing do not include.
              </h2>
              <ul className="mt-5 grid gap-1.5">
                {notIncluded.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[13.5px] leading-[1.55] text-[var(--text-secondary)]">
                    <MinusCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-tertiary)]" strokeWidth={2} aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          </section>

          <section className="mt-8" aria-labelledby="pricing-faq-heading">
            <header className="mx-auto max-w-2xl text-center">
              <h2
                id="pricing-faq-heading"
                className="text-[1.75rem] font-semibold tracking-tight text-[var(--text-primary)] sm:text-[2rem]"
              >
                Pricing questions
              </h2>
              <p className="mt-3 text-[14px] leading-[1.6] text-[var(--text-secondary)]">
                Plain answers for reviewed workspace access and paid continuation.
              </p>
            </header>
            <div className="landing-faq-list mx-auto mt-8 overflow-hidden rounded-2xl border border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_55%,transparent)] lg:grid lg:grid-cols-2 lg:divide-x lg:divide-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)]">
              {faq.map((item, idx) => (
                <details
                  key={item.question}
                  className={`landing-faq-row group ${
                    idx < faq.length - 1
                      ? "border-b border-[color:color-mix(in_oklab,var(--border-subtle)_92%,transparent)]"
                      : ""
                  } lg:[&:nth-last-child(-n+2)]:border-b-0`}
                >
                  <summary className="flex cursor-pointer list-none items-center gap-4 rounded-lg px-5 py-5 outline-none transition-colors marker:hidden hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,transparent)] focus-visible:bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,transparent)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--focus-ring)] sm:px-6 [&::-webkit-details-marker]:hidden">
                    <h3 className="flex-1 pr-3 text-[14px] font-semibold leading-snug tracking-tight text-[var(--text-primary)]">
                      {item.question}
                    </h3>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[color:var(--surface-tint)] text-[var(--text-tertiary)] transition-all group-hover:border-[color:color-mix(in_oklab,var(--accent)_30%,var(--border-subtle))] group-hover:text-[var(--accent-strong)] group-open:rotate-180 group-open:border-[color:color-mix(in_oklab,var(--accent)_42%,var(--border-subtle))] group-open:bg-[color:color-mix(in_oklab,var(--accent-soft)_38%,var(--surface-raised))] group-open:text-[var(--accent-strong)]">
                      <ChevronDown className="h-4 w-4" strokeWidth={1.85} aria-hidden />
                    </span>
                  </summary>
                  <div className="px-5 pb-6 pt-1 text-[14px] leading-[1.7] text-[var(--text-secondary)] sm:px-6 sm:pb-7">
                    {item.answer}
                  </div>
                </details>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
