import { describe, expect, it } from "vitest";

const BLOCKED = new Set(["XX", "YY"]);

export function isCountryLoginBlocked(code: string | null | undefined): boolean {
  if (!code) return false;
  return BLOCKED.has(code.toUpperCase());
}

describe("sanctions geo block (mock list)", () => {
  it("blocks configured ISO codes only", () => {
    expect(isCountryLoginBlocked("xx")).toBe(true);
    expect(isCountryLoginBlocked("us")).toBe(false);
  });
});
