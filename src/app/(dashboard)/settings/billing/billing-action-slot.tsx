import { ManageSubscriptionButton, SubscribeButton } from "@/components/settings/billing-actions";
import { RECOVERABLE_SUBSCRIPTION_STATES } from "@/lib/billing/states";
import { SETTINGS_BILLING_STRINGS } from "@/lib/settings/spec-strings";
import type { BillingPageData } from "./billing-page-model";
import { BillingHelpActions } from "./billing-page-primitives";

export function BillingActionSlot({ data }: { data: BillingPageData }) {
  if (!data.isAdmin) return null;
  if (!data.billingCheckoutEnabled) {
    if (
      data.stripeConfigured &&
      data.org.stripeCustomerId &&
      (data.subscriptionStatus === "active" ||
        data.subscriptionStatus === "past_due" ||
        data.subscriptionStatus === "unpaid" ||
        data.subscriptionStatus === "trialing")
    ) {
      return <ManageSubscriptionButton />;
    }
    return <BillingHelpActions />;
  }
  if (data.subscriptionStatus === "canceled") {
    return <SubscribeButton label={SETTINGS_BILLING_STRINGS.reactivateCta} />;
  }
  if (data.subscriptionStatus === "incomplete") {
    return <SubscribeButton label={SETTINGS_BILLING_STRINGS.resumeCheckoutCta} />;
  }
  if (data.subscriptionStatus === "past_due" || data.subscriptionStatus === "unpaid") {
    return <ManageSubscriptionButton />;
  }
  if (data.subscriptionStatus === "incomplete_expired") {
    return <SubscribeButton />;
  }
  if (data.subscriptionStatus === "trialing") {
    return <SubscribeButton label={SETTINGS_BILLING_STRINGS.trialCta} />;
  }
  if (RECOVERABLE_SUBSCRIPTION_STATES.has(data.subscriptionStatus)) {
    return <SubscribeButton label={SETTINGS_BILLING_STRINGS.primaryCta} />;
  }
  return <ManageSubscriptionButton />;
}
