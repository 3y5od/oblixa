// SPEC: docs/oblixa-release-state.md §"Billing, Pricing, And Cancellation" —
// the public Core offer is $249/month per workspace, month-to-month.
// This anchors the Stripe price in code so silent drift on the Stripe
// Dashboard can't change customer charges without code review.
// (Supersedes the earlier $299/mo + $249-billed-annually model in
//  docs/billing-page-maximal-pass.md §3.10; the release-state doc is the
//  authority and defines a single month-to-month offer.)
// The annual anchor is retained only as a drift guard should an annual
// Stripe price exist; the public release offer is month-to-month.

export const SPEC_ANNUAL_AMOUNT_MINOR = 298_800; // $2,988
export const SPEC_MONTHLY_AMOUNT_MINOR = 24_900; // $249

/**
 * Canonical public Core price label, e.g. "$249/month", derived from the
 * spec-mandated monthly amount. Product surfaces should format price copy from
 * this helper instead of hardcoding the amount, so the single source of truth
 * stays in this module.
 */
export function formatSpecMonthlyPriceLabel(): string {
  return `$${(SPEC_MONTHLY_AMOUNT_MINOR / 100).toLocaleString("en-US")}/month`;
}
