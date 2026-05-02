import { describe, expect, it } from "vitest";

/** Bankers rounding to integer cents (Phase 32 pure helper). */
export function bankersRoundCents(amount: number): number {
  const scaled = amount * 100;
  const floor = Math.floor(scaled);
  const frac = scaled - floor;
  if (Math.abs(frac - 0.5) < 1e-9) {
    return floor % 2 === 0 ? floor : floor + 1;
  }
  return Math.round(scaled);
}

describe("billing cents rounding", () => {
  it("rounds halves to even", () => {
    expect(bankersRoundCents(0.125)).toBe(12);
    expect(bankersRoundCents(0.135)).toBe(14);
  });
});
