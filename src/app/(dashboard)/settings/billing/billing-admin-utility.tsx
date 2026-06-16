import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BillingCopyButton, BillingPrintButton } from "@/components/settings/billing-page-actions";
import { SETTINGS_BILLING_STRINGS } from "@/lib/settings/spec-strings";
import type { BillingPageData } from "./billing-page-model";

export function BillingAdminUtility({ data }: { data: BillingPageData }) {
  if (!data.isAdmin || !data.stripeConfigured) return null;
  return (
    <details className="billing-no-print group/admin border-t border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] pt-3">
      <summary
        id="billing-admin-utility-title"
        className="ui-caps-3 inline-flex w-max cursor-pointer items-center gap-1.5 text-[var(--text-tertiary)] outline-none transition-colors marker:hidden hover:text-[var(--text-secondary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] [&::-webkit-details-marker]:hidden"
      >
        {SETTINGS_BILLING_STRINGS.adminUtilityLabel}
        {data.isTestMode ? (
          <span className="ui-caps-3 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-1.5 py-0.5 text-[var(--text-tertiary)]">
            Test mode
          </span>
        ) : null}
        <ChevronRight className="h-3.5 w-3.5 transition-transform group-open/admin:rotate-90 motion-reduce:transition-none" strokeWidth={1.85} aria-hidden />
      </summary>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <BillingPrintButton />
        <span aria-hidden className="hidden h-3 w-px bg-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] sm:inline-block" />
        <div role="group" aria-label="Identifiers" className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="ui-caps-3 text-[var(--text-tertiary)]">Identifiers</span>
          {data.org.stripeCustomerId ? (
            <BillingCopyButton value={data.org.stripeCustomerId} label={SETTINGS_BILLING_STRINGS.customerIdLabel} />
          ) : null}
          <BillingCopyButton value={data.org.id} label={SETTINGS_BILLING_STRINGS.workspaceIdLabel} prefix={6} suffix={4} />
        </div>
        <Link href="/settings/security?filter=billing" className="ui-btn-ghost inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px]">
          View change history
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
        </Link>
        {data.isTestMode ? (
          <details className="group ml-auto">
            <summary className="ui-link inline-flex cursor-pointer items-center gap-1.5 text-[12.5px] marker:hidden [&::-webkit-details-marker]:hidden">
              Stripe test cards
              <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90 motion-reduce:transition-none" strokeWidth={1.85} aria-hidden />
            </summary>
            <ul className="mt-2 space-y-1 text-[12px] font-mono text-[var(--text-secondary)]">
              {SETTINGS_BILLING_STRINGS.testCardHints.map((c) => (
                <li key={c.card}>
                  <span className="tabular-nums">{c.card}</span>
                  <span className="ml-2 text-[var(--text-tertiary)]">- {c.outcome}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </details>
  );
}
