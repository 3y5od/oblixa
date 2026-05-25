import { describe, expect, it } from "vitest";

/** Tier 82 — light format checks for common regulatory identifiers (not legal/tax advice). */
describe("regulatory id format hints", () => {
  it("LEI is 20 alphanumeric chars in canonical form (spot)", () => {
    const lei = "5493000IBP32UQZ0KL24";
    expect(lei).toMatch(/^[A-Z0-9]{20}$/i);
  });

  it("EIN (US) is 9 digits when stripped", () => {
    expect("12-3456789".replace(/-/g, "")).toMatch(/^\d{9}$/);
  });
});
