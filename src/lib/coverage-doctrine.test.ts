import { describe, expect, it } from "vitest";
import { validateV10CoverageDimensionOwners, V10_COVERAGE_DIMENSION_OWNERS } from "./coverage-doctrine";

describe("v10-coverage-doctrine", () => {
  it("defines owner dimensions for maximal coverage doctrine", () => {
    expect(validateV10CoverageDimensionOwners()).toEqual([]);
    expect(V10_COVERAGE_DIMENSION_OWNERS.length).toBeGreaterThanOrEqual(6);
    const dims = V10_COVERAGE_DIMENSION_OWNERS.map((r) => r.dimension);
    expect(dims).toContain("product_surfaces");
    expect(dims).toContain("release");
  });
});
