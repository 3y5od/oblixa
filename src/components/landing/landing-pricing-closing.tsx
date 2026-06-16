import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import {
  ctaPrimaryLabel,
  ctaSecondaryLabel,
  pricingCtaLead,
  pricingCtaMessage,
  riskReducerLine,
} from "@/components/landing/landing-content";
import {
  previewSupportTier,
  sectionCompact,
} from "@/components/landing/landing-layout-classes";
import { AccessReviewPreview } from "@/components/landing/landing-preview-scenes";
import { SectionEyebrow } from "./landing-section-helpers";

export function PricingCtaSection() {
  const planTerms: ReadonlyArray<{ kicker: string; value: string; lock?: boolean }> = [
    { kicker: "Checkout", value: "Only after access approval - never self-serve", lock: true },
  ];
  return (
    <section className={`relative scroll-mt-24 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] ${sectionCompact}`} aria-labelledby="pricing-cta-heading">
      <div className="lp-container relative">
        <div className="max-w-2xl">
          <SectionEyebrow index="07">Pricing</SectionEyebrow>
          <h2 id="pricing-cta-heading" className="lp-serif mt-5 text-balance text-[1.95rem] leading-[1.1] text-[var(--text-primary)] sm:text-[2.4rem]">
            {pricingCtaMessage}
          </h2>
          <p className="mt-4 max-w-xl text-pretty text-[14.5px] leading-[1.65] text-[var(--text-secondary)] sm:text-[15.5px]">
            {pricingCtaLead}
          </p>
        </div>
        <div className="mt-6">
          <div aria-hidden className="lp-frame-rule" />
          <div className="grid gap-x-12 gap-y-6 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] py-6 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end sm:gap-x-16">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.11em] text-[var(--text-tertiary)]">Price</p>
              <p className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="lp-serif text-[3.5rem] leading-none tracking-[-0.015em] text-[var(--text-primary)] sm:text-[4rem]">$249</span>
                <span className="text-[17px] font-semibold text-[var(--text-primary)]">per workspace, monthly</span>
              </p>
            </div>
            <dl className="contents">
              <PricingMetric label="Included" value="Up to 500 active contracts" />
              <PricingMetric label="Seats" value="10 workspace users" />
            </dl>
          </div>
          <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)]">
            {planTerms.map((row) => (
              <li key={row.kicker} className="grid grid-cols-[7rem_minmax(0,1fr)] items-baseline border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] py-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.11em] text-[var(--text-tertiary)]">{row.kicker}</span>
                <span className={`leading-[1.5] ${row.lock ? "text-[15.5px] font-semibold text-[var(--text-primary)]" : "text-[14.5px] text-[var(--text-secondary)]"}`}>
                  {row.lock ? <Lock className="-mt-0.5 mr-1.5 inline h-3.5 w-3.5 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden /> : null}
                  {row.value}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-[var(--border-strong)] py-2.5">
            <p className="text-[13px] text-[var(--text-secondary)]">
              Month-to-month <span className="ui-dot-sep" aria-hidden>-</span> No annual lock-in <span className="ui-dot-sep" aria-hidden>-</span> Bounded first contract set <span className="ui-dot-sep" aria-hidden>-</span> CSV export anytime
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <PricingLink href="/request-access" primary label={ctaPrimaryLabel} />
              <PricingLink href="/product" label={ctaSecondaryLabel} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PricingMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="sm:pb-1.5">
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.11em] text-[var(--text-tertiary)]">{label}</dt>
      <dd className="mt-1.5 text-[16.5px] font-semibold tabular-nums text-[var(--text-primary)]">{value}</dd>
    </div>
  );
}

function PricingLink({ href, label, primary }: { href: string; label: string; primary?: boolean }) {
  return (
    <Link href={href} prefetch={href === "/product" ? false : undefined} className={`${primary ? "ui-btn-primary gap-1.5" : "ui-btn-secondary"} inline-flex items-center justify-center whitespace-nowrap`}>
      {label}
      {primary ? <ArrowRight className="h-4 w-4" strokeWidth={1.85} aria-hidden /> : null}
    </Link>
  );
}

export function ClosingSection() {
  return (
    <section className={`lp-band-mist relative isolate overflow-hidden ${sectionCompact}`} aria-labelledby="cta-final-heading">
      <div className="lp-container relative grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16">
        <div>
          <SectionEyebrow index="08">Request access</SectionEyebrow>
          <h2 id="cta-final-heading" className="lp-serif mt-5 text-balance text-[2.1rem] leading-[1.08] text-[var(--text-primary)] sm:text-[2.6rem]">
            Start with a small contract set. Prove the follow-up.
          </h2>
          <p className="mt-4 max-w-xl text-pretty text-[15.5px] leading-[1.65] text-[var(--text-secondary)]">
            Request access if your team is replacing a manual contract tracker and can start with a bounded first set.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <PricingLink href="/request-access" primary label={ctaPrimaryLabel} />
            <PricingLink href="/product" label={ctaSecondaryLabel} />
          </div>
          <p className="mt-4 text-[13px] leading-[1.6] text-[var(--text-tertiary)]">{riskReducerLine}</p>
          <p className="mt-2.5 text-[12.5px]">
            <Link href="/security" className="inline-flex items-center gap-1 text-[var(--text-secondary)] underline decoration-[var(--border-contrast)] underline-offset-[3px] transition-colors hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] motion-reduce:transition-none">
              <Lock className="h-3 w-3" strokeWidth={1.85} aria-hidden />
              Security overview
            </Link>
          </p>
        </div>
        <div className={previewSupportTier}>
          <AccessReviewPreview />
        </div>
      </div>
    </section>
  );
}
