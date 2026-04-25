import { describe, expect, it } from "vitest";
import { GENERATED_ROUTE_STATES } from "../../../e2e/generated/route-states";
import { ROUTE_STATE_DYNAMIC_FIXTURES } from "../../../e2e/helpers/route-state-visit";

describe("ROUTE_STATE_DYNAMIC_FIXTURES sync", () => {
  it("covers every generated route with a dynamic segment", () => {
    const dynamicRoutes = new Set(
      GENERATED_ROUTE_STATES.map((e) => e.route).filter((r) => r.includes("["))
    );
    for (const r of dynamicRoutes) {
      expect(ROUTE_STATE_DYNAMIC_FIXTURES[r] ?? null, `Missing fixture for ${r}`).toBeTruthy();
    }
  });

  it("resolvePath returns concrete string for each fixture", () => {
    for (const p of Object.values(ROUTE_STATE_DYNAMIC_FIXTURES)) {
      expect(p).not.toMatch(/[\[\]]/);
      expect(p.startsWith("/")).toBe(true);
    }
  });
});
