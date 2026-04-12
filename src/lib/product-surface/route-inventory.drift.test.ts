import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROUTE_INVENTORY, coreDashboardPageRelPaths } from "@/lib/product-surface/route-inventory";

const dashboardRoot = join(process.cwd(), "src", "app", "(dashboard)");

describe("route-inventory drift", () => {
  it("every static inventory path has a page.tsx on disk", () => {
    const missing: string[] = [];
    for (const entry of ROUTE_INVENTORY) {
      if (entry.pattern.includes("[")) continue;
      const rel = `${entry.pattern.replace(/^\//, "")}/page.tsx`;
      const abs = join(dashboardRoot, rel);
      if (!existsSync(abs)) missing.push(rel);
    }
    expect(missing, `Missing pages:\n${missing.join("\n")}`).toEqual([]);
  });

  it("coreDashboardPageRelPaths files exist", () => {
    for (const rel of coreDashboardPageRelPaths()) {
      expect(existsSync(join(dashboardRoot, rel)), rel).toBe(true);
    }
  });
});
