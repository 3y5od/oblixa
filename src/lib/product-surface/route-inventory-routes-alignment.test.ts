/**
 * product-surface policy §5–§6 / §10 — inventory tiers stay aligned with `routes.ts` mode floors.
 */
import { describe, expect, it } from "vitest";
import { ROUTE_INVENTORY } from "@/lib/product-surface/route-inventory";
import { minWorkspaceModeForPath } from "@/lib/product-surface/routes";

function examplePathForPattern(pattern: string): string {
  return pattern
    .replace(/\/\[id\]/g, "/00000000-0000-4000-8000-000000000001")
    .replace(/\/\[key\]/g, "/example-key");
}

describe("route inventory vs minWorkspaceModeForPath", () => {
  it("advanced-tier patterns require advanced mode in routes.ts", () => {
    for (const entry of ROUTE_INVENTORY) {
      if (entry.tier !== "advanced") continue;
      const ex = examplePathForPattern(entry.pattern);
      expect(minWorkspaceModeForPath(ex), entry.pattern).toBe("advanced");
    }
  });

  it("assurance-tier patterns require assurance mode in routes.ts", () => {
    for (const entry of ROUTE_INVENTORY) {
      if (entry.tier !== "assurance") continue;
      const ex = examplePathForPattern(entry.pattern);
      expect(minWorkspaceModeForPath(ex), entry.pattern).toBe("assurance");
    }
  });

  it("utility-tier patterns use non-assurance mode floors in routes.ts", () => {
    for (const entry of ROUTE_INVENTORY) {
      if (entry.tier !== "utility") continue;
      if (entry.pattern.includes("[")) continue;
      const minMode = minWorkspaceModeForPath(entry.pattern);
      expect(minMode, entry.pattern).toBeTruthy();
      expect(minMode, entry.pattern).not.toBe("assurance");
    }
  });
});
