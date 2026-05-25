import { describe, expect, it } from "vitest";
import { clampConfidence, toSafeString } from "@/lib/decision-intelligence/api";

describe("v5 api pure helpers", () => {
  it("toSafeString coerces nullish and trims", () => {
    expect(toSafeString(null)).toBe("");
    expect(toSafeString(undefined)).toBe("");
    expect(toSafeString("  x  ")).toBe("x");
    expect(toSafeString(42)).toBe("42");
  });

  it("clampConfidence clamps and rounds", () => {
    expect(clampConfidence("bad")).toBe(0);
    expect(clampConfidence(-1)).toBe(0);
    expect(clampConfidence(200)).toBe(100);
    expect(clampConfidence(12.3456)).toBe(12.35);
  });
});
