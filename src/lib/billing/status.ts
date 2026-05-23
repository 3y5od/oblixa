import {
  AlertCircle,
  CheckCircle,
  PauseCircle,
  XCircle,
} from "lucide-react";
import type { ComponentType } from "react";
import type { SemanticStatus } from "@/components/ui/status-badge";
import { format } from "date-fns";

/**
 * Subscription-state → badge mapping. Per ui-design-principles §7.7
 * status badges pair tone with an icon for non-color reinforcement.
 *
 * SPEC: docs/billing-page-maximal-pass.md §6.1, §6.2, §6.4, §6.5, §6.6.
 */
export type SubscriptionStateBadge = {
  label: string;
  tone: SemanticStatus;
  icon: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  /**
   * Optional aria-label for screen readers explaining the state in
   * user terms (per §11.3).
   */
  srLabel?: string;
};

export type SubscriptionBadgeInput = {
  status: string;
  cancelAtPeriodEnd?: boolean | null;
  cancelAt?: number | null;
  pauseCollection?: { resumes_at?: number | null } | null;
  currentPeriodEnd?: number | null;
};

export function subscriptionStatusBadge(
  input: SubscriptionBadgeInput
): SubscriptionStateBadge {
  // Pause collection wins over status (Stripe sets sub.status = "active"
  // while pause_collection is non-null).
  if (input.pauseCollection) {
    return {
      label: "Paused",
      tone: "info",
      icon: PauseCircle,
      srLabel:
        "Subscription billing is paused. Resume to continue collection.",
    };
  }

  // Scheduled future-date cancellation (distinct from cancel_at_period_end).
  if (
    input.cancelAt &&
    input.currentPeriodEnd &&
    input.cancelAt > input.currentPeriodEnd
  ) {
    return {
      label: `Cancels ${format(new Date(input.cancelAt * 1000), "MMM d")}`,
      tone: "warning",
      icon: AlertCircle,
      srLabel: `Subscription is scheduled to cancel on ${format(new Date(input.cancelAt * 1000), "MMM d, yyyy")}.`,
    };
  }

  // cancel_at_period_end: still active but scheduled to end at period close.
  if (input.cancelAtPeriodEnd && input.currentPeriodEnd) {
    return {
      label: `Active (cancels ${format(new Date(input.currentPeriodEnd * 1000), "MMM d")})`,
      tone: "warning",
      icon: AlertCircle,
      srLabel: `Subscription is active but scheduled to cancel on ${format(new Date(input.currentPeriodEnd * 1000), "MMM d, yyyy")}.`,
    };
  }

  switch (input.status) {
    case "active":
      return {
        label: "Active",
        tone: "healthy",
        icon: CheckCircle,
        srLabel: "Subscription active.",
      };
    case "trialing":
      return {
        label: "Trial",
        tone: "info",
        icon: CheckCircle,
        srLabel:
          "Trial active. Convert to paid plan to retain access after trial ends.",
      };
    case "past_due":
      return {
        label: "Past due",
        tone: "warning",
        icon: AlertCircle,
        srLabel: "Payment failed. Update payment method to restore access.",
      };
    case "incomplete":
      return {
        label: "Incomplete",
        tone: "warning",
        icon: AlertCircle,
        srLabel: "Subscription incomplete. Resume checkout to activate.",
      };
    case "incomplete_expired":
      return {
        label: "Subscription expired",
        tone: "critical",
        icon: XCircle,
        srLabel:
          "Initial payment failed and the recovery window has elapsed. Start a new checkout.",
      };
    case "unpaid":
      return {
        label: "Unpaid",
        tone: "critical",
        icon: AlertCircle,
        srLabel: "Payment retries exhausted. Update payment method.",
      };
    case "canceled":
      return {
        label: "Canceled",
        tone: "critical",
        icon: XCircle,
        srLabel:
          "Subscription canceled. Access ends at the end of the current period.",
      };
    case "none":
    default:
      return {
        label: "Free plan",
        // Finishing-pass §1.9 + §1.12 — Per spec §10.2 "Status earns
        // color" + §2.11 zero-state pattern: Free is the baseline (not
        // an active risk/healthy/info state). Empty tone reads as
        // "intentional zero state" — the spec-faithful choice.
        tone: "empty",
        icon: CheckCircle,
        srLabel: "Workspace is on the free plan.",
      };
  }
}

/**
 * Trial-end edge cases. Per docs/billing-page-maximal-pass.md §7.3.
 * Computes a banner-friendly string from a Stripe `trial_end` epoch.
 */
export function formatTrialEnd(trialEnd: number): string {
  const now = Date.now();
  const target = trialEnd * 1000;
  const deltaMs = target - now;
  if (deltaMs <= 0) return "Ended";

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (deltaMs < hour) {
    const minutes = Math.max(1, Math.round(deltaMs / minute));
    return `Ends in ${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  if (deltaMs < day) return "Ends today";
  const days = Math.round(deltaMs / day);
  return `Ends in ${days} day${days === 1 ? "" : "s"}`;
}
