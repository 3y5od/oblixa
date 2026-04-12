import { describe, expect, it } from "vitest";
import { SITEMAP_PATHS } from "@/lib/marketing/public-paths";

describe("SITEMAP_PATHS (security / crawler hygiene)", () => {
  it("does not list authenticated dashboard surfaces", () => {
    for (const p of SITEMAP_PATHS) {
      expect(p.startsWith("/dashboard"), p).toBe(false);
      expect(p.startsWith("/contracts"), p).toBe(false);
      expect(p.startsWith("/api/"), p).toBe(false);
      expect(p.startsWith("/settings"), p).toBe(false);
      expect(p.startsWith("/decisions"), p).toBe(false);
    }
  });
});
