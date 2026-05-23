// SPEC: docs/billing-page-maximal-pass.md §3.10 — Stripe-config drift
// assertion. Per oblixa-release-state.md §Pricing:
//   Core Annual: $249/month billed annually ($2,988/year)
//   Core Monthly: $299/month
// Without anchoring at code, silent drift on the Stripe Dashboard
// would change customer charges without code review.

export const SPEC_ANNUAL_AMOUNT_MINOR = 298_800; // $2,988
export const SPEC_MONTHLY_AMOUNT_MINOR = 29_900; // $299

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
        ? "Monthly price matches spec ($299/month)"
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
