import Link from "next/link";
import { ChevronRight, Mail } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { SETTINGS_BILLING_STRINGS } from "@/lib/settings/spec-strings";
import { formatBillingDate } from "@/lib/billing/format";
import type { BillingPageData } from "./billing-page-model";
import { formatStripePrice } from "./billing-page-model";
import type { FactRow } from "./billing-page-primitives";

type Row = FactRow & { hideWhen?: boolean };

export function buildBillingPlanRows(data: BillingPageData): FactRow[] {
  const isTrialing = data.subscriptionStatus === "trialing";
  const currentPlanLabel =
    data.subscriptionStatus === "none"
      ? "Access review"
      : data.subscriptionStatus === "active" || data.subscriptionStatus === "trialing"
        ? "Oblixa Pro"
        : "Oblixa Pro (lapsed)";
  const limits = isTrialing ? SETTINGS_BILLING_STRINGS.trialCaps : SETTINGS_BILLING_STRINGS.coreLimits;
  const invoiceAccessValue =
    !data.stripeConfigured ? (
      SETTINGS_BILLING_STRINGS.placeholders.unavailableUntilBilling
    ) : data.isAdmin ? (
      <Link href="/api/stripe/portal?return=invoices" className="ui-link inline-flex items-center gap-1">
        View invoices in customer portal
        <ChevronRight className="h-3 w-3" strokeWidth={1.85} aria-hidden />
      </Link>
    ) : (
      SETTINGS_BILLING_STRINGS.placeholders.unavailableUntilBilling
    );
  const cancellationPathValue =
    !data.stripeConfigured ? (
      SETTINGS_BILLING_STRINGS.placeholders.unavailableUntilBilling
    ) : data.isAdmin ? (
      <Link href="/api/stripe/portal?return=cancel" className="ui-link inline-flex items-center gap-1">
        Manage cancellation in customer portal
        <ChevronRight className="h-3 w-3" strokeWidth={1.85} aria-hidden />
      </Link>
    ) : (
      SETTINGS_BILLING_STRINGS.placeholders.askAdminCancel
    );
  const paymentMethodRows: Row[] =
    data.paymentMethod && data.isAdmin && data.stripeConfigured
      ? [
          data.paymentMethod.kind === "card"
            ? {
                label: "Payment method",
                value: (
                  <span className="font-mono text-[12.5px]">
                    {data.paymentMethod.brand.toUpperCase()} {"\u00b7\u00b7\u00b7\u00b7"} {data.paymentMethod.last4}{" "}
                    <span className="ui-caps-3 text-[var(--text-tertiary)]">
                      exp {String(data.paymentMethod.expMonth).padStart(2, "0")}/{String(data.paymentMethod.expYear).slice(-2)}
                    </span>
                  </span>
                ),
              }
            : {
                label: "Payment method",
                value: (
                  <span className="font-mono text-[12.5px]">
                    {(data.paymentMethod.bankName ?? "BANK").toUpperCase()} {"\u00b7\u00b7\u00b7\u00b7"} {data.paymentMethod.last4}
                    {data.paymentMethod.accountType ? (
                      <span className="ml-2 ui-caps-3 text-[var(--text-tertiary)]">
                        {data.paymentMethod.accountType.toUpperCase()}
                      </span>
                    ) : null}
                  </span>
                ),
              },
        ]
      : [];
  const rows: Row[] = [
    {
      label: "Current plan",
      value: currentPlanLabel,
      hideWhen: data.subscriptionStatus === "active" || data.subscriptionStatus === "trialing",
    },
    {
      label: "Billing interval",
      value: data.priceMoney?.cadenceLabel ?? SETTINGS_BILLING_STRINGS.placeholders.notConfigured,
    },
    {
      label: isTrialing ? "Activation ends" : "Renewal date",
      value:
        data.currentPeriodEnd ??
        (isTrialing ? SETTINGS_BILLING_STRINGS.placeholders.trialEndUnavailable : SETTINGS_BILLING_STRINGS.placeholders.notScheduled),
      tabular: true,
      hideWhen: data.currentPeriodEnd != null,
    },
    {
      label: "Contracts",
      value: (
        <>
          <span className="text-[1.5rem] font-semibold tabular-nums leading-none text-[var(--text-primary)]">{limits.contracts}</span>
          <span className="ml-2 ui-caps-3 text-[var(--text-tertiary)]">included</span>
        </>
      ),
    },
    {
      label: "Team members",
      value: (
        <>
          <span className="text-[1.5rem] font-semibold tabular-nums leading-none text-[var(--text-primary)]">{limits.teamMembers}</span>
          <span className="ml-2 ui-caps-3 text-[var(--text-tertiary)]">included</span>
        </>
      ),
    },
    { label: "Field suggestions", value: SETTINGS_BILLING_STRINGS.planContent.aiExtraction, group: "included" },
    {
      label: "Email reminders",
      value: (
        <>
          {SETTINGS_BILLING_STRINGS.planContent.emailReminders}
          <Link href="/settings/operations#notifications" className="ui-link ml-2 inline-flex items-center gap-0.5 text-[12px]">
            Manage cadence
            <ChevronRight className="h-3 w-3" strokeWidth={1.85} aria-hidden />
          </Link>
        </>
      ),
      group: "included",
    },
    {
      label: "CSV export",
      value: (
        <Link href="/settings/imports-exports" className="ui-link">
          {SETTINGS_BILLING_STRINGS.planContent.csvExport}
        </Link>
      ),
      group: "included",
    },
    {
      label: "Audit history",
      value: (
        <Link href="/settings/security" className="ui-link">
          {SETTINGS_BILLING_STRINGS.planContent.auditHistory}
        </Link>
      ),
      group: "included",
    },
    {
      label: "Support",
      value: (
        <Link href="mailto:support@oblixa.com" className="ui-link inline-flex items-center gap-1.5">
          <Mail className="h-3 w-3" strokeWidth={1.85} aria-hidden />
          <span>Email standard support</span>
        </Link>
      ),
      group: "included",
    },
    ...paymentMethodRows,
    ...(data.customerEmail && data.isAdmin && data.stripeConfigured
      ? [{ label: "Receipt email", value: <Link href="/api/stripe/portal" className="ui-link font-mono text-[12.5px]">{data.customerEmail}</Link> }]
      : []),
    ...(data.customerAddress && (data.customerAddress.line1 || data.customerAddress.city)
      ? [
          {
            label: "Billing address",
            value: (
              <span className="whitespace-pre-line">
                {[
                  data.customerAddress.line1,
                  data.customerAddress.line2,
                  [data.customerAddress.city, data.customerAddress.state, data.customerAddress.postal_code].filter(Boolean).join(", "),
                  data.customerAddress.country,
                ]
                  .filter(Boolean)
                  .join("\n")}
              </span>
            ),
          },
        ]
      : []),
    ...(data.customerTaxIdValue
      ? [
          {
            label: "Tax ID",
            value: (
              <span className="inline-flex items-center gap-2">
                <span className="font-mono text-[12.5px]">{data.customerTaxIdValue}</span>
                {data.customerTaxIdStatus ? (
                  <StatusBadge
                    status={
                      data.customerTaxIdStatus === "verified"
                        ? "healthy"
                        : data.customerTaxIdStatus === "pending"
                          ? "info"
                          : data.customerTaxIdStatus === "unverified"
                            ? "warning"
                            : "empty"
                    }
                  >
                    {data.customerTaxIdStatus.toUpperCase()}
                  </StatusBadge>
                ) : null}
              </span>
            ),
          },
        ]
      : []),
    ...(data.customerTaxExempt && data.customerTaxExempt !== "none"
      ? [{ label: "Tax status", value: data.customerTaxExempt === "exempt" ? "Tax exempt" : "Reverse-charge (EU B2B)" }]
      : []),
    ...(data.customerBalanceMinor != null && data.customerBalanceMinor < 0 && data.customerBalanceCurrency
      ? [
          {
            label: "Account credit",
            value: (
              <>
                <span className="tabular-nums">
                  {formatStripePrice(-data.customerBalanceMinor, data.customerBalanceCurrency, null, null)?.display ?? "\u2014"}
                </span>{" "}
                <span className="ui-caps-3 text-[var(--text-tertiary)]">applied to next invoice</span>
              </>
            ),
          },
        ]
      : []),
    ...(data.upcomingInvoice && data.upcomingInvoice.amountMinor > 0
      ? [
          {
            label: "Next invoice",
            value: (
              <>
                <span className="tabular-nums">
                  {formatStripePrice(data.upcomingInvoice.amountMinor, data.upcomingInvoice.currency, null, null)?.display ?? "\u2014"}
                </span>{" "}
                {data.upcomingInvoice.nextPaymentAttempt ? (
                  <span className="ui-caps-3 text-[var(--text-tertiary)]">
                    on {formatBillingDate(data.upcomingInvoice.nextPaymentAttempt)}
                  </span>
                ) : null}
              </>
            ),
          },
        ]
      : []),
    ...data.customerInvoiceCustomFields.map((field) => ({ label: field.name, value: field.value, mono: true })),
    { label: SETTINGS_BILLING_STRINGS.invoiceLabel, value: invoiceAccessValue },
    { label: SETTINGS_BILLING_STRINGS.cancellationLabel, value: cancellationPathValue },
  ];
  return rows
    .filter((r) => !r.hideWhen)
    .map((row) => {
      const normalized = { ...row };
      delete normalized.hideWhen;
      return normalized;
    });
}
