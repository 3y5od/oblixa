import { describe, expect, it } from "vitest";
import { DEADLINE_PRESET_VALUES, parseNoticeDays } from "@/lib/contract-filters";

describe("parseNoticeDays", () => {
  it("returns null for empty", () => {
    expect(parseNoticeDays(null)).toBe(null);
    expect(parseNoticeDays("   ")).toBe(null);
  });

  it("parses days variants", () => {
    expect(parseNoticeDays("60 days")).toBe(60);
    expect(parseNoticeDays("30 calendar days before renewal")).toBe(30);
  });

  it("parses weeks and months approximately", () => {
    expect(parseNoticeDays("2 weeks")).toBe(14);
    expect(parseNoticeDays("1 month")).toBe(30);
  });

  it("falls back to first digit run", () => {
    expect(parseNoticeDays("notice 45")).toBe(45);
  });

  it("returns null when no positive number", () => {
    expect(parseNoticeDays("no numbers here")).toBe(null);
  });
});

describe("DEADLINE_PRESET_VALUES", () => {
  it("has unique entries", () => {
    expect(new Set(DEADLINE_PRESET_VALUES).size).toBe(DEADLINE_PRESET_VALUES.length);
  });
});
