import { describe, expect, it } from "vitest";
import { V9_APPLIES_TO, V9_DOES_NOT_REQUIRE } from "./compatibility-release-contract";

describe("V9 §3 scope constraints", () => {
  it("lists every positive scope bullet under V9 applies to", () => {
    expect(V9_APPLIES_TO.length).toBeGreaterThanOrEqual(16);
  });

  it("lists six negative constraints (does not require)", () => {
    expect(V9_DOES_NOT_REQUIRE).toEqual([
      "new product domains",
      "new top-level navigation areas",
      "new pricing structure",
      "broader public feature exposure",
      "new hidden platform families",
      "replacement of the existing architecture",
    ]);
  });
});
