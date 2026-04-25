import { describe, expect, it } from "vitest";
import { combineContractListIntersectIds } from "./contract-list-id-filters";

describe("contract list id filters (v9 §9.3)", () => {
  it("AND-combines id sets and treats empty as terminal", () => {
    expect(combineContractListIntersectIds([null, null])).toBeNull();
    expect(combineContractListIntersectIds([["a", "b"], null])).toEqual(["a", "b"]);
    expect(combineContractListIntersectIds([["a", "b"], ["b", "c"]])).toEqual(["b"]);
    expect(combineContractListIntersectIds([["a"], []])).toEqual([]);
  });
});
