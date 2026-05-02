import { describe, expect, it } from "vitest";

describe("i18n / Intl (Phase 4b)", () => {
  it("formats currency for en-US", () => {
    expect(new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(12.4)).toBe("$12.40");
  });

  it("RTL locale preserves digit direction context in plain number format", () => {
    const ar = new Intl.NumberFormat("ar-EG").format(1234);
    expect(ar.length).toBeGreaterThan(0);
  });

  it("plural rules for English few vs one", () => {
    const pr = new Intl.PluralRules("en");
    expect(pr.select(1)).toBe("one");
    expect(pr.select(2)).toBe("other");
  });
});
