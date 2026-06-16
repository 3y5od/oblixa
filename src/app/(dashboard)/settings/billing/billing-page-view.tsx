import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SETTINGS_BILLING_STRINGS } from "@/lib/settings/spec-strings";
import type { BillingPageData } from "./billing-page-model";
import { BillingActiveRiskHero, BillingEnvironmentAndStatusAlerts } from "./billing-alerts";
import { BillingAdminUtility } from "./billing-admin-utility";
import { BillingEmptyStateCard } from "./billing-empty-state-card";
import { BillingPageHeader } from "./billing-page-header";
import { BillingPlanSection } from "./billing-plan-section";
import { BillingActivitySection, BillingInvoicesAndFaqGrid } from "./billing-related-sections";

export function BillingPageView({ data }: { data: BillingPageData }) {
  return (
    <div className="ui-page-stack mx-auto max-w-5xl gap-4">
      <a
        href="#billing-plan-title"
        className="ui-skip-link sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-md focus:bg-[var(--surface-raised)] focus:px-3 focus:py-2 focus:text-[var(--text-primary)] focus:outline-2 focus:outline-[var(--focus-ring)]"
      >
        Skip to billing content
      </a>
      <Link href="/settings" className="ui-btn-ghost inline-flex max-w-max items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px]">
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        {SETTINGS_BILLING_STRINGS.backLabel}
      </Link>
      <div className="flex flex-col gap-4">
        <BillingPageHeader data={data} />
        <BillingEnvironmentAndStatusAlerts data={data} />
      </div>
      <BillingActiveRiskHero data={data} />
      <BillingEmptyStateCard data={data} />
      <BillingPlanSection data={data} />
      <BillingInvoicesAndFaqGrid data={data} />
      <BillingActivitySection data={data} />
      <BillingAdminUtility data={data} />
    </div>
  );
}
