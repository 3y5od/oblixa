import { describe, expect, it } from "vitest";

/** Pure scoring stub for chargeback / velocity heuristics when billing expands */
export function scoreFraudSignals(input: { failedPayments: number; velocityPerHour: number }): number {
  return input.failedPayments * 10 + Math.min(50, input.velocityPerHour);
}

describe("fraud scoring rules (pure)", () => {
  it("weights failed payments more than velocity", () => {
    expect(scoreFraudSignals({ failedPayments: 2, velocityPerHour: 5 })).toBe(25);
  });
});
