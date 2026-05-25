import "server-only";
import Link from "next/link";
import { format } from "date-fns";
import { ChevronRight, Inbox } from "lucide-react";
import { getStripeClient } from "@/lib/stripe";
import { StatusBadge } from "@/components/ui/status-badge";
import type { SemanticStatus } from "@/components/ui/status-badge";
import { ChipCapsule } from "@/components/ui/chip-capsule";
import { SETTINGS_BILLING_STRINGS } from "@/lib/settings/spec-strings";
import { mapWithConcurrency } from "@/lib/extraction/concurrency";
import type { Stripe } from "stripe";

const STRIPE_REFUND_LOOKUP_CONCURRENCY = 2;

/**
 * SPEC: docs/billing-page-maximal-pass.md §9.5 + §9.19 + §4.17 — recent
 * invoices list. Renders up to 5 invoices server-side. Uses §8.6
 * hover-revealed structured affordance for the download link.
 */
export async function BillingInvoicesList({
  customerId,
}: {
  customerId: string | null;
}) {
  if (!customerId) return null;

  const stripeClient = await getStripeClient();
  if (!stripeClient.ok) return null;

  type Invoice = Stripe.Invoice;
  let invoices: Invoice[];
  try {
    const list = await stripeClient.stripe.invoices.list({
      customer: customerId,
      limit: 5,
      expand: ["data.charge"],
    });
    invoices = list.data;
  } catch (err) {
    // SPEC: §15.11 log requestId
    const e = err as { requestId?: string; code?: string };
    console.error("[BillingInvoicesList]", err instanceof Error ? err.message : err, {
      requestId: e.requestId,
      code: e.code,
    });
    return null;
  }

  // Finishing-pass §3.1 — collapse empty invoices to a hairline strip
  // (no card chrome, no header) per spec §8.7. The card-header + body
  // structure for "no content" is visual noise. Becomes a single
  // inline row: caps eyebrow · inbox icon + label · ActionChip.
  if (!invoices.length) {
    return (
      <section
        aria-labelledby="billing-invoices-empty-title"
        className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-2.5"
      >
        <p
          id="billing-invoices-empty-title"
          className="ui-caps-2 text-[var(--accent-strong)]"
        >
          {SETTINGS_BILLING_STRINGS.invoicesEyebrow}
        </p>
        <span
          aria-hidden
          className="hidden h-3 w-px bg-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] sm:inline-block"
        />
        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--text-secondary)]">
          <Inbox className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
          {SETTINGS_BILLING_STRINGS.noInvoicesYet}
        </span>
        <Link
          href="/api/stripe/portal"
          className="ml-auto inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1 ui-caps-3 text-[var(--accent-strong)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,var(--surface-raised))]"
        >
          VIEW PORTAL
          <ChevronRight className="h-3 w-3" strokeWidth={1.85} aria-hidden />
        </Link>
      </section>
    );
  }

  // Fetch refunds per charge (§9.19) — best effort.
  // Stripe SDK 22.x deprecated Invoice.charge from public types; runtime
  // still has it. Narrow via unknown cast.
  const refundsPerInvoice = await mapWithConcurrency(
    invoices,
    STRIPE_REFUND_LOOKUP_CONCURRENCY,
    async (inv) => {
      const invAsAny = inv as unknown as {
        charge?: string | { id?: string } | null;
      };
      const chargeId =
        typeof invAsAny.charge === "string"
          ? invAsAny.charge
          : invAsAny.charge && "id" in invAsAny.charge
            ? invAsAny.charge.id ?? null
            : null;
      if (!chargeId) return 0;
      try {
        const refunds = await stripeClient.stripe.refunds.list({
          charge: chargeId,
          limit: 10,
        });
        return refunds.data.reduce((acc, r) => acc + (r.amount ?? 0), 0);
      } catch {
        return 0;
      }
    }
  );

  const statusToneMap: Record<string, SemanticStatus> = {
    paid: "healthy",
    open: "info",
    void: "warning",
    uncollectible: "warning",
    draft: "empty",
  };

  function formatMinor(minor: number, currency: string): string {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency.toUpperCase(),
      }).format(minor / 100);
    } catch {
      return `${(minor / 100).toFixed(2)} ${currency.toUpperCase()}`;
    }
  }

  return (
    <section
      className="ui-card p-0"
      aria-labelledby="billing-invoices-title"
    >
      <header className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] px-5 py-4">
        <p className="ui-caps-1 text-[var(--accent-strong)]">History</p>
        <h2
          id="billing-invoices-title"
          className="mt-1 text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)] sm:text-[1.4rem]"
        >
          Recent invoices
        </h2>
      </header>
      <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_62%,transparent)]">
        {invoices.map((inv, idx) => {
          const refundedMinor = refundsPerInvoice[idx] ?? 0;
          const isFullyRefunded =
            refundedMinor > 0 && refundedMinor >= inv.amount_paid;
          const isPartiallyRefunded = refundedMinor > 0 && !isFullyRefunded;
          const tone: SemanticStatus = isFullyRefunded
            ? "info"
            : (statusToneMap[inv.status ?? ""] ?? "empty");
          const statusLabel = isFullyRefunded
            ? "REFUNDED"
            : isPartiallyRefunded
              ? "PARTIAL"
              : (inv.status ?? "unknown").toUpperCase();

          const hasMultipleLines = (inv.lines?.data?.length ?? 0) > 1;

          return (
            <li key={inv.id ?? idx} className="group px-5 py-3">
              <div className="grid grid-cols-[7rem_minmax(0,1fr)_5rem_6rem_auto] items-center gap-3 sm:gap-4">
                <span className="font-mono text-[12.5px] tabular-nums text-[var(--text-secondary)]">
                  {format(new Date(inv.created * 1000), "MMM d, yyyy")}
                </span>
                <span className="min-w-0 truncate text-[13.5px] text-[var(--text-primary)]">
                  {inv.number ?? "Invoice"}
                  {inv.attempt_count > 1 ? (
                    <span className="ml-2 ui-caps-3 text-[var(--warning-ink)]">
                      RETRY {inv.attempt_count}
                    </span>
                  ) : null}
                </span>
                <span className="tabular-nums text-[13.5px]">
                  {refundedMinor > 0 ? (
                    <>
                      <span className="line-through text-[var(--text-tertiary)]">
                        {formatMinor(inv.amount_paid, inv.currency)}
                      </span>
                      <span className="block ui-caps-3 text-[var(--info-ink,var(--text-secondary))]">
                        −{formatMinor(refundedMinor, inv.currency)}
                      </span>
                    </>
                  ) : (
                    <>{formatMinor(inv.amount_paid, inv.currency)}</>
                  )}
                </span>
                <StatusBadge status={tone}>{statusLabel}</StatusBadge>
                <div className="flex items-center justify-end">
                  {/* §8.6 hover-revealed structured affordance */}
                  {inv.invoice_pdf ? (
                    // §3.19 — proxy through /api/stripe/invoices/[id]/pdf
                    // so stale `invoice_pdf` URLs don't 404 on click.
                    <Link
                      href={`/api/stripe/invoices/${inv.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="opacity-70 transition-opacity hover:opacity-100 focus-visible:opacity-100"
                      aria-label={`Download invoice ${inv.number ?? ""} as PDF`}
                    >
                      <span className="inline-flex items-center gap-0.5 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-strong)]">
                        PDF
                        <ChevronRight className="h-2.5 w-2.5" strokeWidth={1.85} />
                      </span>
                    </Link>
                  ) : null}
                </div>
              </div>
              {hasMultipleLines ? (
                <details className="mt-2">
                  <summary className="cursor-pointer list-none ui-caps-3 text-[var(--text-tertiary)] [&::-webkit-details-marker]:hidden">
                    {inv.lines.data.length} line items
                    <ChevronRight
                      className="ml-1 inline h-2.5 w-2.5 transition-transform [details[open]>summary>&]:rotate-90"
                      strokeWidth={1.85}
                      aria-hidden
                    />
                  </summary>
                  <ul className="mt-2 space-y-1 pl-2 text-[12.5px] text-[var(--text-secondary)]">
                    {inv.lines.data.map((l, i) => (
                      <li key={i} className="flex justify-between gap-3">
                        <span className="truncate">
                          {l.description ?? "Subscription"}
                        </span>
                        <span className="font-mono tabular-nums">
                          {formatMinor(l.amount, inv.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </li>
          );
        })}
      </ul>
      <footer className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_62%,transparent)] px-5 py-3">
        {/* §9.15 ChipCapsule for count + action paired affordance */}
        <ChipCapsule
          leftValue={invoices.length}
          leftLabel="INVOICES"
          rightVerb="VIEW ALL"
          href="/api/stripe/portal?return=cancel"
          tone="neutral"
        />
      </footer>
    </section>
  );
}
