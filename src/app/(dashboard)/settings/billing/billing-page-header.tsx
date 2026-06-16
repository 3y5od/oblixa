import { CreditCard } from "lucide-react";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { KeyValueChip } from "@/components/ui/key-value-chip";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatBillingDate, formatBillingDateRange } from "@/lib/billing/format";
import { subscriptionStatusBadge } from "@/lib/billing/status";
import { SETTINGS_BILLING_STRINGS } from "@/lib/settings/spec-strings";
import type { BillingPageData } from "./billing-page-model";
import { BillingActionSlot } from "./billing-action-slot";
import { TrialMicrocopyChipPair } from "./billing-page-primitives";

export function BillingPageHeader({ data }: { data: BillingPageData }) {
  const badge = subscriptionStatusBadge({
    status: data.subscriptionStatus,
    cancelAtPeriodEnd: data.cancelAtPeriodEnd,
    cancelAt: data.cancelAt,
    pauseCollection: data.pauseCollection,
    currentPeriodEnd: data.currentPeriodEndEpoch,
  });
  const StatusIcon = badge.icon;
  const isTrialing = data.subscriptionStatus === "trialing";
  const currentPlanLabel =
    data.subscriptionStatus === "none"
      ? "Access review"
      : data.subscriptionStatus === "active" || data.subscriptionStatus === "trialing"
        ? "Oblixa Pro"
        : "Oblixa Pro (lapsed)";
  return (
    <DashboardPageHeader
      icon={<CreditCard className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
      eyebrow={SETTINGS_BILLING_STRINGS.eyebrow}
      title={SETTINGS_BILLING_STRINGS.title}
      lead={
        data.subscriptionStatus === "none"
          ? SETTINGS_BILLING_STRINGS.leadFreeState
          : SETTINGS_BILLING_STRINGS.leadActiveState
      }
      metaStrip={
        data.subscriptionStatus === "none" ? (
          <>
            <div>
              <dt className="ui-caps-2 text-[var(--text-tertiary)]">{SETTINGS_BILLING_STRINGS.workspaceIdLabel}</dt>
              <dd className="mt-0.5 min-w-0 max-w-[14rem] truncate font-medium text-[var(--text-primary)]" title={data.org.name}>
                {data.org.name}
              </dd>
            </div>
            {data.stripeTrialEndedAt ? (
              <div>
                <dt className="ui-caps-2 text-[var(--text-tertiary)]">{SETTINGS_BILLING_STRINGS.trialEndedLabel}</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-[var(--text-primary)]">
                  {formatBillingDate(Math.floor(new Date(data.stripeTrialEndedAt).getTime() / 1000))}
                </dd>
              </div>
            ) : null}
          </>
        ) : (
          <>
            {data.subscriptionStatus === "active" || data.subscriptionStatus === "trialing" ? (
              <div>
                <dt className="ui-caps-2 text-[var(--text-tertiary)]">Plan</dt>
                <dd className="mt-0.5 font-medium text-[var(--text-primary)]">{currentPlanLabel}</dd>
              </div>
            ) : null}
            <div>
              <dd>
                <StatusBadge status={badge.tone}>
                  <StatusIcon size={12} className="inline-block" aria-hidden />
                  <span className="ml-1.5">{badge.label}</span>
                  {badge.srLabel ? <span className="sr-only"> {badge.srLabel}</span> : null}
                </StatusBadge>
              </dd>
            </div>
            {data.currentPeriodEnd ? (
              <div>
                <dt className="ui-caps-2 text-[var(--text-tertiary)]">{isTrialing ? "Activation ends" : "Renews"}</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-[var(--text-primary)]">{data.currentPeriodEnd}</dd>
                {data.subscriptionStatus === "active" && data.currentPeriodStartEpoch && data.currentPeriodEndEpoch ? (
                  <dd className="ui-caps-3 mt-0.5 text-[var(--text-tertiary)] tabular-nums">
                    {formatBillingDateRange(data.currentPeriodStartEpoch, data.currentPeriodEndEpoch)}
                  </dd>
                ) : null}
                <dd className="ui-caps-3 mt-0.5 text-[var(--text-tertiary)]">Auto-renews 00:00 UTC</dd>
              </div>
            ) : null}
            {data.customerCreatedEpoch ? (
              <div>
                <dt className="ui-caps-2 text-[var(--text-tertiary)]">Since</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-[var(--text-primary)]">
                  {new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(new Date(data.customerCreatedEpoch * 1000))}
                </dd>
              </div>
            ) : null}
            {data.stripeTaxEnabled ? (
              <div>
                <dd>
                  <KeyValueChip label="TAX" value="Auto-calculated" />
                </dd>
              </div>
            ) : null}
          </>
        )
      }
      actions={
        data.subscriptionStatus === "none" && data.isAdmin ? null : (
          <div className="flex flex-col items-stretch gap-1.5">
            <BillingActionSlot data={data} />
            {data.subscriptionStatus === "none" && data.isAdmin ? (
              <div className="flex justify-center">
                <TrialMicrocopyChipPair />
              </div>
            ) : null}
          </div>
        )
      }
    />
  );
}
