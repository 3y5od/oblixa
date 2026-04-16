import { describe, expect, it } from "vitest";
import { resolveFeatureMappingForPagePath } from "@/lib/product-surface/v8-surface-mapping";

describe("metadata and crawler routes stay non-governed (§17.1)", () => {
  it("does not map sitemap, robots, or well-known paths to product feature families", () => {
    const paths = ["/sitemap.xml", "/robots.txt", "/.well-known/security.txt", "/opengraph-image"];
    for (const p of paths) {
      const m = resolveFeatureMappingForPagePath(p);
      expect(m.status === "unmapped" || m.status === "exempt", p).toBe(true);
      if (m.status === "mapped") {
        throw new Error(`unexpected mapped metadata path ${p}`);
      }
    }
  });
});
