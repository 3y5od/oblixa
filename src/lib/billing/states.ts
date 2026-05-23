import { SETTINGS_BILLING_STRINGS } from "@/lib/settings/spec-strings";

/**
 * Subscription states where the user can subscribe (first time) or
 * re-subscribe (after a billing hiccup). For these states, both spec
 * CTAs surface in the page-header actions slot.
 *
 * SPEC: docs/billing-page-maximal-pass.md §1.3 + §6.3.
 */
export const RECOVERABLE_SUBSCRIPTION_STATES: ReadonlySet<string> = new Set([
  "none",
  "past_due",
  "incomplete",
  "incomplete_expired",
  "unpaid",
  "canceled",
]);

/**
 * Placeholder sentinel values rendered as em-dash (`—`) per
 * ui-design-principles §10.12. Derived from the canonical spec-string
 * placeholders so renaming a placeholder copy doesn't silently break
 * the muting set.
 *
 * SPEC: docs/billing-page-maximal-pass.md §17.1, §1.26, §10.12.
 */
export const BILLING_PLACEHOLDER_VALUES: ReadonlySet<string> = new Set(
  Object.values(SETTINGS_BILLING_STRINGS.placeholders)
);

export function isBillingPlaceholder(value: unknown): value is string {
  return typeof value === "string" && BILLING_PLACEHOLDER_VALUES.has(value);
}
