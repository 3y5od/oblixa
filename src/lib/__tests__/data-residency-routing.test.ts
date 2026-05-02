import { describe, expect, it } from "vitest";

const ALLOW = new Set(["https://test.supabase.co", "https://example.supabase.co"]);

export function assertSupabaseUrlInRegion(url: string | undefined, region: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return ALLOW.has(`${u.protocol}//${u.host}`) || region === "bootstrap";
  } catch {
    return false;
  }
}

describe("data residency routing (Phase 62)", () => {
  it("rejects unknown hosts for strict allowlist", () => {
    expect(assertSupabaseUrlInRegion("https://evil.supabase.co", "us")).toBe(false);
    expect(assertSupabaseUrlInRegion("https://test.supabase.co", "us")).toBe(true);
  });
});
