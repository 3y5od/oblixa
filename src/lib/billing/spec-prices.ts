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

export type DriftCheck = {
  ok: boolean;
  expected: number;
  actual: number;
  interval: "year" | "month" | null;
  message: string;
};

/**
 * Returns a drift report comparing a Stripe price's minor-unit amount
 * to the spec-mandated value. Skips checks when interval is unknown.
 * Hide-by-default in production; surface in dev (env-gated).
 */
export function checkStripePriceDrift(input: {
  amountMinor: number | null | undefined;
  currency: string | null | undefined;
  interval: string | null | undefined;
}): DriftCheck | null {
  if (input.amountMinor == null || !input.currency || !input.interval) {
    return null;
  }
  if (input.currency.toLowerCase() !== "usd") return null;

  if (input.interval === "year") {
    const ok = input.amountMinor === SPEC_ANNUAL_AMOUNT_MINOR;
    return {
      ok,
      expected: SPEC_ANNUAL_AMOUNT_MINOR,
      actual: input.amountMinor,
      interval: "year",
      message: ok
        ? "Annual price matches spec ($2,988/year)"
        : `Annual price drift: expected ¢${SPEC_ANNUAL_AMOUNT_MINOR}, got ¢${input.amountMinor}`,
    };
  }
  if (input.interval === "month") {
    const ok = input.amountMinor === SPEC_MONTHLY_AMOUNT_MINOR;
    return {
      ok,
      expected: SPEC_MONTHLY_AMOUNT_MINOR,
      actual: input.amountMinor,
      interval: "month",
      message: ok
        ? "Monthly price matches spec ($249/month)"
        : `Monthly price drift: expected ¢${SPEC_MONTHLY_AMOUNT_MINOR}, got ¢${input.amountMinor}`,
    };
  }
  return null;
}

/**
 * Convenience: log a warning when drift is detected. Gated on env so
 * production stays quiet unless explicitly enabled.
 */
export function maybeWarnPriceDrift(drift: DriftCheck | null): void {
  if (
    drift &&
    !drift.ok &&
    process.env.STRIPE_CONFIG_DRIFT_ASSERT === "1"
  ) {
    console.warn(`[billing][price-drift] ${drift.message}`);
  }
}
