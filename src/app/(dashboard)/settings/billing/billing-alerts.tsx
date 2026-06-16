import Link from "next/link";
import { ChevronRight, FlaskConical } from "lucide-react";
import { ManageSubscriptionButton } from "@/components/settings/billing-actions";
import { UiAlert } from "@/components/ui/ui-alert";
import { formatBillingDate } from "@/lib/billing/format";
import { subscriptionStatusBadge } from "@/lib/billing/status";
import { SETTINGS_BILLING_STRINGS } from "@/lib/settings/spec-strings";
import type { BillingPageData } from "./billing-page-model";
import { TrialChipPair } from "./billing-page-primitives";

function billingTrialDay(data: BillingPageData): number | null {
  if (data.subscriptionStatus !== "trialing" || !data.trialEndEpoch) return null;
  const totalDays = SETTINGS_BILLING_STRINGS.trialCaps.days;
  if (data.stripeTrialStartedAt) {
    const start = new Date(data.stripeTrialStartedAt).getTime();
    const elapsedDays = Math.floor((Date.now() - start) / (24 * 60 * 60 * 1000));
    return Math.max(1, Math.min(totalDays, elapsedDays + 1));
  }
  const end = data.trialEndEpoch * 1000;
  const elapsed = totalDays - Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000));
  return Math.max(1, Math.min(totalDays, elapsed + 1));
}

export function BillingEnvironmentAndStatusAlerts({ data }: { data: BillingPageData }) {
  const trialDay = billingTrialDay(data);
  const trialBanner =
    data.subscriptionStatus === "trialing" && data.trialEndEpoch && data.trialEndLabel ? (
      <UiAlert tone="neutral">
        <span className="font-semibold">{data.trialEndLabel}.</span> Convert to keep editing, importing, and exporting.{" "}
        {trialDay != null ? (
          <span className="ml-2 inline-flex items-baseline gap-1 align-middle">
            <span className="ui-caps-3 text-[var(--text-tertiary)]">DAY</span>
            <span className="tabular-nums font-semibold">{trialDay}</span>
            <span className="ui-caps-3 text-[var(--text-tertiary)]">of {SETTINGS_BILLING_STRINGS.trialCaps.days}</span>
          </span>
        ) : null}{" "}
        <TrialChipPair caps={SETTINGS_BILLING_STRINGS.trialCaps} />
      </UiAlert>
    ) : null;
  const card = data.paymentMethod?.kind === "card" ? data.paymentMethod : null;
  const cardExpirationBanner = cardExpiresSoon(data) && card ? (
    <UiAlert tone="warning">
      Card ending {card.last4} expires {String(card.expMonth).padStart(2, "0")}/{card.expYear}. Update your card before the next
      renewal{data.currentPeriodEnd ? ` on ${data.currentPeriodEnd}` : ""}.{" "}
      <Link href="/api/stripe/portal" className="ui-link inline-flex items-center gap-0.5">
        Update payment method
        <ChevronRight className="h-3 w-3" strokeWidth={1.85} aria-hidden />
      </Link>
    </UiAlert>
  ) : null;
  return (
    <>
      {data.isTestMode ? (
        <span className="inline-flex max-w-max items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_60%,var(--surface-raised))] px-2.5 py-1 text-[11.5px] text-[var(--text-secondary)]">
          <FlaskConical className="h-3 w-3" strokeWidth={1.85} aria-hidden />
          {SETTINGS_BILLING_STRINGS.testModeBannerShort}
        </span>
      ) : null}
      {!data.stripeConfigured ? (
        <UiAlert tone="warning">
          {SETTINGS_BILLING_STRINGS.unavailableTitle} {SETTINGS_BILLING_STRINGS.unavailableCopy}
        </UiAlert>
      ) : null}
      {data.stripeConfigured && !data.billingCheckoutEnabled && !(data.subscriptionStatus === "none" && data.isAdmin) ? (
        <UiAlert tone="neutral">
          Public billing checkout is available only after access approval. Continued use is handled after price disclosure and explicit checkout.
        </UiAlert>
      ) : null}
      {data.subscriptionLoadFailed ? (
        <UiAlert tone="warning">
          We couldn&apos;t load your subscription from Stripe. <Link href="/settings/billing" className="ui-link">Retry</Link>.
        </UiAlert>
      ) : null}
      {data.priceLoadFailed ? (
        <UiAlert tone="warning">
          {data.priceUnavailableReason === "deleted" ? "Plan is no longer available - contact support." : "We couldn't load plan pricing. Refresh to try again."}
        </UiAlert>
      ) : null}
      {!data.isAdmin && data.subscriptionStatus === "none" ? (
        <UiAlert tone="neutral">
          Only workspace admins can subscribe. Ask an admin to manage billing - <Link href="/settings/team" className="ui-link">Settings - Team</Link>.
        </UiAlert>
      ) : null}
      {data.priceDriftMessage ? (
        <UiAlert tone="warning">
          <span className="font-semibold">Stripe price drift:</span> {data.priceDriftMessage}. Update the Stripe Dashboard to match the release-state spec.
        </UiAlert>
      ) : null}
      {data.multipleActiveSubs && data.isAdmin ? (
        <UiAlert tone="warning">
          <span className="font-semibold">Multiple active subscriptions detected.</span> Contact{" "}
          <Link href="mailto:support@oblixa.com" className="ui-link">support@oblixa.com</Link> to reconcile the workspace billing record.
        </UiAlert>
      ) : null}
      {trialBanner}
      {data.subscriptionStatus === "none" && data.stripeTrialEndedAt ? (
        <UiAlert tone="warning">Activation ended on {formatBillingDate(new Date(data.stripeTrialEndedAt))}. Contact support to review continued access.</UiAlert>
      ) : null}
      {data.cancelAt && data.currentPeriodEndEpoch && data.cancelAt > data.currentPeriodEndEpoch ? (
        <UiAlert tone="warning">Scheduled to cancel on {formatBillingDate(data.cancelAt)}. Reactivate any time before then via the customer portal.</UiAlert>
      ) : null}
      {data.cancelAtPeriodEnd && data.currentPeriodEnd ? (
        <UiAlert tone="warning">
          Access ends {data.currentPeriodEnd}. {SETTINGS_BILLING_STRINGS.cancellationConfirmation.replace("{date}", data.currentPeriodEnd)}{" "}
          <Link href="/settings/imports-exports" className="ui-link inline-flex items-center gap-0.5">
            Export your contract inventory
            <ChevronRight className="h-3 w-3" strokeWidth={1.85} aria-hidden />
          </Link>
        </UiAlert>
      ) : null}
      {data.pauseCollection ? (
        <UiAlert tone="neutral">
          Billing paused. {data.pauseCollection.resumes_at ? `Collection resumes ${formatBillingDate(data.pauseCollection.resumes_at)}.` : "Resume from the customer portal."}
        </UiAlert>
      ) : null}
      {data.discountLabel ? <UiAlert tone="success">{data.discountLabel}</UiAlert> : null}
      {data.nextActionUrl ? (
        <UiAlert tone="warning">
          Action required - your last payment needs additional authentication.{" "}
          <Link href={data.nextActionUrl} className="ui-link inline-flex items-center gap-0.5">
            Complete authentication
            <ChevronRight className="h-3 w-3" strokeWidth={1.85} aria-hidden />
          </Link>
        </UiAlert>
      ) : null}
      {cardExpirationBanner}
      {data.customerDeleted ? (
        <UiAlert tone="warning">
          Your Stripe billing record could not be found. Contact <Link href="mailto:support@oblixa.com" className="ui-link font-mono">support@oblixa.com</Link> to reconnect billing.
        </UiAlert>
      ) : null}
      {data.subscriptionStatus === "unpaid" ? <UiAlert tone="warning">Payment retries exhausted. Update your payment method to restore access.</UiAlert> : null}
      {data.subscriptionStatus === "incomplete_expired" ? <UiAlert tone="warning">Initial payment failed and the recovery window has elapsed. Contact support to restart billing.</UiAlert> : null}
      {data.showSuccessAlert ? <UiAlert tone="success">Billing checkout completed.</UiAlert> : null}
      {data.showCanceledAlert ? (
        <UiAlert tone="warning">
          {data.searchParams.error_message ? `Checkout was canceled: ${data.searchParams.error_message}` : "Checkout was canceled. No charges were made."}
          {data.searchParams.error_code ? <span className="ui-caps-3 ml-2 font-mono text-[var(--text-tertiary)]">CODE {data.searchParams.error_code}</span> : null}
        </UiAlert>
      ) : null}
      <noscript>
        <UiAlert tone="warning">{SETTINGS_BILLING_STRINGS.noscriptCopy}</UiAlert>
      </noscript>
    </>
  );
}

function cardExpiresSoon(data: BillingPageData) {
  if (data.paymentMethod?.kind !== "card") return false;
  const expDate = new Date(data.paymentMethod.expYear, data.paymentMethod.expMonth - 1, 1);
  const sixtyDaysFromNow = new Date();
  sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);
  return expDate <= sixtyDaysFromNow;
}

export function BillingActiveRiskHero({ data }: { data: BillingPageData }) {
  const isActiveRisk = data.subscriptionStatus === "past_due" || data.subscriptionStatus === "unpaid";
  if (!isActiveRisk || !data.isAdmin || !data.stripeConfigured) return null;
  const badge = subscriptionStatusBadge({
    status: data.subscriptionStatus,
    cancelAtPeriodEnd: data.cancelAtPeriodEnd,
    cancelAt: data.cancelAt,
    pauseCollection: data.pauseCollection,
    currentPeriodEnd: data.currentPeriodEndEpoch,
  });
  const StatusIcon = badge.icon;
  return (
    <section className="ui-card-raised relative overflow-hidden rounded-2xl border border-[color:color-mix(in_oklab,var(--warning)_28%,var(--border-subtle))] p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--warning)_28%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_38%,var(--surface-raised))] text-[var(--warning-ink)]">
          <StatusIcon size={20} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p><span className="ui-caps-1 text-[var(--warning-ink)]">Action required</span></p>
          <h2 className="mt-1 text-[1.75rem] font-semibold leading-[1.1] text-[var(--text-primary)]">Payment failed - restore access</h2>
          {data.lastPaymentErrorMessage ? (
            <>
              <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[var(--text-secondary)]">{data.lastPaymentErrorMessage}</p>
              {data.lastPaymentRemediation ? (
                <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                  <span className="ui-caps-3 text-[var(--text-tertiary)]">What to try:</span> {data.lastPaymentRemediation}
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
              Your most recent payment didn&apos;t go through. Update your payment method to continue editing, importing, and exporting contracts.
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-x-1 gap-y-2">
            <ManageSubscriptionButton />
            <Link href={SETTINGS_BILLING_STRINGS.contactSalesHref} className="ui-btn-ghost inline-flex items-center gap-1 rounded-full px-4 py-2 text-[13px]">
              Contact support
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
