import { describe, expect, it } from "vitest";
import { SITEMAP_PATHS } from "@/lib/marketing/public-paths";

/** Authenticated / app-shell segments that must never appear in the public sitemap. */
const SITEMAP_FORBIDDEN_FIRST_SEGMENTS = new Set([
  "dashboard",
  "contracts",
  "decisions",
  "campaigns",
  "assurance",
  "work",
  "reports",
  "settings",
  "relationship-workspaces",
  "accounts",
  "counterparties",
  "more",
  "external",
]);

describe("V7 SEO — sitemap stays marketing-only", () => {
  it("lists only paths outside authenticated dashboard top-level segments", () => {
    for (const path of SITEMAP_PATHS) {
      if (path === "/") continue;
      const first = path.split("/").filter(Boolean)[0];
      expect(first, path).toBeTruthy();
      expect(SITEMAP_FORBIDDEN_FIRST_SEGMENTS.has(first), `sitemap must not include ${path}`).toBe(
        false
      );
    }
  });
});
