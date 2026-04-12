/**
 * docs/refinement.md §4.3 — visible product surface is narrower than implemented route footprint.
 */
import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "@/lib/navigation";
import { ROUTE_INVENTORY, type RouteInventoryTier } from "@/lib/product-surface/route-inventory";
import { REFINEMENT_CONTAINMENT_MECHANISMS } from "@/lib/product-surface/refinement-trace";

function tierCounts(): Record<RouteInventoryTier, number> {
  const out: Record<RouteInventoryTier, number> = {
    core: 0,
    advanced: 0,
    assurance: 0,
    utility: 0,
    edge: 0,
  };
  for (const e of ROUTE_INVENTORY) {
    out[e.tier] += 1;
  }
  return out;
}

describe("refinement §4.2 containment mechanisms", () => {
  it("documents four hiding/gating approaches from the spec", () => {
    expect(REFINEMENT_CONTAINMENT_MECHANISMS).toHaveLength(4);
  });
});

describe("refinement §4.3 visible product vs platform footprint", () => {
  it("keeps a materially wider inventory than Core-tier patterns alone", () => {
    const c = tierCounts();
    const nonCore = c.advanced + c.assurance + c.utility + c.edge;
    expect(c.core).toBeGreaterThan(5);
    expect(nonCore).toBeGreaterThanOrEqual(8);
    expect(c.core + nonCore).toBe(ROUTE_INVENTORY.length);
  });

  it("limits Core primary nav to the §7.1-style slice (fewer items than full inventory)", () => {
    const primarySlots = NAV_ITEMS.filter((i) => i.section === "primary").length;
    expect(ROUTE_INVENTORY.length).toBeGreaterThan(primarySlots);
  });
});
