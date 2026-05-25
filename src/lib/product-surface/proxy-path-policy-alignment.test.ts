import { describe, expect, it } from "vitest";
import { unauthenticatedAccessAllowed } from "@/lib/auth/proxy-path-policy";
import { SITEMAP_PATHS } from "@/lib/marketing/public-paths";
import { governedPageRootPrefixes } from "@/lib/product-surface/governed-prefixes";

describe("proxy unauthenticated allowlist vs governed dashboards (§12.1, §18.7)", () => {
  it("allows marketing and crawler surfaces enumerated for sitemap", () => {
    for (const p of SITEMAP_PATHS) {
      expect(unauthenticatedAccessAllowed(p), p).toBe(true);
    }
  });

  it("denies anonymous access to governed dashboard URL prefixes (session still required at proxy)", () => {
    expect(unauthenticatedAccessAllowed("/dashboard")).toBe(false);
    const prefixes = governedPageRootPrefixes();
    for (const prefix of prefixes) {
      const probe = prefix === "/more" ? "/more/extra" : `${prefix}/probe`;
      expect(unauthenticatedAccessAllowed(probe), probe).toBe(false);
    }
  });

  it("still allows /api/* so handlers own auth (AGENTS.md)", () => {
    expect(unauthenticatedAccessAllowed("/api/decisions")).toBe(true);
  });
});
