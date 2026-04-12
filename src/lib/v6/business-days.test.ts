import { describe, expect, it } from "vitest";
import {
  addBusinessDays,
  ownerlessBusinessDaysCutoffIso,
  subtractBusinessDays,
} from "@/lib/v6/business-days";

describe("business-days", () => {
  it("addBusinessDays returns same instant for non-positive count", () => {
    const t = new Date("2026-01-05T12:00:00.000Z");
    expect(addBusinessDays(t, 0).getTime()).toBe(t.getTime());
    expect(addBusinessDays(t, -3).getTime()).toBe(t.getTime());
  });

  it("addBusinessDays skips weekends", () => {
    const fri = new Date("2026-01-02T12:00:00.000Z");
    const out = addBusinessDays(fri, 1);
    expect(out.getUTCDay()).toBe(1);
  });

  it("subtractBusinessDays skips weekends", () => {
    const mon = new Date("2026-01-05T12:00:00.000Z");
    const out = subtractBusinessDays(mon, 1);
    expect(out.getUTCDate()).toBe(2);
  });

  it("ownerlessBusinessDaysCutoffIso returns valid ISO string", () => {
    const s = ownerlessBusinessDaysCutoffIso(3);
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Number.isFinite(Date.parse(s))).toBe(true);
  });
});
