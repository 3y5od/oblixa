import "server-only";
import { format } from "date-fns";
import {
  CheckCircle,
  AlertCircle,
  Clock,
  RefreshCw,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { getStripeClient } from "@/lib/stripe";

// SPEC: docs/billing-page-maximal-pass.md §9.16 + §9.24 — subscription
// activity feed. Maps Stripe events to canonical caps verbs per
// ui-design-principles §8.5 activity-feed pattern.

type Verb =
  | "STARTED"
  | "PAID"
  | "FAILED"
  | "UPDATED"
  | "CONVERTED"
  | "CANCEL SCHEDULED"
  | "PLAN CHANGED"
  | "PAYMENT METHOD UPDATED"
  | "TRIAL ENDING"
  | "CANCELED"
  | "PAUSED"
  | "RESUMED"
  | "REFUNDED";

type FeedRow = {
  verb: Verb;
  detail: string;
  at: number;
  icon: LucideIcon;
  tone: string;
};

// SPEC: §9.24 — `previous_attributes` parser for `*.updated` events
function detailFromUpdate(
  current: Record<string, unknown>,
  prev: Record<string, unknown>
): { verb: Verb; detail: string } | null {
  if (
    "cancel_at_period_end" in prev &&
    prev.cancel_at_period_end === false &&
    current.cancel_at_period_end === true
  ) {
    const periodEnd =
      typeof current.current_period_end === "number"
        ? current.current_period_end
        : null;
    return {
      verb: "CANCEL SCHEDULED",
      detail: periodEnd
        ? `for ${format(new Date(periodEnd * 1000), "MMM d, yyyy")}`
        : "at period end",
    };
  }
  if (
    "status" in prev &&
    prev.status === "trialing" &&
    current.status === "active"
  ) {
    return { verb: "CONVERTED", detail: "to paid plan" };
  }
  if (
    "items" in prev &&
    typeof prev.items === "object" &&
    prev.items !== null
  ) {
    // Plan-change typically surfaces as items diff.
    return { verb: "PLAN CHANGED", detail: "subscription items updated" };
  }
  if ("default_payment_method" in prev) {
    return { verb: "PAYMENT METHOD UPDATED", detail: "card on file" };
  }
  return null;
}

const VERB_VISUALS: Record<Verb, { icon: LucideIcon; tone: string }> = {
  STARTED: { icon: CheckCircle, tone: "var(--success-ink)" },
  PAID: { icon: CheckCircle, tone: "var(--success-ink)" },
  FAILED: { icon: AlertCircle, tone: "var(--danger-ink)" },
  UPDATED: { icon: RefreshCw, tone: "var(--text-secondary)" },
  CONVERTED: { icon: CheckCircle, tone: "var(--success-ink)" },
  "CANCEL SCHEDULED": { icon: Clock, tone: "var(--warning-ink)" },
  "PLAN CHANGED": { icon: RefreshCw, tone: "var(--accent-strong)" },
  "PAYMENT METHOD UPDATED": { icon: RefreshCw, tone: "var(--text-secondary)" },
  "TRIAL ENDING": { icon: Clock, tone: "var(--warning-ink)" },
  CANCELED: { icon: XCircle, tone: "var(--danger-ink)" },
  PAUSED: { icon: Clock, tone: "var(--text-secondary)" },
  RESUMED: { icon: CheckCircle, tone: "var(--success-ink)" },
  REFUNDED: { icon: RefreshCw, tone: "var(--text-secondary)" },
};

function mapEventToRow(
  event: { type: string; created: number; data: { object: unknown; previous_attributes?: unknown } }
): FeedRow | null {
  const obj = (event.data.object ?? {}) as Record<string, unknown>;
  const prev = (event.data.previous_attributes ?? {}) as Record<string, unknown>;
  let mapped: { verb: Verb; detail: string } | null = null;

  switch (event.type) {
    case "customer.subscription.created":
      mapped = { verb: "STARTED", detail: "Annual plan" };
      break;
    case "invoice.paid":
      mapped = {
        verb: "PAID",
        detail:
          typeof obj.amount_paid === "number"
            ? `${(obj.amount_paid / 100).toFixed(2)} ${typeof obj.currency === "string" ? obj.currency.toUpperCase() : ""}`
            : "Subscription invoice",
      };
      break;
    case "invoice.payment_failed":
      mapped = { verb: "FAILED", detail: "Card declined" };
      break;
    case "customer.subscription.updated":
      mapped = detailFromUpdate(obj, prev) ?? {
        verb: "UPDATED",
        detail: "Subscription details",
      };
      break;
    case "customer.subscription.trial_will_end":
      mapped = { verb: "TRIAL ENDING", detail: "In ~3 days" };
      break;
    case "customer.subscription.deleted":
      mapped = { verb: "CANCELED", detail: "Subscription ended" };
      break;
    case "customer.subscription.paused":
      mapped = { verb: "PAUSED", detail: "Billing paused" };
      break;
    case "customer.subscription.resumed":
      mapped = { verb: "RESUMED", detail: "Billing resumed" };
      break;
    case "charge.refunded":
      mapped = { verb: "REFUNDED", detail: "Charge refunded" };
      break;
    default:
      return null;
  }

  const visuals = VERB_VISUALS[mapped.verb];
  return {
    verb: mapped.verb,
    detail: mapped.detail,
    at: event.created,
    icon: visuals.icon,
    tone: visuals.tone,
  };
}

export async function BillingActivityFeed({
  customerId,
}: {
  customerId: string | null;
}) {
  if (!customerId) return null;
  const stripeClient = await getStripeClient();
  if (!stripeClient.ok) return null;

  let events: Array<{ type: string; created: number; data: { object: unknown; previous_attributes?: unknown } }>;
  try {
    const list = await stripeClient.stripe.events.list({
      // Stripe events API doesn't allow filtering by related object via
      // a single param here; fetch a recent batch and filter client-side.
      types: [
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
        "customer.subscription.paused",
        "customer.subscription.resumed",
        "customer.subscription.trial_will_end",
        "invoice.paid",
        "invoice.payment_failed",
        "charge.refunded",
      ],
      limit: 20,
    });
    events = list.data.filter((e) => {
      const o = (e.data.object ?? {}) as { customer?: string };
      return o.customer === customerId;
    });
  } catch (err) {
    // SPEC: §15.11 log requestId
    const se = err as { requestId?: string; code?: string };
    console.error("[BillingActivityFeed]", err instanceof Error ? err.message : err, {
      requestId: se.requestId,
      code: se.code,
    });
    return null;
  }

  const rows = events
    .map(mapEventToRow)
    .filter((r): r is FeedRow => r !== null)
    .slice(0, 5);

  if (rows.length === 0) return null;

  return (
    <section className="ui-card p-0" aria-labelledby="billing-activity-title">
      <header className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] px-5 py-4">
        <p className="ui-caps-1 text-[var(--accent-strong)]">Activity</p>
        <h2
          id="billing-activity-title"
          className="mt-1 text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)] sm:text-[1.4rem]"
        >
          Recent billing activity
        </h2>
      </header>
      <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_62%,transparent)]">
        {rows.map((row, idx) => {
          const Icon = row.icon;
          return (
            <li key={idx} className="px-5 py-3">
              <div className="grid grid-cols-[16px_minmax(0,1fr)_auto] items-baseline gap-2.5">
                <Icon
                  className="h-3.5 w-3.5 self-center"
                  strokeWidth={1.85}
                  style={{ color: row.tone }}
                  aria-hidden
                />
                <p className="inline-flex items-baseline gap-1.5 truncate text-[10.5px] uppercase tracking-[0.12em] leading-tight">
                  <span className="font-semibold" style={{ color: row.tone }}>
                    {row.verb}
                  </span>
                  <span className="text-[var(--text-secondary)] normal-case tracking-normal text-[12.5px]">
                    {row.detail}
                  </span>
                </p>
                <time
                  className="font-mono text-[10.5px] tabular-nums text-[var(--text-tertiary)]"
                  dateTime={new Date(row.at * 1000).toISOString()}
                  aria-label={format(
                    new Date(row.at * 1000),
                    "MMM d, yyyy 'at' h:mm a"
                  )}
                >
                  {format(new Date(row.at * 1000), "MMM d")}
                </time>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
