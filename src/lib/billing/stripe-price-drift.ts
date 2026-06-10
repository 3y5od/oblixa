import "server-only";

import {
  SPEC_ANNUAL_AMOUNT_MINOR,
  SPEC_MONTHLY_AMOUNT_MINOR,
} from "@/lib/billing/spec-prices";

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
        : `Annual price drift: expected cents ${SPEC_ANNUAL_AMOUNT_MINOR}, got cents ${input.amountMinor}`,
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
        : `Monthly price drift: expected cents ${SPEC_MONTHLY_AMOUNT_MINOR}, got cents ${input.amountMinor}`,
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
