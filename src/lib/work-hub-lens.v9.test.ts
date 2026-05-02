import { describe, expect, it } from "vitest";
import { V9_WORK_HUB_LENS_VALUES, WORK_HUB_LENS_VALUES, parseWorkHubLens } from "./work-hub-lens";

describe("work hub lenses (v9 §12.2)", () => {
  it("parses lens query with safe default", () => {
    expect(parseWorkHubLens(undefined)).toBe("assigned");
    expect(parseWorkHubLens("")).toBe("assigned");
    expect(parseWorkHubLens("overdue")).toBe("overdue");
    expect(parseWorkHubLens("not-a-lens")).toBe("assigned");
  });

  it("enumerates five lenses", () => {
    expect(V9_WORK_HUB_LENS_VALUES).toHaveLength(5);
  });

  it("accepts each lens value as a /work?lens= query token (§12.2 URL contract)", () => {
    for (const v of WORK_HUB_LENS_VALUES) {
      expect(parseWorkHubLens(v)).toBe(v);
    }
  });
});
