import Link from "next/link";
import { ChevronRight, CircleDollarSign } from "lucide-react";
import { SubscribeButton } from "@/components/settings/billing-actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { SETTINGS_BILLING_STRINGS } from "@/lib/settings/spec-strings";
import type { BillingPageData } from "./billing-page-model";
import { IncludedCheck, TrialMicrocopyChipPair } from "./billing-page-primitives";

export function BillingEmptyStateCard({ data }: { data: BillingPageData }) {
  if (data.subscriptionStatus !== "none" || !data.isAdmin) return null;
  return (
    <section
      className="ui-card-raised rounded-2xl border border-[color:color-mix(in_oklab,var(--accent)_20%,var(--border-strong))] p-6 sm:p-8"
      aria-labelledby="billing-empty-title"
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_36%,var(--surface-raised))] text-[var(--accent-strong)] shadow-[var(--shadow-1)]"
        >
          <CircleDollarSign className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 id="billing-empty-title" className="text-xl font-semibold text-[var(--text-primary)] sm:text-[1.4rem]">
              Access review billing
            </h2>
            <StatusBadge status="info">REVIEWED ACCESS</StatusBadge>
          </div>
          <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
            {SETTINGS_BILLING_STRINGS.emptyStateBody}
          </p>
          <p className="mt-4 ui-caps-3 text-[var(--text-tertiary)]">{SETTINGS_BILLING_STRINGS.planIncludesEyebrow}</p>
          <ul className="mt-2 grid max-w-2xl grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {[
              "Contract upload and import for a bounded first set",
              "Source-backed suggestions reviewed by your team",
              "CSV export",
              "Audit history",
              "Product support during activation",
            ].map((feature) => (
              <li key={feature} className="inline-flex items-center gap-2">
                <IncludedCheck />
                <span className="text-[12.5px] text-[var(--text-secondary)]">{feature}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {data.billingCheckoutEnabled ? (
              <SubscribeButton label={SETTINGS_BILLING_STRINGS.primaryCta} />
            ) : (
              <Link
                href={SETTINGS_BILLING_STRINGS.contactSalesHref}
                className="ui-btn-secondary inline-flex items-center gap-1 rounded-full px-4 py-2 text-[13px]"
              >
                {SETTINGS_BILLING_STRINGS.contactSalesCta}
              </Link>
            )}
            <Link
              href={SETTINGS_BILLING_STRINGS.publicPricingHref}
              className="ui-btn-ghost inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px]"
            >
              View access details
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
            </Link>
          </div>
          <div className="mt-4 flex flex-col items-start gap-2 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] pt-3">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-[1.5rem] font-semibold leading-none tabular-nums text-[var(--text-primary)]">
                {SETTINGS_BILLING_STRINGS.corePrice.display}
              </span>
              <span className="text-[12.5px] text-[var(--text-tertiary)]">{SETTINGS_BILLING_STRINGS.corePrice.cadence}</span>
            </div>
            <span className="text-[12px] text-[var(--text-secondary)]">{SETTINGS_BILLING_STRINGS.corePrice.note}</span>
            <TrialMicrocopyChipPair />
          </div>
        </div>
      </div>
    </section>
  );
}
