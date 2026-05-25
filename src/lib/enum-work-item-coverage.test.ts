import { describe, expect, it } from "vitest";
import { V10_WORK_ITEM_TYPES } from "./release-contract";
import { validateV10FinalGapAudit } from "./final-gap-audit";

describe("V10 work item type surface coverage", () => {
  it("keeps every work item type represented in the work source action matrix", () => {
    expect(validateV10FinalGapAudit()).toEqual([]);
    expect(V10_WORK_ITEM_TYPES.length).toBe(13);
  });
});
