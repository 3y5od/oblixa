import { describe, expect, it } from "vitest";
import { cronMatchesUtc } from "@/lib/contract-operations/cron-schedule";

describe("cronMatchesUtc", () => {
  it("matches empty or null as always true", () => {
    expect(cronMatchesUtc(null, new Date())).toBe(true);
    expect(cronMatchesUtc("   ", new Date())).toBe(true);
  });

  it("matches wrong field count as true (default allow)", () => {
    expect(cronMatchesUtc("* * *", new Date())).toBe(true);
  });

  it("matches specific minute hour dom month", () => {
    const d = new Date(Date.UTC(2026, 0, 15, 14, 30, 0));
    expect(cronMatchesUtc("30 14 15 1 *", d)).toBe(true);
    expect(cronMatchesUtc("31 14 15 1 *", d)).toBe(false);
  });

  it("matches day-of-week with 7 as Sunday", () => {
    const sunday = new Date(Date.UTC(2026, 0, 11, 0, 0, 0));
    expect(sunday.getUTCDay()).toBe(0);
    expect(cronMatchesUtc("0 0 * * 0", sunday)).toBe(true);
    expect(cronMatchesUtc("0 0 * * 7", sunday)).toBe(true);
  });

  it("matches comma-separated lists", () => {
    const d = new Date(Date.UTC(2026, 0, 15, 10, 5, 0));
    expect(cronMatchesUtc("5,10 10 15 1 *", d)).toBe(true);
  });
});
