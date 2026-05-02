import { describe, expect, it } from "vitest";
import { formatCentsUsd, toCentsFromDecimalString } from "@/lib/money/integer-cents";

describe("integer-cents", () => {
  it("rounds half-up to cents", () => {
    expect(formatCentsUsd(toCentsFromDecimalString("10.005"))).toBe("10.01");
    expect(formatCentsUsd(toCentsFromDecimalString("10.004"))).toBe("10.00");
  });
});
