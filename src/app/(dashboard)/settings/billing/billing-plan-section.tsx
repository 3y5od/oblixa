import { SETTINGS_BILLING_STRINGS } from "@/lib/settings/spec-strings";
import type { BillingPageData } from "./billing-page-model";
import { BillingDl } from "./billing-page-primitives";
import { buildBillingPlanRows } from "./billing-plan-rows";

export function BillingPlanSection({ data }: { data: BillingPageData }) {
  if (data.subscriptionStatus === "none" && data.isAdmin) return null;
  const rows = buildBillingPlanRows(data);
  return (
    <section className="ui-card-raised p-0" aria-labelledby="billing-plan-title">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] px-5 py-5">
        <div>
          <p>
            <span className="ui-caps-1 text-[var(--accent)]">{SETTINGS_BILLING_STRINGS.whatYouGetEyebrow}</span>
          </p>
          <h2 id="billing-plan-title" className="mt-1 text-[1.05rem] font-semibold text-[var(--text-primary)] sm:text-[1.4rem]">
            Plan
          </h2>
        </div>
        {data.priceMoney ? (
          <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-[1.5rem] font-semibold tabular-nums leading-none text-[var(--text-primary)]">
              {data.priceMoney.display}
            </span>
            {data.priceMoney.cadenceLabel ? (
              <span className="text-[12.5px] text-[var(--text-tertiary)]">{data.priceMoney.cadenceLabel}</span>
            ) : null}
          </span>
        ) : null}
      </header>
      <div className="px-5 py-4">
        <BillingDl rows={rows} />
      </div>
      <footer className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_62%,transparent)] px-5 py-3">
        <p className="text-[11.5px] leading-snug text-[var(--text-tertiary)]">{SETTINGS_BILLING_STRINGS.taxNote}</p>
      </footer>
    </section>
  );
}
