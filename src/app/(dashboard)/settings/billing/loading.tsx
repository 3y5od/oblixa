import { CreditCard } from "lucide-react";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { SETTINGS_BILLING_STRINGS } from "@/lib/settings/spec-strings";

// SPEC: docs/billing-page-maximal-pass.md §15.7 + refinement §1.13
// Updated to match the post-refinement page shape: WHAT YOU GET eyebrow
// over Plan h2, hero-price chip top-right, grouped dl, hairline-separated
// FAQ rows with medallions, footer ChipCapsule.
export default function BillingLoading() {
  return (
    <div className="ui-page-stack mx-auto max-w-4xl gap-4" aria-busy="true">
      <span
        aria-hidden
        className="ui-skeleton h-7 w-32 rounded-full"
      />
      <DashboardPageHeader
        icon={
          <CreditCard
            className="h-[1.125rem] w-[1.125rem]"
            strokeWidth={1.85}
          />
        }
        eyebrow={SETTINGS_BILLING_STRINGS.eyebrow}
        title={SETTINGS_BILLING_STRINGS.title}
        lead={SETTINGS_BILLING_STRINGS.lead}
        metaStrip={
          <>
            <span aria-hidden className="ui-skeleton h-4 w-20 rounded" />
            <span aria-hidden className="ui-skeleton h-4 w-24 rounded" />
          </>
        }
        actions={
          <span
            aria-hidden
            className="ui-skeleton h-9 w-40 rounded-full"
          />
        }
      />

      <section className="ui-card ui-loading-panel p-0">
        <div className="flex items-center justify-between gap-3 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] px-5 py-5">
          <div>
            <span aria-hidden className="ui-skeleton block h-3 w-24 rounded" />
            <span
              aria-hidden
              className="ui-skeleton mt-2 block h-6 w-16 rounded"
            />
          </div>
          <span aria-hidden className="ui-skeleton h-7 w-24 rounded" />
        </div>
        <div className="space-y-3 px-5 py-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="grid gap-2 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_42%,transparent)] py-3 last:border-b-0 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4"
            >
              <span aria-hidden className="ui-skeleton h-3 w-24 rounded" />
              <span aria-hidden className="ui-skeleton h-4 w-40 rounded" />
            </div>
          ))}
        </div>
        <div className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_50%,transparent)] px-5 py-3">
          <span aria-hidden className="ui-skeleton h-3 w-2/3 rounded" />
        </div>
      </section>

      <section className="ui-card ui-loading-panel p-0">
        <div className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] px-5 py-5">
          <span aria-hidden className="ui-skeleton h-3 w-10 rounded" />
          <span aria-hidden className="mt-2 block ui-skeleton h-5 w-48 rounded" />
        </div>
        <div className="px-5 py-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex min-h-[44px] items-center gap-3 border-y border-[color:color-mix(in_oklab,var(--border-subtle)_50%,transparent)] py-3"
            >
              <span aria-hidden className="ui-skeleton h-7 w-7 rounded-lg" />
              <span aria-hidden className="ui-skeleton h-4 flex-1 rounded" />
              <span aria-hidden className="ui-skeleton h-4 w-4 rounded" />
            </div>
          ))}
        </div>
        <div className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_50%,transparent)] px-5 py-4">
          <span aria-hidden className="ui-skeleton h-7 w-48 rounded-full" />
        </div>
      </section>
    </div>
  );
}
