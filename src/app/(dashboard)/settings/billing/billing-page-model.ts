import { declineRemediation } from "@/lib/billing/decline-codes";
import { formatBillingDate } from "@/lib/billing/format";
import { formatTrialEnd } from "@/lib/billing/status";
import { listCustomerSubscriptions, retrieveConfiguredPrice } from "@/lib/billing/runtime";
import { checkStripePriceDrift, maybeWarnPriceDrift } from "@/lib/billing/stripe-price-drift";
import { reconcileSubscriptionState } from "@/lib/billing/reconcile";
import { getStripeClient, resolveSubscriptionStatus } from "@/lib/stripe";
import { canManageWorkspaceBilling } from "@/lib/roles";
import { isPublicBillingCheckoutEnabled, isStripeTaxEnabled } from "@/lib/env/server";
import type { getAuthContext } from "@/lib/supabase/server";

type AuthContext = NonNullable<Awaited<ReturnType<typeof getAuthContext>>>;
type SubscriptionStatus = ReturnType<typeof resolveSubscriptionStatus>;

export type BillingSearchParams = {
  success?: string;
  canceled?: string;
  session_id?: string;
  error_code?: string;
  error_message?: string;
};

export type Money = { display: string; cadenceLabel: string | null };

export type CustomerAddress = {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
};

export type BillingPaymentMethod =
  | {
      kind: "card";
      brand: string;
      last4: string;
      expMonth: number;
      expYear: number;
    }
  | {
      kind: "bank";
      bankName: string | null;
      last4: string;
      accountType: string | null;
    };

export type BillingAccessState =
  | { kind: "membership_query_failed" }
  | { kind: "access_revoked" }
  | { kind: "ready"; data: BillingPageData };

export type BillingPageData = {
  searchParams: BillingSearchParams;
  org: {
    id: string;
    name: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    stripeSubscriptionStatus: string | null;
  };
  isAdmin: boolean;
  stripeConfigured: boolean;
  billingCheckoutEnabled: boolean;
  isTestMode: boolean;
  stripeTaxEnabled: boolean;
  subscriptionStatus: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  cancelAt: number | null;
  pauseCollection: { resumes_at?: number | null } | null;
  currentPeriodEndEpoch: number | null;
  currentPeriodEnd: string | null;
  currentPeriodStartEpoch: number | null;
  trialEndEpoch: number | null;
  stripeTrialStartedAt: string | null;
  stripeTrialEndedAt: string | null;
  priceMoney: Money | null;
  subscriptionLoadFailed: boolean;
  priceLoadFailed: boolean;
  priceUnavailableReason: string | null;
  priceDriftMessage: string | null;
  multipleActiveSubs: boolean;
  customerCreatedEpoch: number | null;
  customerEmail: string | null;
  customerAddress: CustomerAddress | null;
  customerTaxIdValue: string | null;
  customerTaxIdStatus: string | null;
  customerTaxExempt: "none" | "exempt" | "reverse" | null;
  customerBalanceMinor: number | null;
  customerBalanceCurrency: string | null;
  paymentMethod: BillingPaymentMethod | null;
  customerDeleted: boolean;
  customerInvoiceCustomFields: Array<{ name: string; value: string }>;
  upcomingInvoice: { amountMinor: number; currency: string; nextPaymentAttempt: number | null } | null;
  discountLabel: string | null;
  lastPaymentErrorMessage: string | null;
  lastPaymentDeclineCode: string | null;
  lastPaymentRemediation: string | null;
  nextActionUrl: string | null;
  showSuccessAlert: boolean;
  showCanceledAlert: boolean;
  trialEndLabel: string | null;
};

const CURRENCY_DECIMALS: Record<string, number> = {
  jpy: 0,
  krw: 0,
  huf: 0,
  vnd: 0,
  twd: 0,
  bhd: 3,
  jod: 3,
  kwd: 3,
  omr: 3,
  tnd: 3,
};

function decimalsFor(currency: string): number {
  return CURRENCY_DECIMALS[currency.toLowerCase()] ?? 2;
}

export function formatStripePrice(
  amountMinor: number | null | undefined,
  currency: string | null | undefined,
  interval: string | null,
  intervalCount: number | null,
  locale?: string
): Money | null {
  if (amountMinor == null || !currency) return null;
  try {
    const decimals = decimalsFor(currency);
    const divisor = Math.pow(10, decimals);
    const formatter = new Intl.NumberFormat(locale ?? undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: decimals,
      minimumFractionDigits: amountMinor % divisor === 0 ? 0 : decimals,
    });
    const display = formatter.format(amountMinor / divisor);
    let cadenceLabel: string | null = null;
    if (interval) {
      const count = intervalCount && intervalCount > 1 ? intervalCount : 1;
      const unit = count === 1 ? interval : `${count} ${interval}s`;
      cadenceLabel = `per ${unit}`;
    }
    return { display, cadenceLabel };
  } catch {
    return null;
  }
}

export async function loadBillingPageData(
  ctx: AuthContext,
  searchParams: BillingSearchParams
): Promise<BillingAccessState> {
  const { user, orgId, admin } = ctx;
  const membershipResult = await admin
    .from("organization_members")
    .select(
      "role, organizations(id, name, owner_user_id, stripe_customer_id, stripe_subscription_id, stripe_subscription_status, stripe_trial_started_at)"
    )
    .eq("user_id", user.id)
    .eq("organization_id", orgId)
    .limit(1)
    .single();
  const membership = membershipResult.data;

  if (membershipResult.error && !membership) {
    console.error("[settings/billing] membership query:", membershipResult.error);
    return { kind: "membership_query_failed" };
  }
  if (!membership) return { kind: "access_revoked" };

  const org = membership.organizations as unknown as {
    id: string;
    name: string;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    stripe_subscription_status: string | null;
    stripe_trial_started_at?: string | null;
    owner_user_id?: string | null;
  };

  let stripeTrialEndedAt: string | null = null;
  try {
    const trialEndResult = await admin
      .from("organizations")
      .select("stripe_trial_ended_at")
      .eq("id", org.id)
      .limit(1)
      .maybeSingle();
    const row = trialEndResult.data as { stripe_trial_ended_at?: string | null } | null;
    stripeTrialEndedAt = row?.stripe_trial_ended_at ?? null;
  } catch {
    stripeTrialEndedAt = null;
  }

  const isAdmin = canManageWorkspaceBilling(membership.role, { isWorkspaceOwner: org.owner_user_id === user.id });
  let subscriptionStatus = resolveSubscriptionStatus(null);
  let cancelAtPeriodEnd = false;
  let cancelAt: number | null = null;
  let pauseCollection: { resumes_at?: number | null } | null = null;
  let discountLabel: string | null = null;
  let currentPeriodEndEpoch: number | null = null;
  let currentPeriodEnd: string | null = null;
  let currentPeriodStartEpoch: number | null = null;
  let trialEndEpoch: number | null = null;
  let priceMoney: Money | null = null;
  let subscriptionLoadFailed = false;
  let priceLoadFailed = false;
  let priceUnavailableReason: string | null = null;
  let customerEmail: string | null = null;
  let customerAddress: CustomerAddress | null = null;
  let customerTaxIdValue: string | null = null;
  let customerTaxExempt: "none" | "exempt" | "reverse" | null = null;
  let customerBalanceMinor: number | null = null;
  let customerBalanceCurrency: string | null = null;
  let paymentMethod: BillingPaymentMethod | null = null;
  let customerDeleted = false;
  let lastPaymentErrorMessage: string | null = null;
  let lastPaymentDeclineCode: string | null = null;
  let nextActionUrl: string | null = null;
  let customerTaxIdStatus: string | null = null;

  const stripeClient = await getStripeClient();
  const stripeConfigured = stripeClient.ok;
  const billingCheckoutEnabled = stripeConfigured && isPublicBillingCheckoutEnabled();
  const isTestMode =
    stripeClient.ok &&
    typeof process.env.STRIPE_SECRET_KEY === "string" &&
    process.env.STRIPE_SECRET_KEY.startsWith("sk_test_");

  if (org.stripe_subscription_id && stripeClient.ok) {
    try {
      const sub = await stripeClient.stripe.subscriptions.retrieve(org.stripe_subscription_id, {
        expand: ["items.data.price", "latest_invoice", "discount.coupon"],
      });
      subscriptionStatus = resolveSubscriptionStatus(sub);
      cancelAtPeriodEnd = sub.cancel_at_period_end === true;
      cancelAt = sub.cancel_at ?? null;
      pauseCollection = sub.pause_collection ?? null;
      trialEndEpoch = sub.trial_end ?? null;
      const firstItem = sub.items?.data?.[0];
      const periodEnd =
        firstItem?.current_period_end ??
        (sub as unknown as { current_period_end?: number }).current_period_end ??
        null;
      currentPeriodEndEpoch = periodEnd ?? trialEndEpoch ?? null;
      if (currentPeriodEndEpoch) currentPeriodEnd = formatBillingDate(currentPeriodEndEpoch);
      currentPeriodStartEpoch =
        firstItem?.current_period_start ??
        (sub as unknown as { current_period_start?: number }).current_period_start ??
        null;
      const latestInvoice = (sub as unknown as {
        latest_invoice?: {
          payment_intent?: {
            next_action?: { redirect_to_url?: { url?: string } } | null;
            last_payment_error?: { message?: string; decline_code?: string; code?: string } | null;
          } | null;
        };
      }).latest_invoice;
      const paymentIntent = latestInvoice?.payment_intent ?? null;
      if (paymentIntent?.next_action?.redirect_to_url?.url) nextActionUrl = paymentIntent.next_action.redirect_to_url.url;
      if (paymentIntent?.last_payment_error?.message) lastPaymentErrorMessage = paymentIntent.last_payment_error.message;
      lastPaymentDeclineCode =
        paymentIntent?.last_payment_error?.decline_code ?? paymentIntent?.last_payment_error?.code ?? null;
      const subscriptionPrice = firstItem?.price;
      if (subscriptionPrice) {
        priceMoney = formatStripePrice(
          subscriptionPrice.unit_amount,
          subscriptionPrice.currency,
          subscriptionPrice.recurring?.interval ?? null,
          subscriptionPrice.recurring?.interval_count ?? null
        );
      }
      const discount = (sub as unknown as {
        discount?: {
          coupon?: { name?: string; percent_off?: number | null; amount_off?: number | null; currency?: string | null };
          end?: number | null;
        };
      }).discount;
      if (discount?.coupon) {
        const { name, percent_off, amount_off, currency } = discount.coupon;
        const couponName = name ?? "Discount";
        const detail =
          percent_off != null
            ? `${percent_off}% off`
            : amount_off != null && currency
              ? `${formatStripePrice(amount_off, currency, null, null)?.display ?? ""} off`
              : "applied";
        const through = discount.end != null ? ` through ${formatBillingDate(discount.end)}` : "";
        discountLabel = `${couponName} - ${detail}${through}.`;
      }
    } catch {
      subscriptionLoadFailed = true;
      subscriptionStatus = "none";
    }
  }

  let priceDriftMessage: string | null = null;
  if (!priceMoney && stripeClient.ok) {
    const price = await retrieveConfiguredPrice(stripeClient.priceId);
    if (price) {
      priceMoney = formatStripePrice(
        price.unit_amount,
        price.currency,
        price.recurring?.interval ?? null,
        price.recurring?.interval_count ?? null
      );
      const drift = checkStripePriceDrift({
        amountMinor: price.unit_amount,
        currency: price.currency,
        interval: price.recurring?.interval ?? null,
      });
      maybeWarnPriceDrift(drift);
      if (drift && !drift.ok && isAdmin && process.env.NODE_ENV !== "production") {
        priceDriftMessage = drift.message;
      }
    } else {
      priceLoadFailed = true;
      priceUnavailableReason = "error";
    }
  }

  if (org.stripe_subscription_id && !subscriptionLoadFailed) {
    const cachedStatus = org.stripe_subscription_status ?? null;
    await reconcileSubscriptionState(admin, {
      organizationId: org.id,
      cachedStatus,
      liveStatus: subscriptionStatus,
    });
  }

  let multipleActiveSubs = false;
  let customerCreatedEpoch: number | null = null;
  if (org.stripe_customer_id && stripeClient.ok) {
    try {
      const { all } = await listCustomerSubscriptions(org.stripe_customer_id);
      const active = all.filter((s) => s.status === "active" || s.status === "trialing");
      if (active.length > 1) multipleActiveSubs = true;
      const first = all[all.length - 1];
      if (first && "start_date" in first) {
        customerCreatedEpoch = (first as unknown as { start_date?: number }).start_date ?? null;
      }
    } catch {
      // best-effort diagnostic
    }
  }

  const stripeTaxEnabled = isStripeTaxEnabled();
  let upcomingInvoice: { amountMinor: number; currency: string; nextPaymentAttempt: number | null } | null = null;
  let customerInvoiceCustomFields: Array<{ name: string; value: string }> = [];
  if (org.stripe_customer_id && stripeClient.ok) {
    try {
      const upcoming = await (stripeClient.stripe.invoices as unknown as {
        retrieveUpcoming?: (params: { customer: string }) => Promise<{
          amount_due: number;
          currency: string;
          next_payment_attempt: number | null;
        }>;
      }).retrieveUpcoming?.({ customer: org.stripe_customer_id });
      if (upcoming) {
        upcomingInvoice = {
          amountMinor: upcoming.amount_due,
          currency: upcoming.currency,
          nextPaymentAttempt: upcoming.next_payment_attempt ?? null,
        };
      }
    } catch {
      // no active subscription, or Stripe preview unavailable
    }
  }

  if (org.stripe_customer_id && stripeClient.ok) {
    try {
      const customer = await stripeClient.stripe.customers.retrieve(org.stripe_customer_id, {
        expand: ["tax_ids", "invoice_settings.default_payment_method"],
      });
      if (customer.deleted) {
        customerDeleted = true;
      } else {
        const c = customer as unknown as {
          email?: string | null;
          address?: CustomerAddress | null;
          tax_exempt?: "none" | "exempt" | "reverse";
          balance?: number;
          currency?: string | null;
          tax_ids?: { data?: Array<{ value?: string; verification?: { status?: string } }> };
          invoice_settings?: {
            default_payment_method?: {
              card?: { brand?: string; last4?: string; exp_month?: number; exp_year?: number };
              us_bank_account?: { last4?: string; bank_name?: string | null; account_type?: string | null };
              sepa_debit?: { last4?: string };
              bacs_debit?: { last4?: string };
            } | null;
            custom_fields?: Array<{ name: string; value: string }> | null;
          };
        };
        customerEmail = c.email ?? null;
        customerAddress = c.address ?? null;
        customerTaxIdValue = c.tax_ids?.data?.[0]?.value ?? null;
        customerTaxIdStatus = c.tax_ids?.data?.[0]?.verification?.status ?? null;
        customerTaxExempt = c.tax_exempt ?? "none";
        customerBalanceMinor = c.balance ?? null;
        customerBalanceCurrency = c.currency ?? null;
        const card = c.invoice_settings?.default_payment_method?.card;
        if (card?.brand && card.last4 && card.exp_month && card.exp_year) {
          paymentMethod = {
            kind: "card",
            brand: card.brand,
            last4: card.last4,
            expMonth: card.exp_month,
            expYear: card.exp_year,
          };
        }
        const usBank = c.invoice_settings?.default_payment_method?.us_bank_account;
        const sepa = c.invoice_settings?.default_payment_method?.sepa_debit;
        const bacs = c.invoice_settings?.default_payment_method?.bacs_debit;
        if (usBank?.last4) {
          paymentMethod = { kind: "bank", bankName: usBank.bank_name ?? null, last4: usBank.last4, accountType: usBank.account_type ?? null };
        } else if (sepa?.last4) {
          paymentMethod = { kind: "bank", bankName: "SEPA", last4: sepa.last4, accountType: null };
        } else if (bacs?.last4) {
          paymentMethod = { kind: "bank", bankName: "BACS", last4: bacs.last4, accountType: null };
        }
        customerInvoiceCustomFields = c.invoice_settings?.custom_fields ?? [];
      }
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === "resource_missing") customerDeleted = true;
    }
  }

  return {
    kind: "ready",
    data: {
      searchParams,
      org: {
        id: org.id,
        name: org.name,
        stripeCustomerId: org.stripe_customer_id,
        stripeSubscriptionId: org.stripe_subscription_id,
        stripeSubscriptionStatus: org.stripe_subscription_status,
      },
      isAdmin,
      stripeConfigured,
      billingCheckoutEnabled,
      isTestMode,
      stripeTaxEnabled,
      subscriptionStatus,
      cancelAtPeriodEnd,
      cancelAt,
      pauseCollection,
      currentPeriodEndEpoch,
      currentPeriodEnd,
      currentPeriodStartEpoch,
      trialEndEpoch,
      stripeTrialStartedAt: org.stripe_trial_started_at ?? null,
      stripeTrialEndedAt,
      priceMoney,
      subscriptionLoadFailed,
      priceLoadFailed,
      priceUnavailableReason,
      priceDriftMessage,
      multipleActiveSubs,
      customerCreatedEpoch,
      customerEmail,
      customerAddress,
      customerTaxIdValue,
      customerTaxIdStatus,
      customerTaxExempt,
      customerBalanceMinor,
      customerBalanceCurrency,
      paymentMethod,
      customerDeleted,
      customerInvoiceCustomFields,
      upcomingInvoice,
      discountLabel,
      lastPaymentErrorMessage,
      lastPaymentDeclineCode,
      lastPaymentRemediation: lastPaymentDeclineCode ? declineRemediation(lastPaymentDeclineCode) : null,
      nextActionUrl,
      showSuccessAlert: searchParams.success === "1",
      showCanceledAlert: searchParams.canceled === "1",
      trialEndLabel: trialEndEpoch ? formatTrialEnd(trialEndEpoch) : null,
    },
  };
}
