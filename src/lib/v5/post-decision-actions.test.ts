import { describe, expect, it } from "vitest";
import { suggestDefaultPostDecisionActions } from "./post-decision-actions";

describe("suggestDefaultPostDecisionActions", () => {
  it("returns empty without linked contracts", () => {
    expect(suggestDefaultPostDecisionActions("renewal", [])).toEqual([]);
  });

  it("suggests renewal follow-up", () => {
    const cid = "550e8400-e29b-41d4-a716-446655440000";
    const a = suggestDefaultPostDecisionActions("renewal", [cid]);
    expect(a).toHaveLength(1);
    expect(a[0].type).toBe("create_task");
    expect(a[0].contractId).toBe(cid);
  });
});
