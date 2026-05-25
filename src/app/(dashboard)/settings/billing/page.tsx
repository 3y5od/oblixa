import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock,
  CreditCard,
  Download,
  FileText,
  HelpCircle,
  LifeBuoy,
  Mail,
  RefreshCw,
  Users,
  type LucideIcon,
} from "lucide-react";
import { declineRemediation } from "@/lib/billing/decline-codes";
import {
  formatBillingDate,
  formatBillingDateRange,
} from "@/lib/billing/format";
import { getAuthContext } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { UiAlert } from "@/components/ui/ui-alert";
import { StatusBadge } from "@/components/ui/status-badge";
import { getStripeClient, resolveSubscriptionStatus } from "@/lib/stripe";
import {
  SubscribeButton,
  ManageSubscriptionButton,
} from "@/components/settings/billing-actions";
import { BillingInvoicesList } from "@/components/settings/billing-invoices-list";
import { BillingActivityFeed } from "@/components/settings/billing-activity-feed";
import {
  BillingCopyButton,
  BillingPrintButton,
} from "@/components/settings/billing-page-actions";
import { SETTINGS_BILLING_STRINGS } from "@/lib/settings/spec-strings";
import {
  RECOVERABLE_SUBSCRIPTION_STATES,
  isBillingPlaceholder,
} from "@/lib/billing/states";
import {
  formatTrialEnd,
  subscriptionStatusBadge,
} from "@/lib/billing/status";
import {
  listCustomerSubscriptions,
  retrieveConfiguredPrice,
} from "@/lib/billing/runtime";
import { isStripeTaxEnabled } from "@/lib/env/server";
import {
  checkStripePriceDrift,
  maybeWarnPriceDrift,
} from "@/lib/billing/spec-prices";
import { reconcileSubscriptionState } from "@/lib/billing/reconcile";

export const metadata = { title: SETTINGS_BILLING_STRINGS.title };
// Stripe SDK uses Node-only APIs (Buffer, crypto). Pin runtime
// explicitly — see docs/billing-page-maximal-pass.md §3.27.
export const runtime = "nodejs";

type Money = { display: string; cadenceLabel: string | null };

// Per-currency decimal map (§16.2 / §1.21). ISO 4217 codes with
// non-2-digit minor units. Default: 2.
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

function formatStripePrice(
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

type FactRow = {
  label: string;
  value: ReactNode;
  /** Apply `tabular-nums` to the value */
  tabular?: boolean;
  /** Optional mono font (emails, IDs, last4 per spec §3 + §10.9) */
  mono?: boolean;
  /** §3.4 group: "facts" (default) or "included" (sub-eyebrow section). */
  group?: "facts" | "included";
  /** §3.16 zero-state Check medallion for plan-includes affirmative state. */
  included?: boolean;
};

function BillingDlRow({ row }: { row: FactRow }) {
  const isPlaceholder = isBillingPlaceholder(row.value);
  const displayValue: ReactNode = isPlaceholder ? (
    <span aria-label={String(row.value)}>—</span>
  ) : (
    row.value
  );
  const valueClasses = [
    "min-w-0 text-[13.5px] inline-flex items-center gap-2",
    row.tabular ? "tabular-nums" : "",
    row.mono ? "font-mono text-[12.5px]" : "",
    isPlaceholder
      ? "text-[var(--text-tertiary)]"
      : "text-[var(--text-primary)]",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      className="grid gap-1 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_78%,transparent)] py-3 transition-colors last:border-b-0 hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_72%,transparent)] sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4"
    >
      <dt className="ui-caps-2 text-[var(--text-tertiary)]">{row.label}</dt>
      <dd className={valueClasses}>
        {/* §3.16 — zero-state Check medallion for included items */}
        {row.included ? (
          <span
            aria-hidden
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border"
            style={{
              borderColor:
                "color-mix(in oklab, var(--success-ink) 28%, var(--border-subtle))",
              background:
                "color-mix(in oklab, var(--success-ink) 12%, var(--surface))",
              color: "var(--success-ink)",
            }}
          >
            <Check className="h-3 w-3" strokeWidth={2.2} aria-hidden />
          </span>
        ) : null}
        <span>{displayValue}</span>
      </dd>
    </div>
  );
}

function BillingDl({ rows }: { rows: ReadonlyArray<FactRow> }) {
  const facts = rows.filter((r) => r.group !== "included");
  const included = rows.filter((r) => r.group === "included");
  return (
    <dl>
      {facts.map((row) => (
        <BillingDlRow key={row.label} row={row} />
      ))}
      {/* §3.4 — INCLUDED sub-eyebrow + grouped rows */}
      {included.length > 0 ? (
        <>
          <div className="pt-5">
            <p className="ui-caps-1 text-[var(--accent)]">
              {SETTINGS_BILLING_STRINGS.includedEyebrow}
            </p>
          </div>
          {included.map((row) => (
            <BillingDlRow key={row.label} row={{ ...row, included: true }} />
          ))}
        </>
      ) : null}
    </dl>
  );
}

// §1.7 — vary FAQ medallion per topic (replaces uniform ShieldCheck)
const FAQ_ICONS: Record<string, LucideIcon> = {
  "What happens when the trial ends?": Clock,
  "Can I export before cancelling?": Download,
  "Can I change plans?": RefreshCw,
  "Can I add more contracts?": FileText,
  "Can I add more team members?": Users,
  "Do you offer setup help?": LifeBuoy,
};

function TrialChipPair({ caps }: { caps: { contracts: number; teamMembers: number } }) {
  // §1.3 / §10.8 — weight-gradation pair, NO bare middle-dot.
  // Primary token at heavier weight; secondary at lighter weight + tighter
  // tracking. Whitespace separates them per spec §2.9 tactic B.
  return (
    <span className="inline-flex items-center gap-3 align-middle">
      <span className="inline-flex items-baseline gap-1.5">
        <span className="tabular-nums font-semibold text-[var(--text-secondary)]">
          {caps.contracts}
        </span>
        <span className="ui-caps-3 text-[var(--text-tertiary)]">contracts</span>
      </span>
      <span className="inline-flex items-baseline gap-1.5">
        <span className="tabular-nums font-semibold text-[var(--text-secondary)]">
          {caps.teamMembers}
        </span>
        <span className="ui-caps-3 text-[var(--text-tertiary)]">team members</span>
      </span>
    </span>
  );
}

// §1.3 — microcopy parts rendered as a ChipPair (no bare dot).
function TrialMicrocopyChipPair() {
  return (
    <span className="inline-flex items-center gap-3 text-[var(--text-tertiary)]">
      {SETTINGS_BILLING_STRINGS.trialMicrocopyParts.map((part) => (
        <span key={part} className="ui-caps-3">
          {part}
        </span>
      ))}
    </span>
  );
}

export default async function BillingPage(props: {
  searchParams: Promise<{
    success?: string;
    canceled?: string;
    session_id?: string;
    error_code?: string;
    error_message?: string;
  }>;
}) {
  const searchParams = await props.searchParams;
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;

  const { user, orgId, admin } = ctx;

  const membershipResult = await admin
    .from("organization_members")
    .select(
      "role, organizations(id, name, stripe_customer_id, stripe_subscription_id, stripe_subscription_status)"
    )
    .eq("user_id", user.id)
    .eq("organization_id", orgId)
    .limit(1)
    .single();
  const membership = membershipResult.data;

  // §1.10 distinguish access-revoked (no row) from query-error (column
  // missing, RLS, etc). Surface a recoverable error instead of falsely
  // claiming "access revoked" when the real cause was a schema/RLS hiccup.
  if (membershipResult.error && !membership) {
    console.error("[settings/billing] membership query:", membershipResult.error);
    return (
      <div className="ui-page-stack mx-auto max-w-4xl gap-4">
        <UiAlert tone="warning">
          We couldn&apos;t load your workspace membership. Refresh to try
          again, or contact{" "}
          <Link href="mailto:support@oblixa.com" className="ui-link font-mono">
            support@oblixa.com
          </Link>
          .
        </UiAlert>
      </div>
    );
  }

  if (!membership) {
    return (
      <div className="ui-page-stack mx-auto max-w-4xl gap-4">
        <UiAlert tone="warning">
          Access revoked. Contact your workspace admin or visit{" "}
          <Link href="/settings/team" className="ui-link">
            Settings → Team
          </Link>
          .
        </UiAlert>
      </div>
    );
  }

  const org = membership.organizations as unknown as {
    id: string;
    name: string;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    stripe_subscription_status: string | null;
  };

  // §7.6 — optional read of stripe_trial_ended_at via a defensive
  // separate query (the column is added by migration 083 which may
  // not be applied yet). Falls back to null without failing the page.
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
  const isAdmin = membership.role === "admin";

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
  // §1.18 customer-deleted edge + §4.16/§4.19/§4.20/§4.22/§9.1/§9.9
  type CustomerAddress = {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
  };
  let customerEmail: string | null = null;
  let customerAddress: CustomerAddress | null = null;
  let customerTaxIdValue: string | null = null;
  let customerTaxExempt: "none" | "exempt" | "reverse" | null = null;
  let customerBalanceMinor: number | null = null;
  let customerBalanceCurrency: string | null = null;
  let defaultPaymentMethod: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  } | null = null;
  // §1.10 — ACH / SEPA / BACS payment method branches
  let defaultBankAccount: {
    bankName: string | null;
    last4: string;
    accountType: string | null;
  } | null = null;
  let customerDeleted = false;
  let lastPaymentErrorMessage: string | null = null;
  let lastPaymentDeclineCode: string | null = null;
  let nextActionUrl: string | null = null;
  let customerTaxIdStatus: string | null = null;

  const stripeClient = await getStripeClient();
  const stripeConfigured = stripeClient.ok;
  const isTestMode =
    stripeClient.ok &&
    typeof process.env.STRIPE_SECRET_KEY === "string" &&
    process.env.STRIPE_SECRET_KEY.startsWith("sk_test_");
  const monthlyConfigured = Boolean(process.env.STRIPE_MONTHLY_PRICE_ID);
  const foundingAvailable =
    process.env.STRIPE_FOUNDING_COUPON_ID != null &&
    process.env.STRIPE_FOUNDING_AVAILABLE !== "0";

  // §1.6: distinguish subscription load failure from "no subscription".
  if (org.stripe_subscription_id && stripeClient.ok) {
    try {
      const sub = await stripeClient.stripe.subscriptions.retrieve(
        org.stripe_subscription_id,
        // §3.12 expand to reduce follow-up calls
        {
          expand: ["items.data.price", "latest_invoice", "discount.coupon"],
        }
      );
      subscriptionStatus = resolveSubscriptionStatus(sub);
      cancelAtPeriodEnd = sub.cancel_at_period_end === true;
      cancelAt = sub.cancel_at ?? null;
      pauseCollection = sub.pause_collection ?? null;
      trialEndEpoch = sub.trial_end ?? null;

      const firstItem = sub.items?.data?.[0];
      // §1.14 guard items[0] empty; §1.4 trial_end fallback.
      const periodEnd =
        firstItem?.current_period_end ??
        (sub as unknown as { current_period_end?: number }).current_period_end ??
        null;
      currentPeriodEndEpoch = periodEnd ?? trialEndEpoch ?? null;
      if (currentPeriodEndEpoch) {
        // §1.11 — locale-aware date formatting
        currentPeriodEnd = formatBillingDate(currentPeriodEndEpoch);
      }
      // §9.18 billing-period start for range chip
      currentPeriodStartEpoch =
        firstItem?.current_period_start ??
        (sub as unknown as { current_period_start?: number }).current_period_start ??
        null;

      // §9.23 SCA / 3DS payment_intent.next_action surfacing
      // §9.26 last_payment_error.message surfacing
      // §1.12 decline_code remediation
      const latestInvoice = (sub as unknown as { latest_invoice?: { payment_intent?: { next_action?: { redirect_to_url?: { url?: string } } | null; last_payment_error?: { message?: string; decline_code?: string; code?: string } | null; status?: string } | null } }).latest_invoice;
      const paymentIntent = latestInvoice?.payment_intent ?? null;
      if (paymentIntent?.next_action?.redirect_to_url?.url) {
        nextActionUrl = paymentIntent.next_action.redirect_to_url.url;
      }
      if (paymentIntent?.last_payment_error?.message) {
        lastPaymentErrorMessage = paymentIntent.last_payment_error.message;
      }
      lastPaymentDeclineCode =
        paymentIntent?.last_payment_error?.decline_code ??
        paymentIntent?.last_payment_error?.code ??
        null;

      // §1.19 derive priceMoney from sub.items[0].price when present
      const subscriptionPrice = firstItem?.price;
      if (subscriptionPrice) {
        priceMoney = formatStripePrice(
          subscriptionPrice.unit_amount,
          subscriptionPrice.currency,
          subscriptionPrice.recurring?.interval ?? null,
          subscriptionPrice.recurring?.interval_count ?? null
        );
      }

      // §1.17 discount surfacing
      const discount = (sub as unknown as { discount?: { coupon?: { name?: string; percent_off?: number | null; amount_off?: number | null; currency?: string | null }; end?: number | null } }).discount;
      if (discount?.coupon) {
        const { name, percent_off, amount_off, currency } = discount.coupon;
        const couponName = name ?? "Discount";
        const detail =
          percent_off != null
            ? `${percent_off}% off`
            : amount_off != null && currency
              ? `${formatStripePrice(amount_off, currency, null, null)?.display ?? ""} off`
              : "applied";
        const through =
          discount.end != null
            ? ` through ${formatBillingDate(discount.end)}`
            : "";
        discountLabel = `${couponName} — ${detail}${through}.`;
      }
    } catch {
      subscriptionLoadFailed = true;
      subscriptionStatus = "none";
    }
  }

  // Fall back to the configured price for unsubscribed users (the
  // checkout target). Skip when we already have priceMoney from the
  // subscription (§1.19). Uses React `cache()` to dedupe within the
  // request (§15.6).
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
      // SPEC: §3.10 dev-time drift assertion; §1.9 visible-in-dev
      const drift = checkStripePriceDrift({
        amountMinor: price.unit_amount,
        currency: price.currency,
        interval: price.recurring?.interval ?? null,
      });
      maybeWarnPriceDrift(drift);
      if (
        drift &&
        !drift.ok &&
        isAdmin &&
        process.env.NODE_ENV !== "production"
      ) {
        priceDriftMessage = drift.message;
      }
    } else {
      priceLoadFailed = true;
      priceUnavailableReason = "error";
    }
  }

  // SPEC: §15.10 reconcile cached DB status with live Stripe status.
  if (org.stripe_subscription_id && !subscriptionLoadFailed) {
    const cachedStatus = (org as unknown as { stripe_subscription_status?: string | null }).stripe_subscription_status ?? null;
    await reconcileSubscriptionState(admin, {
      organizationId: org.id,
      cachedStatus,
      liveStatus: subscriptionStatus,
    });
  }

  // §6.7 multi-subscription detection (admin diagnostic)
  let multipleActiveSubs = false;
  // §12.7 customer-since stat
  let customerCreatedEpoch: number | null = null;
  if (org.stripe_customer_id && stripeClient.ok) {
    try {
      const { all } = await listCustomerSubscriptions(org.stripe_customer_id);
      const active = all.filter(
        (s) => s.status === "active" || s.status === "trialing"
      );
      if (active.length > 1) multipleActiveSubs = true;
      // Customer-since from the first subscription's start_date
      const first = all[all.length - 1];
      if (first && "start_date" in first) {
        customerCreatedEpoch =
          (first as unknown as { start_date?: number }).start_date ?? null;
      }
    } catch {
      // best-effort
    }
  }

  // §12.5 Stripe Tax indicator
  const stripeTaxEnabled = isStripeTaxEnabled();

  // §9.2 next-invoice preview — best-effort, never blocks render
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
      // Upcoming-invoice retrieve fails when there's no active sub —
      // expected for free-plan; silent fallback.
    }
  }

  // §4.16/§4.19/§4.20/§4.22/§9.1/§9.9/§9.20 customer expand fetch
  if (org.stripe_customer_id && stripeClient.ok) {
    try {
      const customer = await stripeClient.stripe.customers.retrieve(
        org.stripe_customer_id,
        {
          expand: [
            "tax_ids",
            "invoice_settings.default_payment_method",
          ],
        }
      );
      if (customer.deleted) {
        customerDeleted = true;
      } else {
        // Stripe.Customer (not deleted) — narrow the type.
        const c = customer as unknown as {
          email?: string | null;
          address?: CustomerAddress | null;
          tax_exempt?: "none" | "exempt" | "reverse";
          balance?: number;
          currency?: string | null;
          tax_ids?: {
            data?: Array<{
              value?: string;
              verification?: { status?: string };
            }>;
          };
          invoice_settings?: {
            default_payment_method?: {
              card?: {
                brand?: string;
                last4?: string;
                exp_month?: number;
                exp_year?: number;
              };
              // §1.10 ACH branch
              us_bank_account?: {
                last4?: string;
                bank_name?: string | null;
                account_type?: string | null;
              };
              sepa_debit?: { last4?: string };
              bacs_debit?: { last4?: string };
            } | null;
            // §4.18 custom invoice fields
            custom_fields?: Array<{ name: string; value: string }> | null;
          };
        };
        customerEmail = c.email ?? null;
        customerAddress = c.address ?? null;
        customerTaxIdValue = c.tax_ids?.data?.[0]?.value ?? null;
        customerTaxIdStatus =
          c.tax_ids?.data?.[0]?.verification?.status ?? null;
        customerTaxExempt = c.tax_exempt ?? "none";
        customerBalanceMinor = c.balance ?? null;
        customerBalanceCurrency = c.currency ?? null;
        const card = c.invoice_settings?.default_payment_method?.card;
        if (card?.brand && card.last4 && card.exp_month && card.exp_year) {
          defaultPaymentMethod = {
            brand: card.brand,
            last4: card.last4,
            expMonth: card.exp_month,
            expYear: card.exp_year,
          };
        }
        // §1.10 — ACH / SEPA / BACS branches
        const usBank =
          c.invoice_settings?.default_payment_method?.us_bank_account;
        const sepa = c.invoice_settings?.default_payment_method?.sepa_debit;
        const bacs = c.invoice_settings?.default_payment_method?.bacs_debit;
        if (usBank?.last4) {
          defaultBankAccount = {
            bankName: usBank.bank_name ?? null,
            last4: usBank.last4,
            accountType: usBank.account_type ?? null,
          };
        } else if (sepa?.last4) {
          defaultBankAccount = {
            bankName: "SEPA",
            last4: sepa.last4,
            accountType: null,
          };
        } else if (bacs?.last4) {
          defaultBankAccount = {
            bankName: "BACS",
            last4: bacs.last4,
            accountType: null,
          };
        }
        customerInvoiceCustomFields =
          c.invoice_settings?.custom_fields ?? [];
      }
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === "resource_missing") {
        customerDeleted = true;
      }
      // Silent on other errors — fall back to no customer data.
    }
  }

  // §6.1 status badge config (via shared lib)
  const badge = subscriptionStatusBadge({
    status: subscriptionStatus,
    cancelAtPeriodEnd,
    cancelAt,
    pauseCollection,
    currentPeriodEnd: currentPeriodEndEpoch,
  });
  const StatusIcon = badge.icon;

  // §1.3 current plan derivation: 3-state
  const currentPlanLabel =
    subscriptionStatus === "none"
      ? "Free"
      : subscriptionStatus === "active" || subscriptionStatus === "trialing"
        ? "Oblixa Pro"
        : "Oblixa Pro (lapsed)";

  const isTrialing = subscriptionStatus === "trialing";

  // §4.3 limits: real numbers from spec strings, branched on trial.
  const limits = isTrialing
    ? SETTINGS_BILLING_STRINGS.trialCaps
    : SETTINGS_BILLING_STRINGS.coreLimits;

  // §1.4 + §3.9 + §3.10 — wire INVOICE ACCESS + CANCELLATION PATH as
  // real links via the portal route (which already supports the
  // `flow_data.type` deep-link mapping per §3.4).
  const invoiceAccessValue: ReactNode = !stripeConfigured
    ? SETTINGS_BILLING_STRINGS.placeholders.unavailableUntilBilling
    : isAdmin ? (
        <Link
          href="/api/stripe/portal?return=invoices"
          className="ui-link inline-flex items-center gap-1"
        >
          View invoices in customer portal
          <ChevronRight className="h-3 w-3" strokeWidth={1.85} aria-hidden />
        </Link>
      )
      : SETTINGS_BILLING_STRINGS.placeholders.unavailableUntilBilling;

  const cancellationPathValue: ReactNode = !stripeConfigured
    ? SETTINGS_BILLING_STRINGS.placeholders.unavailableUntilBilling
    : isAdmin ? (
        <Link
          href="/api/stripe/portal?return=cancel"
          className="ui-link inline-flex items-center gap-1"
        >
          Manage cancellation in customer portal
          <ChevronRight className="h-3 w-3" strokeWidth={1.85} aria-hidden />
        </Link>
      )
      : SETTINGS_BILLING_STRINGS.placeholders.askAdminCancel;

  // §4.3 + §4.11–§4.14 + §4.21 dl rows
  type Row = FactRow & { hideWhen?: boolean };
  const rawRows: Row[] = [
    // §4.1 drop Current plan row when metaStrip has it — but keep
    // when no-plan state where metaStrip lacks "Plan" field.
    {
      label: "Current plan",
      value: currentPlanLabel,
      hideWhen: subscriptionStatus === "active" || subscriptionStatus === "trialing",
    },
    {
      label: "Billing interval",
      value:
        priceMoney?.cadenceLabel ??
        SETTINGS_BILLING_STRINGS.placeholders.notConfigured,
    },
    // §1.5 drop Renewal date when metaStrip has it (currentPeriodEnd
    // non-null); keep for placeholder states.
    {
      label: isTrialing ? "Trial ends" : "Renewal date",
      value:
        currentPeriodEnd ??
        (isTrialing
          ? SETTINGS_BILLING_STRINGS.placeholders.trialEndUnavailable
          : SETTINGS_BILLING_STRINGS.placeholders.notScheduled),
      tabular: true,
      hideWhen: currentPeriodEnd != null,
    },
    // §1.5 + §1.6 + §3.6 — drop "LIMIT" suffix from labels (word-doubling
    // anti-pattern §11.8); §3.5 numeric display-stat treatment.
    {
      label: "Contracts",
      value: (
        <>
          <span className="text-[1.5rem] font-semibold tabular-nums leading-none text-[var(--text-primary)]">
            {limits.contracts}
          </span>
          <span className="ml-2 ui-caps-3 text-[var(--text-tertiary)]">
            included
          </span>
        </>
      ),
    },
    {
      label: "Team members",
      value: (
        <>
          <span className="text-[1.5rem] font-semibold tabular-nums leading-none text-[var(--text-primary)]">
            {limits.teamMembers}
          </span>
          <span className="ml-2 ui-caps-3 text-[var(--text-tertiary)]">
            included
          </span>
        </>
      ),
    },
    // §3.4 + §3.16 — Plan-includes group with INCLUDED sub-eyebrow +
    // Check medallions
    {
      label: "AI extraction",
      value: SETTINGS_BILLING_STRINGS.planContent.aiExtraction,
      group: "included" as const,
    },
    {
      label: "Email reminders",
      value: (
        <>
          {SETTINGS_BILLING_STRINGS.planContent.emailReminders}
          <Link
            href="/settings/notifications"
            className="ui-link ml-2 text-[12px]"
          >
            Manage cadence →
          </Link>
        </>
      ),
      group: "included" as const,
    },
    {
      label: "CSV export",
      value: (
        <Link href="/settings/imports-exports" className="ui-link">
          {SETTINGS_BILLING_STRINGS.planContent.csvExport}
        </Link>
      ),
      group: "included" as const,
    },
    {
      label: "Audit history",
      value: (
        <Link href="/settings/security" className="ui-link">
          {SETTINGS_BILLING_STRINGS.planContent.auditHistory}
        </Link>
      ),
      group: "included" as const,
    },
    // §3.11 — SUPPORT as an action-style link, not heavy mono+underline
    {
      label: "Support",
      value: (
        <Link
          href="mailto:support@oblixa.com"
          className="ui-link inline-flex items-center gap-1.5"
        >
          <Mail className="h-3 w-3" strokeWidth={1.85} aria-hidden />
          <span>Email standard support</span>
        </Link>
      ),
      group: "included" as const,
    },
    // §9.1 payment-method preview (admin + active) — card branch
    ...(defaultPaymentMethod && isAdmin && stripeConfigured
      ? [
          {
            label: "Payment method",
            value: (
              <span className="font-mono text-[12.5px]">
                {defaultPaymentMethod.brand.toUpperCase()} ····{" "}
                {defaultPaymentMethod.last4}{" "}
                <span className="ui-caps-3 text-[var(--text-tertiary)]">
                  exp {String(defaultPaymentMethod.expMonth).padStart(2, "0")}/
                  {String(defaultPaymentMethod.expYear).slice(-2)}
                </span>
              </span>
            ),
            mono: false,
          } as Row,
        ]
      : []),
    // §1.10 payment-method preview — ACH / SEPA / BACS branch
    ...(defaultBankAccount && isAdmin && stripeConfigured
      ? [
          {
            label: "Payment method",
            value: (
              <span className="font-mono text-[12.5px]">
                {(defaultBankAccount.bankName ?? "BANK").toUpperCase()} ····{" "}
                {defaultBankAccount.last4}
                {defaultBankAccount.accountType ? (
                  <span className="ml-2 ui-caps-3 text-[var(--text-tertiary)]">
                    {defaultBankAccount.accountType.toUpperCase()}
                  </span>
                ) : null}
              </span>
            ),
            mono: false,
          } as Row,
        ]
      : []),
    // §9.9 receipt-email row
    ...(customerEmail && isAdmin && stripeConfigured
      ? [
          {
            label: "Receipt email",
            value: (
              <Link
                href="/api/stripe/portal"
                className="ui-link font-mono text-[12.5px]"
              >
                {customerEmail}
              </Link>
            ),
          } as Row,
        ]
      : []),
    // §4.22 billing address
    ...(customerAddress && (customerAddress.line1 || customerAddress.city)
      ? [
          {
            label: "Billing address",
            value: (
              <span className="whitespace-pre-line">
                {[
                  customerAddress.line1,
                  customerAddress.line2,
                  [
                    customerAddress.city,
                    customerAddress.state,
                    customerAddress.postal_code,
                  ]
                    .filter(Boolean)
                    .join(", "),
                  customerAddress.country,
                ]
                  .filter(Boolean)
                  .join("\n")}
              </span>
            ),
          } as Row,
        ]
      : []),
    // §4.16 VAT / Tax ID + §3.20 verification status badge
    ...(customerTaxIdValue
      ? [
          {
            label: "Tax ID",
            value: (
              <span className="inline-flex items-center gap-2">
                <span className="font-mono text-[12.5px]">
                  {customerTaxIdValue}
                </span>
                {customerTaxIdStatus ? (
                  <StatusBadge
                    status={
                      customerTaxIdStatus === "verified"
                        ? "healthy"
                        : customerTaxIdStatus === "pending"
                          ? "info"
                          : customerTaxIdStatus === "unverified"
                            ? "warning"
                            : "empty"
                    }
                  >
                    {customerTaxIdStatus.toUpperCase()}
                  </StatusBadge>
                ) : null}
              </span>
            ),
          } as Row,
        ]
      : []),
    // §4.20 customer.tax_exempt (only when non-default)
    ...(customerTaxExempt && customerTaxExempt !== "none"
      ? [
          {
            label: "Tax status",
            value:
              customerTaxExempt === "exempt"
                ? "Tax exempt"
                : "Reverse-charge (EU B2B)",
          } as Row,
        ]
      : []),
    // §4.19 account credit (negative balance = credit)
    ...(customerBalanceMinor != null &&
    customerBalanceMinor < 0 &&
    customerBalanceCurrency
      ? [
          {
            label: "Account credit",
            value: (
              <>
                <span className="tabular-nums">
                  {formatStripePrice(
                    -customerBalanceMinor,
                    customerBalanceCurrency,
                    null,
                    null
                  )?.display ?? "—"}
                </span>{" "}
                <span className="ui-caps-3 text-[var(--text-tertiary)]">
                  applied to next invoice
                </span>
              </>
            ),
          } as Row,
        ]
      : []),
    // §9.2 next-invoice preview row
    ...(upcomingInvoice && upcomingInvoice.amountMinor > 0
      ? [
          {
            label: "Next invoice",
            value: (
              <>
                <span className="tabular-nums">
                  {formatStripePrice(
                    upcomingInvoice.amountMinor,
                    upcomingInvoice.currency,
                    null,
                    null
                  )?.display ?? "—"}
                </span>{" "}
                {upcomingInvoice.nextPaymentAttempt ? (
                  <span className="ui-caps-3 text-[var(--text-tertiary)]">
                    on {formatBillingDate(upcomingInvoice.nextPaymentAttempt)}
                  </span>
                ) : null}
              </>
            ),
          } as Row,
        ]
      : []),
    // §4.18 custom invoice fields (PO numbers, cost-center)
    ...(customerInvoiceCustomFields.length > 0
      ? customerInvoiceCustomFields.map(
          (field) =>
            ({
              label: field.name,
              value: field.value,
              mono: true,
            }) as Row
        )
      : []),
    {
      label: SETTINGS_BILLING_STRINGS.invoiceLabel,
      value: invoiceAccessValue,
    },
    {
      label: SETTINGS_BILLING_STRINGS.cancellationLabel,
      value: cancellationPathValue,
    },
  ];
  const rows: FactRow[] = rawRows
    .filter((r) => !r.hideWhen)
    .map((row) => {
      const normalized = { ...row };
      delete normalized.hideWhen;
      return normalized;
    });

  function renderBillingActions(): ReactNode {
    if (!isAdmin || !stripeConfigured) return null;

    // §1.27 reactivate for canceled
    if (subscriptionStatus === "canceled") {
      return (
        <SubscribeButton label={SETTINGS_BILLING_STRINGS.reactivateCta} />
      );
    }
    // §1.28 resume checkout for incomplete
    if (subscriptionStatus === "incomplete") {
      return (
        <SubscribeButton label={SETTINGS_BILLING_STRINGS.resumeCheckoutCta} />
      );
    }
    // §1.12 update payment method for past_due / unpaid
    if (
      subscriptionStatus === "past_due" ||
      subscriptionStatus === "unpaid"
    ) {
      return <ManageSubscriptionButton />;
    }
    // §1.29 fresh checkout for incomplete_expired
    if (subscriptionStatus === "incomplete_expired") {
      return <SubscribeButton />;
    }
    // §7.2 trial CTA
    if (isTrialing) {
      return <SubscribeButton label={SETTINGS_BILLING_STRINGS.trialCta} />;
    }
    if (RECOVERABLE_SUBSCRIPTION_STATES.has(subscriptionStatus)) {
      return (
        <>
          <SubscribeButton
            label={SETTINGS_BILLING_STRINGS.primaryCta}
            variant="annual"
          />
          {/* §1.2 + §3.9 secondary CTA gated on monthly priceId configured */}
          {monthlyConfigured ? (
            <SubscribeButton
              label={SETTINGS_BILLING_STRINGS.secondaryCta}
              variant="monthly"
              className="ui-btn-secondary disabled:pointer-events-none disabled:opacity-45"
            />
          ) : null}
        </>
      );
    }
    return <ManageSubscriptionButton />;
  }

  const showSuccessAlert = searchParams.success === "1";
  const showCanceledAlert = searchParams.canceled === "1";

  // §7.1 trial countdown banner + §7.4 caps chip + §3.18 trial-progress
  // chip: compute trial day n of 21 from trial_start + Date.now().
  let trialDay: number | null = null;
  if (isTrialing && trialEndEpoch) {
    const trialStartEpoch =
      (
        membership.organizations as unknown as {
          stripe_trial_started_at?: string | null;
        }
      ).stripe_trial_started_at ?? null;
    const totalDays = SETTINGS_BILLING_STRINGS.trialCaps.days;
    if (trialStartEpoch) {
      const start = new Date(trialStartEpoch).getTime();
      const elapsedDays = Math.floor((Date.now() - start) / (24 * 60 * 60 * 1000));
      trialDay = Math.max(1, Math.min(totalDays, elapsedDays + 1));
    } else {
      // Fallback: compute from trial_end backwards over totalDays.
      const end = trialEndEpoch * 1000;
      const elapsed = totalDays - Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000));
      trialDay = Math.max(1, Math.min(totalDays, elapsed + 1));
    }
  }
  const trialBanner =
    isTrialing && trialEndEpoch
      ? (
        <UiAlert tone="neutral">
          <span className="font-semibold">{formatTrialEnd(trialEndEpoch)}.</span>{" "}
          Convert to keep editing, importing, and exporting.{" "}
          {/* §3.18 trial-progress chip */}
          {trialDay != null ? (
            <span className="ml-2 inline-flex items-baseline gap-1 align-middle">
              <span className="ui-caps-3 text-[var(--text-tertiary)]">DAY</span>
              <span className="tabular-nums font-semibold">
                {trialDay}
              </span>
              <span className="ui-caps-3 text-[var(--text-tertiary)]">
                of {SETTINGS_BILLING_STRINGS.trialCaps.days}
              </span>
            </span>
          ) : null}{" "}
          <TrialChipPair caps={SETTINGS_BILLING_STRINGS.trialCaps} />
        </UiAlert>
      )
      : null;

  // §9.6 cancellation-pending banner + §9.12 confirmation copy + §9.17 export CTA
  const cancellationPendingBanner =
    cancelAtPeriodEnd && currentPeriodEnd ? (
      <UiAlert tone="warning">
        Access ends {currentPeriodEnd}.{" "}
        {SETTINGS_BILLING_STRINGS.cancellationConfirmation.replace(
          "{date}",
          currentPeriodEnd
        )}{" "}
        <Link href="/settings/imports-exports" className="ui-link">
          Export your contract inventory →
        </Link>
      </UiAlert>
    ) : null;

  // §1.30 cancel_at scheduled banner (distinct from cancel_at_period_end)
  const scheduledCancelBanner =
    cancelAt && currentPeriodEndEpoch && cancelAt > currentPeriodEndEpoch ? (
      <UiAlert tone="warning">
        Scheduled to cancel on {formatBillingDate(cancelAt)}.
        Reactivate any time before then via the customer portal.
      </UiAlert>
    ) : null;

  // §9.7 paused banner
  const pausedBanner = pauseCollection ? (
    <UiAlert tone="neutral">
      Billing paused.{" "}
      {pauseCollection.resumes_at
        ? `Collection resumes ${formatBillingDate(pauseCollection.resumes_at)}.`
        : "Resume from the customer portal."}
    </UiAlert>
  ) : null;

  // §9.8 discount banner
  const discountBanner = discountLabel ? (
    <UiAlert tone="success">{discountLabel}</UiAlert>
  ) : null;

  // §1.29 unpaid / incomplete_expired banners
  const unpaidBanner =
    subscriptionStatus === "unpaid" ? (
      <UiAlert tone="warning">
        Payment retries exhausted. Update your payment method to restore
        access.
      </UiAlert>
    ) : null;
  const expiredBanner =
    subscriptionStatus === "incomplete_expired" ? (
      <UiAlert tone="warning">
        Initial payment failed and the recovery window has elapsed. Start a
        new checkout to subscribe.
      </UiAlert>
    ) : null;

  // §9.23 SCA / 3DS authentication-required banner
  const scaBanner = nextActionUrl ? (
    <UiAlert tone="warning">
      Action required — your last payment needs additional authentication.{" "}
      <Link href={nextActionUrl} className="ui-link">
        Complete authentication →
      </Link>
    </UiAlert>
  ) : null;

  // §9.20 card-expiration warning (60-day pre-warning)
  let cardExpirationBanner: ReactNode = null;
  if (defaultPaymentMethod) {
    const expDate = new Date(
      defaultPaymentMethod.expYear,
      defaultPaymentMethod.expMonth - 1,
      1
    );
    const sixtyDaysFromNow = new Date();
    sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);
    if (expDate <= sixtyDaysFromNow) {
      cardExpirationBanner = (
        <UiAlert tone="warning">
          Card ending {defaultPaymentMethod.last4} expires{" "}
          {String(defaultPaymentMethod.expMonth).padStart(2, "0")}/
          {defaultPaymentMethod.expYear}. Update your card before the next
          renewal{currentPeriodEnd ? ` on ${currentPeriodEnd}` : ""}.{" "}
          <Link href="/api/stripe/portal" className="ui-link">
            Update payment method →
          </Link>
        </UiAlert>
      );
    }
  }

  // §1.18 customer-deleted reconnect banner
  const customerDeletedBanner = customerDeleted ? (
    <UiAlert tone="warning">
      Your Stripe billing record could not be found. Contact{" "}
      <Link href="mailto:support@oblixa.com" className="ui-link font-mono">
        support@oblixa.com
      </Link>{" "}
      to reconnect billing.
    </UiAlert>
  ) : null;

  // §9.25 + §9.26 active-risk hero for past_due / unpaid
  const isActiveRisk =
    subscriptionStatus === "past_due" || subscriptionStatus === "unpaid";
  const activeRiskHero =
    isActiveRisk && isAdmin && stripeConfigured ? (
      <section className="ui-card-raised relative overflow-hidden rounded-2xl border border-[color:color-mix(in_oklab,var(--warning)_28%,var(--border-subtle))] p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--warning)_28%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_38%,var(--surface-raised))] text-[var(--warning-ink)]">
            <StatusIcon size={20} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p>
              <span className="ui-caps-1 text-[var(--warning-ink)]">
                Action required
              </span>
            </p>
            <h2 className="mt-1 text-[1.75rem] font-semibold leading-[1.1] tracking-tight text-[var(--text-primary)]">
              Payment failed — restore access
            </h2>
            {lastPaymentErrorMessage ? (
              <>
                <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
                  {lastPaymentErrorMessage}
                </p>
                {/* §1.12 decline_code → remediation hint */}
                {lastPaymentDeclineCode ? (
                  <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                    <span className="ui-caps-3 text-[var(--text-tertiary)]">
                      What to try:
                    </span>{" "}
                    {declineRemediation(lastPaymentDeclineCode)}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
                Your most recent payment didn&apos;t go through. Update your
                payment method to continue editing, importing, and exporting
                contracts.
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-x-1 gap-y-2">
              <ManageSubscriptionButton />
              <Link
                href={SETTINGS_BILLING_STRINGS.contactSalesHref}
                className="ui-btn-ghost inline-flex items-center gap-1 rounded-full px-4 py-2 text-[13px]"
              >
                Contact support
              </Link>
            </div>
          </div>
        </div>
      </section>
    ) : null;

  // §7.6 trial-expired banner (previously trialed, now unsubscribed)
  const trialExpiredBanner =
    subscriptionStatus === "none" && stripeTrialEndedAt ? (
      <UiAlert tone="warning">
        Trial ended on{" "}
        {formatBillingDate(new Date(stripeTrialEndedAt))}.
        Subscribe to restore editing, importing, and exporting.
      </UiAlert>
    ) : null;

  // §9.11 founding-customer offer (when available + admin + no plan)
  const foundingBanner =
    foundingAvailable && isAdmin && subscriptionStatus === "none" ? (
      <UiAlert tone="neutral">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div>
            <span className="font-semibold">Founding customer offer —</span>{" "}
            {SETTINGS_BILLING_STRINGS.foundingCustomerOffer.priceDisplay}.{" "}
            {SETTINGS_BILLING_STRINGS.foundingCustomerOffer.description}
          </div>
          <SubscribeButton
            label={SETTINGS_BILLING_STRINGS.foundingCustomerOffer.ctaLabel}
            variant="annual"
            founding
            className="ui-btn-secondary disabled:pointer-events-none disabled:opacity-45"
          />
        </div>
      </UiAlert>
    ) : null;

  /**
   * §19.1 renderBillingActions — branch matrix:
   *
   * | isAdmin | stripeConfigured | subscriptionStatus            | result                                          |
   * | ------- | ---------------- | ----------------------------- | ----------------------------------------------- |
   * | false   | *                | *                             | null                                            |
   * | true    | false            | *                             | null                                            |
   * | true    | true             | canceled                      | <SubscribeButton label="Reactivate sub…">       |
   * | true    | true             | incomplete                    | <SubscribeButton label="Resume checkout">       |
   * | true    | true             | past_due / unpaid             | <ManageSubscriptionButton>                       |
   * | true    | true             | incomplete_expired            | <SubscribeButton> (fresh)                       |
   * | true    | true             | trialing                      | <SubscribeButton label="Convert to paid plan">  |
   * | true    | true             | none + recoverable            | annual + (monthly when configured)              |
   * | true    | true             | active                        | <ManageSubscriptionButton>                       |
   *
   * Modifiers (cancel_at_period_end, pause_collection, discount, cancel_at)
   * are rendered as separate banners alongside the action slot — they
   * don't change the CTA selection.
   */

  return (
    <div className="ui-page-stack mx-auto max-w-4xl gap-4">
      {/* §11.1 skip-to-content link for keyboard users */}
      <a
        href="#billing-plan-title"
        className="ui-skip-link sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-md focus:bg-[var(--surface-raised)] focus:px-3 focus:py-2 focus:text-[var(--text-primary)] focus:outline-2 focus:outline-[var(--focus-ring)]"
      >
        Skip to billing content
      </a>
      <Link
        href="/settings"
        className="ui-btn-ghost inline-flex max-w-max items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px]"
      >
        {/* §1.25 strokeWidth={2} per spec §5.2 */}
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        {SETTINGS_BILLING_STRINGS.backLabel}
      </Link>

      {/* §2.6 group page-header + alerts via single flex-col wrapper per
          spec §5.3, so they become one stack child. */}
      <div className="flex flex-col gap-4">
        <DashboardPageHeader
          icon={
            <CreditCard
              className="h-[1.125rem] w-[1.125rem]"
              strokeWidth={1.85}
            />
          }
          eyebrow={SETTINGS_BILLING_STRINGS.eyebrow}
          title={SETTINGS_BILLING_STRINGS.title}
          /* §2.1 render lead */
          /* Finishing-pass §1.11 + §5.1 — state-specific lead so the
              free-state page reads as a conversion prompt; subscribed
              states get an action-oriented one. */
          lead={
            subscriptionStatus === "none"
              ? SETTINGS_BILLING_STRINGS.leadFreeState
              : SETTINGS_BILLING_STRINGS.leadActiveState
          }
          metaStrip={
            // Finishing-pass §1.10 — on free state, surface workspace
            // identity + trial-ended date (when available) so the
            // right column isn't empty. The header otherwise reads
            // as missing data on the most common screen state.
            subscriptionStatus === "none" ? (
              <>
                <div>
                  <dt className="ui-caps-2 text-[var(--text-tertiary)]">
                    Workspace
                  </dt>
                  <dd className="mt-0.5 max-w-[14rem] truncate font-medium text-[var(--text-primary)]">
                    {org.name}
                  </dd>
                </div>
                {stripeTrialEndedAt ? (
                  <div>
                    <dt className="ui-caps-2 text-[var(--text-tertiary)]">
                      {SETTINGS_BILLING_STRINGS.trialEndedLabel}
                    </dt>
                    <dd className="mt-0.5 font-medium tabular-nums text-[var(--text-primary)]">
                      {formatBillingDate(
                        Math.floor(new Date(stripeTrialEndedAt).getTime() / 1000)
                      )}
                    </dd>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                {/* §2.4 Plan · Status · Renews */}
                {subscriptionStatus === "active" || subscriptionStatus === "trialing" ? (
                  <div>
                    <dt className="ui-caps-2 text-[var(--text-tertiary)]">
                      Plan
                    </dt>
                    <dd className="mt-0.5 font-medium text-[var(--text-primary)]">
                      {currentPlanLabel}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dd>
                    <StatusBadge status={badge.tone}>
                      <StatusIcon
                        size={12}
                        className="inline-block"
                        aria-hidden
                      />
                      <span className="ml-1.5">{badge.label}</span>
                      {badge.srLabel ? (
                        <span className="sr-only"> {badge.srLabel}</span>
                      ) : null}
                    </StatusBadge>
                  </dd>
                </div>
                {currentPeriodEnd ? (
                  <div>
                    <dt className="ui-caps-2 text-[var(--text-tertiary)]">
                      {isTrialing ? "Trial ends" : "Renews"}
                    </dt>
                    <dd className="mt-0.5 font-medium tabular-nums text-[var(--text-primary)]">
                      {currentPeriodEnd}
                    </dd>
                    {/* §9.18 billing-period range chip (locale-aware §1.11) */}
                    {subscriptionStatus === "active" &&
                    currentPeriodStartEpoch &&
                    currentPeriodEndEpoch ? (
                      <dd className="ui-caps-3 mt-0.5 text-[var(--text-tertiary)] tabular-nums">
                        {formatBillingDateRange(
                          currentPeriodStartEpoch,
                          currentPeriodEndEpoch
                        )}
                      </dd>
                    ) : null}
                    {/* §9.6 — time-zone disclosure */}
                    <dd className="ui-caps-3 mt-0.5 text-[var(--text-tertiary)]">
                      UTC · auto-renews at 00:00
                    </dd>
                  </div>
                ) : null}
                {/* §12.7 customer-since stat (subscribed states only) */}
                {customerCreatedEpoch ? (
                  <div>
                    <dt className="ui-caps-2 text-[var(--text-tertiary)]">
                      Since
                    </dt>
                    <dd className="mt-0.5 font-medium tabular-nums text-[var(--text-primary)]">
                      {new Intl.DateTimeFormat(undefined, {
                        month: "short",
                        year: "numeric",
                      }).format(new Date(customerCreatedEpoch * 1000))}
                    </dd>
                  </div>
                ) : null}
                {/* §12.5 Stripe Tax indicator (subscribed states only) */}
                {stripeTaxEnabled ? (
                  <div>
                    <dd>
                      <span className="ui-caps-3 text-[var(--text-tertiary)]">
                        TAX · AUTO-CALCULATED
                      </span>
                    </dd>
                  </div>
                ) : null}
              </>
            )
          }
          actions={
            // Gap fix #3 — when the premium empty-state takes over for
            // free admins, the empty-state's CTA cluster is the focal
            // action. Drop the duplicate header CTA to avoid two
            // "Choose annual plan" buttons on the same page (§10.4).
            subscriptionStatus === "none" && isAdmin && stripeConfigured
              ? null
              : (
                <div className="flex flex-col items-stretch gap-1.5">
                  {renderBillingActions()}
                  {/* §9.13 + §1.3 — ChipPair microcopy under CTA (none state) */}
                  {subscriptionStatus === "none" && isAdmin && stripeConfigured ? (
                    <div className="flex justify-center">
                      <TrialMicrocopyChipPair />
                    </div>
                  ) : null}
                </div>
              )
          }
        />

        {/* §1.31 test-mode banner — env signal above everything */}
        {/* §11.1 short copy */}
        {isTestMode ? (
          <UiAlert tone="neutral">
            {SETTINGS_BILLING_STRINGS.testModeBannerShort}
          </UiAlert>
        ) : null}

        {/* Environmental alert (§6b.1 env first, transient after) */}
        {!stripeConfigured ? (
          <UiAlert tone="warning">
            {SETTINGS_BILLING_STRINGS.unavailableTitle}{" "}
            {SETTINGS_BILLING_STRINGS.unavailableCopy}
          </UiAlert>
        ) : null}

        {/* §1.6 subscription load failure surfacing */}
        {subscriptionLoadFailed ? (
          <UiAlert tone="warning">
            We couldn&apos;t load your subscription from Stripe.{" "}
            <Link href="/settings/billing" className="ui-link">
              Retry
            </Link>
            .
          </UiAlert>
        ) : null}

        {/* §1.7 / §1.11 price load failure */}
        {priceLoadFailed ? (
          <UiAlert tone="warning">
            {priceUnavailableReason === "deleted"
              ? "Plan is no longer available — contact support."
              : "We couldn't load plan pricing. Refresh to try again."}
          </UiAlert>
        ) : null}

        {/* §1.9 non-admin info alert when no plan */}
        {!isAdmin && subscriptionStatus === "none" ? (
          <UiAlert tone="neutral">
            Only workspace admins can subscribe. Ask an admin to manage
            billing —{" "}
            <Link href="/settings/team" className="ui-link">
              Settings → Team
            </Link>
            .
          </UiAlert>
        ) : null}

        {/* §1.9 — visible Stripe price drift banner in dev */}
        {priceDriftMessage ? (
          <UiAlert tone="warning">
            <span className="font-semibold">Stripe price drift:</span>{" "}
            {priceDriftMessage}. Update the Stripe Dashboard to match
            the release-state spec.
          </UiAlert>
        ) : null}
        {/* §6.7 multi-sub admin diagnostic */}
        {multipleActiveSubs && isAdmin ? (
          <UiAlert tone="warning">
            <span className="font-semibold">
              Multiple active subscriptions detected.
            </span>{" "}
            Contact{" "}
            <Link
              href="mailto:support@oblixa.com"
              className="ui-link"
            >
              support@oblixa.com
            </Link>{" "}
            to reconcile the workspace billing record.
          </UiAlert>
        ) : null}
        {trialBanner}
        {trialExpiredBanner}
        {scheduledCancelBanner}
        {cancellationPendingBanner}
        {pausedBanner}
        {discountBanner}
        {scaBanner}
        {cardExpirationBanner}
        {customerDeletedBanner}
        {unpaidBanner}
        {expiredBanner}
        {foundingBanner}

        {/* §1.1 success / canceled redirect alerts (truthiness fix) */}
        {showSuccessAlert ? (
          <UiAlert tone="success">Billing checkout completed.</UiAlert>
        ) : null}
        {showCanceledAlert ? (
          <UiAlert tone="warning">
            {/* §1.15 surface ?error_message= if Stripe returned it */}
            {searchParams.error_message
              ? `Checkout was canceled: ${searchParams.error_message}`
              : "Checkout was canceled. No charges were made."}
            {searchParams.error_code ? (
              <span className="ui-caps-3 ml-2 font-mono text-[var(--text-tertiary)]">
                CODE {searchParams.error_code}
              </span>
            ) : null}
          </UiAlert>
        ) : null}

        {/* §9.7 + polish-pass §9.9 — explicit list of JS-required actions */}
        <noscript>
          <UiAlert tone="warning">
            {SETTINGS_BILLING_STRINGS.noscriptCopy}
          </UiAlert>
        </noscript>
      </div>

      {activeRiskHero}

      {/* §6.6 — premium-card empty state for free-plan admin per
          [ui-design-principles §8.1]. Renders INSTEAD of the dl-only
          Plan section when the user has no subscription. */}
      {subscriptionStatus === "none" && isAdmin && stripeConfigured ? (
        <section
          className="ui-card-raised relative overflow-hidden rounded-2xl border p-6 sm:p-8"
          aria-labelledby="billing-empty-title"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute rounded-full border border-[color:color-mix(in_oklab,var(--accent)_22%,transparent)] opacity-70"
            style={{ top: "-2.25rem", right: "-2.25rem", width: "7rem", height: "7rem" }}
          />
          <div className="relative flex items-start gap-4">
            <span
              aria-hidden
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_36%,var(--surface-raised))] text-[var(--accent-strong)] shadow-[var(--shadow-1)]"
            >
              {/* Polish-pass §2.6 + §2.8 — Sparkles for empty-state
                  aspirational tone, distinct from page-header CreditCard;
                  40px (was 44px) defers to the canonical page-header. */}
              <CircleDollarSign className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />
            </span>
            <div className="min-w-0 flex-1">
              {/* Polish-pass §2.1 — FREE PLAN renders as StatusBadge
                  (visual anchor); §2.2 — drop WHAT YOU GET eyebrow. */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2
                  id="billing-empty-title"
                  className="text-xl sm:text-[1.4rem] font-semibold tracking-tight text-[var(--text-primary)]"
                >
                  Choose a plan
                </h2>
                <StatusBadge status="info">FREE PLAN</StatusBadge>
              </div>
              {/* Polish-pass §2.10 — body ≤ 80 chars (was 138). */}
              <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
                {SETTINGS_BILLING_STRINGS.emptyStateBody}
              </p>
              {/* Polish-pass §2.9 — PLAN INCLUDES sub-eyebrow */}
              <p className="mt-4 ui-caps-3 text-[var(--text-tertiary)]">
                {SETTINGS_BILLING_STRINGS.planIncludesEyebrow}
              </p>
              {/* Polish-pass §2.3 + §2.12 + finishing-pass §1.8 —
                  Check medallions + responsive grid + max-w to prevent
                  edge-to-edge sprawl at lg+. */}
              <ul className="mt-2 grid max-w-2xl grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  `${SETTINGS_BILLING_STRINGS.coreLimits.contracts} contracts`,
                  `${SETTINGS_BILLING_STRINGS.coreLimits.teamMembers} team members`,
                  "Fair-use AI extraction",
                  "CSV export",
                  "Audit history",
                  "Standard support",
                ].map((feature) => (
                  <li key={feature} className="inline-flex items-center gap-2">
                    <span
                      aria-hidden
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border"
                      style={{
                        borderColor:
                          "color-mix(in oklab, var(--success-ink) 28%, var(--border-subtle))",
                        background:
                          "color-mix(in oklab, var(--success-ink) 12%, var(--surface))",
                        color: "var(--success-ink)",
                      }}
                    >
                      <Check className="h-3 w-3" strokeWidth={2.2} aria-hidden />
                    </span>
                    <span className="text-[12.5px] text-[var(--text-secondary)]">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
              {/* Finishing-pass §2.1 — consolidated CTA cluster into 3
                  zones: (1) above CTA = h2 + body + PLAN INCLUDES grid;
                  (2) CTA row = primary + VIEW PLAN DETAILS; (3) below =
                  single compact row (price · trial · savings) separated
                  by hairline pipes. Drops 6 stacked layers down to 3. */}
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <SubscribeButton
                  label={SETTINGS_BILLING_STRINGS.primaryCta}
                  variant="annual"
                />
                {/* §2.2 — py-2 matches `.ui-btn-primary` vertical padding
                    so the chip baseline-aligns with the primary CTA. */}
                <Link
                  href={SETTINGS_BILLING_STRINGS.publicPricingHref}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2 ui-caps-3 text-[var(--accent-strong)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,var(--surface-raised))]"
                >
                  VIEW PLAN DETAILS
                  <ChevronRight
                    className="h-3 w-3"
                    strokeWidth={1.85}
                    aria-hidden
                  />
                </Link>
              </div>
              {/* §2.1 below-CTA single compact row — price · trial
                  microcopy · savings, separated by hairline pipes.
                  Per release-state §Pricing: $249/month billed annually. */}
              <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
                <span className="inline-flex items-baseline gap-1.5">
                  <span className="text-[1.5rem] font-semibold tabular-nums leading-none text-[var(--text-primary)]">
                    $249
                  </span>
                  <span className="text-[12.5px] text-[var(--text-tertiary)]">
                    /month · billed annually
                  </span>
                </span>
                <span
                  aria-hidden
                  className="hidden h-3 w-px bg-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] sm:inline-block"
                />
                <TrialMicrocopyChipPair />
                {monthlyConfigured ? (
                  <>
                    <span
                      aria-hidden
                      className="hidden h-3 w-px bg-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] sm:inline-block"
                    />
                    <span className="ui-caps-3 text-[var(--success-ink)]">
                      SAVE $600/YR
                    </span>
                  </>
                ) : null}
              </div>
              {/* §6.5 — plan comparison mini-table (when monthly configured) */}
              {monthlyConfigured ? (
                <div className="mt-5 grid gap-3 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-4 sm:grid-cols-2 sm:gap-4">
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3">
                    <p className="ui-caps-2 text-[var(--text-tertiary)]">Monthly</p>
                    <p className="mt-1">
                      <span className="text-[1.25rem] font-semibold tabular-nums">
                        $299
                      </span>{" "}
                      <span className="text-[12.5px] text-[var(--text-tertiary)]">
                        per month
                      </span>
                    </p>
                  </div>
                  <div className="rounded-lg border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_24%,var(--surface-raised))] p-3">
                    <p className="ui-caps-2 text-[var(--accent-strong)]">Annual</p>
                    <p className="mt-1">
                      <span className="text-[1.25rem] font-semibold tabular-nums">
                        $249
                      </span>{" "}
                      <span className="text-[12.5px] text-[var(--text-tertiary)]">
                        /month billed annually
                      </span>
                    </p>
                    <p className="ui-caps-3 mt-1 text-[var(--success-ink)]">
                      SAVE $600/YR
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : (
      <section className="ui-card p-0" aria-labelledby="billing-plan-title">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] px-5 py-5">
          {/* §5.1 "Plan and account status" → "Plan"; §5.3 responsive
              §3.13 add WHAT YOU GET eyebrow */}
          <div>
            <p>
              <span className="ui-caps-1 text-[var(--accent)]">
                {SETTINGS_BILLING_STRINGS.whatYouGetEyebrow}
              </span>
            </p>
            <h2
              id="billing-plan-title"
              className="mt-1 text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)] sm:text-[1.4rem]"
            >
              Plan
            </h2>
          </div>
          {priceMoney ? (
            // §10.2 — whitespace-nowrap so the price + cadence don't wrap
            <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="text-[1.5rem] font-semibold tabular-nums leading-none text-[var(--text-primary)]">
                {priceMoney.display}
              </span>
              {priceMoney.cadenceLabel ? (
                // §3.7 — lowercase cadence reads more natural beside a big number
                <span className="text-[12.5px] text-[var(--text-tertiary)]">
                  {priceMoney.cadenceLabel}
                </span>
              ) : null}
            </span>
          ) : null}
        </header>
        <div className="px-5 py-4">
          <BillingDl rows={rows} />
        </div>
        {/* §9.3 + §3.12 tax footnote — drop caps treatment per §3.12 */}
        <footer className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_62%,transparent)] px-5 py-3">
          <p className="text-[11.5px] leading-snug text-[var(--text-tertiary)]">
            {SETTINGS_BILLING_STRINGS.taxNote}
          </p>
        </footer>
      </section>
      )}

      {/* Finishing-pass §10.1 — 2-col grid at lg+ pairs Recent invoices
          with FAQ so the rhythm alternates with the prior single-col
          empty-state. Per spec §10.18 visual rhythm via layout variation.
          On <lg widths the grid degrades to single column. */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {org.stripe_customer_id && isAdmin && stripeConfigured ? (
          <Suspense
            fallback={
              <section className="ui-card ui-loading-panel p-0">
                <div className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] px-5 py-4">
                  <span aria-hidden className="ui-skeleton h-5 w-32 rounded" />
                </div>
                <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_62%,transparent)] px-5">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <li key={i} className="py-3">
                      <span aria-hidden className="ui-skeleton h-4 w-full rounded" />
                    </li>
                  ))}
                </ul>
              </section>
            }
          >
            <BillingInvoicesList customerId={org.stripe_customer_id} />
          </Suspense>
        ) : null}

        <section className="ui-card p-0" aria-labelledby="billing-faq-title">
        <header className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] px-5 py-5">
          {/* §4.2 — eyebrow "FAQ" + h2 "Common billing questions"
              (self-describing; HELP read as a category that points
              elsewhere). §5.1 py-5 padding. §5.2 eyebrow color → accent. */}
          <p className="ui-caps-1 text-[var(--accent)]">FAQ</p>
          <h2
            id="billing-faq-title"
            className="mt-1 text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)] sm:text-[1.4rem]"
          >
            Common billing questions
          </h2>
        </header>
        <div className="px-5 py-2">
          {SETTINGS_BILLING_STRINGS.faq.map((question, idx) => {
            const answer = (
              SETTINGS_BILLING_STRINGS.faqAnswers as Record<string, string>
            )[question];
            const total = SETTINGS_BILLING_STRINGS.faq.length;
            return (
              <details
                key={question}
                /* §8.2 name="billing-faq" → native exclusive-open behavior */
                name="billing-faq"
                /* §4.4 default-open the first question for first-paint
                    content density */
                open={idx === 0 ? true : undefined}
                className="ui-billing-faq group"
              >
                <summary
                  className="ui-billing-faq-summary flex min-h-[44px] cursor-pointer list-none items-center gap-3 border-y border-[color:color-mix(in_oklab,var(--border-subtle)_88%,transparent)] py-3 outline-none transition-colors marker:hidden hover:border-[color:color-mix(in_oklab,var(--success)_18%,var(--border-subtle))] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] [&::-webkit-details-marker]:hidden"
                  /* §9.2 aria-label with question index */
                  aria-label={`Question ${idx + 1} of ${total}: ${question}`}
                >
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[color:color-mix(in_oklab,var(--accent)_18%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,var(--surface-raised))] text-[var(--accent-strong)]">
                    {(() => {
                      const Icon = FAQ_ICONS[question] ?? HelpCircle;
                      return <Icon className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />;
                    })()}
                  </span>
                  <span className="flex min-w-0 flex-1 items-baseline text-[13.5px] font-semibold text-[var(--text-primary)] group-open:text-[var(--accent-strong)]">
                    {question}
                  </span>
                  {/* §5.7 ChevronRight rotates 90° on open per spec §6 */}
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-[var(--text-tertiary)] transition-transform group-open:rotate-90 group-hover:text-[var(--text-secondary)]"
                    strokeWidth={1.85}
                    aria-hidden
                  />
                </summary>
                <div className="py-3 pl-10 pr-2">
                  <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--text-secondary)]">
                    {answer}
                  </p>
                </div>
              </details>
            );
          })}
        </div>
        {/* Polish-pass §4.7 — release-state §305 exact phrasing, no `?`
            Polish-pass §4.2 — replace bare middle-dot separators with
            ui-rule-vert hairline per spec §2.9 tactic C. */}
        <footer className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_62%,transparent)] px-5 py-4 text-[12.5px]">
          <span className="text-[var(--text-secondary)]">
            {SETTINGS_BILLING_STRINGS.contactSalesPromptSpec}
          </span>
          <Link
            href={SETTINGS_BILLING_STRINGS.contactSalesHref}
            className="ui-link inline-flex items-center gap-1.5"
          >
            <Mail className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
            {SETTINGS_BILLING_STRINGS.contactSalesCta} →
          </Link>
          <span
            aria-hidden
            className="hidden h-3 w-px bg-[var(--border-subtle)] sm:inline-block"
          />
          <Link
            href={SETTINGS_BILLING_STRINGS.publicPricingHref}
            className="ui-link"
          >
            {SETTINGS_BILLING_STRINGS.publicPricingLink}
          </Link>
          {isAdmin ? (
            <>
              <span
                aria-hidden
                className="hidden h-3 w-px bg-[var(--border-subtle)] sm:inline-block"
              />
              <Link
                href="/settings/security?filter=billing"
                className="ui-link"
              >
                View billing change history →
              </Link>
            </>
          ) : null}
        </footer>
      </section>
      </div>

      {/* §9.16 + §9.24 + §15.8 activity feed, streamed via Suspense.
          Finishing-pass §10.1 — moved below the invoices+FAQ grid so
          the 2-col rhythm reads cleanly. */}
      {org.stripe_customer_id && isAdmin && stripeConfigured ? (
        <Suspense
          fallback={
            <section className="ui-card ui-loading-panel p-0">
              <div className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] px-5 py-4">
                <span aria-hidden className="ui-skeleton h-5 w-40 rounded" />
              </div>
              <ul className="px-5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <li key={i} className="py-3">
                    <span aria-hidden className="ui-skeleton h-3 w-full rounded" />
                  </li>
                ))}
              </ul>
            </section>
          }
        >
          <BillingActivityFeed customerId={org.stripe_customer_id} />
        </Suspense>
      ) : null}

      {/* Polish-pass §6.1 + §6.2 — wrap utility row in a quiet card
          with ADMIN prefix. §1.2 + §6.5 — canonical disclosure with
          rotating ChevronRight on the test-cards details (no native
          marker). §7.5 — workspace-ID copy alongside customer-ID. */}
      {isAdmin && stripeConfigured ? (
        <section
          className="ui-card-quiet rounded-xl border border-[var(--border-subtle)] px-4 py-3 billing-no-print"
          aria-labelledby="billing-admin-utility-title"
        >
          <p
            id="billing-admin-utility-title"
            className="ui-caps-3 text-[var(--text-tertiary)]"
          >
            {SETTINGS_BILLING_STRINGS.adminUtilityLabel}
          </p>
          {/* Finishing-pass §6.2 — group CUSTOMER + WORKSPACE buttons
              under an "Identifiers" sub-eyebrow so they read as paired
              data displays (with copy as secondary affordance), while
              Print remains a standalone action. */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            <BillingPrintButton />
            <span
              aria-hidden
              className="hidden h-3 w-px bg-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] sm:inline-block"
            />
            <div
              role="group"
              aria-label="Identifiers"
              className="inline-flex flex-wrap items-center gap-x-2 gap-y-1"
            >
              <span className="ui-caps-3 text-[var(--text-tertiary)]">
                Identifiers
              </span>
              {org.stripe_customer_id ? (
                <BillingCopyButton
                  value={org.stripe_customer_id}
                  label={SETTINGS_BILLING_STRINGS.customerIdLabel}
                />
              ) : null}
              <BillingCopyButton
                value={org.id}
                label={SETTINGS_BILLING_STRINGS.workspaceIdLabel}
                prefix={6}
                suffix={4}
              />
            </div>
            {isTestMode ? (
              <details className="group ml-auto">
                {/* Finishing-pass §1.4 + §6.3 — bump chevron to h-3.5
                    for clearer disclosure affordance visibility. */}
                <summary className="ui-link inline-flex cursor-pointer items-center gap-1.5 text-[12.5px] marker:hidden [&::-webkit-details-marker]:hidden">
                  Stripe test cards
                  <ChevronRight
                    className="h-3.5 w-3.5 transition-transform group-open:rotate-90 motion-reduce:transition-none"
                    strokeWidth={1.85}
                    aria-hidden
                  />
                </summary>
                <ul className="mt-2 space-y-1 text-[12px] font-mono text-[var(--text-secondary)]">
                  {SETTINGS_BILLING_STRINGS.testCardHints.map((c) => (
                    <li key={c.card}>
                      <span className="tabular-nums">{c.card}</span>
                      <span className="ml-2 text-[var(--text-tertiary)]">
                        — {c.outcome}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
