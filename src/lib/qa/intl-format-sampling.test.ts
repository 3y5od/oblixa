import { describe, expect, it } from "vitest";

/** Tier 47 — `Intl` helpers remain callable for numeric/date copy in dashboards. */
describe("Intl formatting smoke", () => {
  it("formats a percent and a date in en-US", () => {
    expect(new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 }).format(0.123)).toMatch(/%/);
    expect(new Intl.DateTimeFormat("en-US", { dateStyle: "short" }).format(new Date("2026-01-15T12:00:00Z"))).toMatch(/1/);
  });
});
