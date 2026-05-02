import { describe, expect, it } from "vitest";

describe("time boundaries", () => {
  it("formats leap day in UTC without throwing", () => {
    const d = new Date(Date.UTC(2024, 1, 29, 12, 0, 0));
    expect(d.toISOString().startsWith("2024-02-29")).toBe(true);
  });

  it("handles millis beyond signed 32-bit in Date math", () => {
    const ms = 2_147_483_648;
    expect(new Date(ms).getTime()).toBe(ms);
  });
});
