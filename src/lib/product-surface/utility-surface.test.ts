import { describe, expect, it } from "vitest";
import { minWorkspaceModeForPath } from "@/lib/product-surface/routes";
import { inventoryTierForPath } from "@/lib/product-surface/route-inventory";

/**
 * Utility routes are core-floor discoverable in registry/routing, while role/layout guards
 * still enforce access behavior for utility surfaces.
 */
describe("utility surface vs mode table", () => {
  it("marks data-quality as utility tier in route inventory", () => {
    expect(inventoryTierForPath("/contracts/data-quality")).toBe("utility");
  });

  it("assigns expected mode floors for utility paths in routes.ts", () => {
    expect(minWorkspaceModeForPath("/contracts/data-quality")).toBe("core");
    expect(minWorkspaceModeForPath("/contracts/maintenance")).toBe("advanced");
  });
});
