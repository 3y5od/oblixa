import { describe, expect, it, vi } from "vitest";
import { routePolicyEnforcement } from "@/lib/v6/policy-enforcement-router";
import type { PolicyEvaluationResult } from "@/lib/v6/policy-evaluator";

function baseEval(overrides: Partial<PolicyEvaluationResult>): PolicyEvaluationResult {
  return {
    policy_id: "pol-1",
    policy_name: "Test policy",
    pass: false,
    enforcement_mode: "observe_only",
    remediation_playbook_id: null,
    evaluation_unit_key: "unit-1",
    breaches: [{ code: "B1", severity: "medium", detail: "x" }],
    scope: { label: "scope", contract_ids: [], assignment_id: null },
    policy_json: {} as PolicyEvaluationResult["policy_json"],
    version_payload: {} as PolicyEvaluationResult["version_payload"],
    ...overrides,
  } as PolicyEvaluationResult;
}

describe("routePolicyEnforcement", () => {
  it("returns empty actions when pass or no breaches", async () => {
    const admin = { from: vi.fn() };
    const r = await routePolicyEnforcement(admin as never, "org-1", baseEval({ pass: true }), {
      actorUserId: "u1",
    });
    expect(r.actions).toEqual([]);
  });

  it("observe_only records observe action only", async () => {
    const admin = { from: vi.fn() };
    const r = await routePolicyEnforcement(admin as never, "org-1", baseEval({ enforcement_mode: "observe_only" }), {
      actorUserId: "u1",
    });
    expect(r.actions.some((a) => a.kind === "observe_only")).toBe(true);
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("warn inserts finding event when findingId and actor present", async () => {
    const insert = vi.fn(async () => ({}));
    const admin = { from: vi.fn(() => ({ insert })) };
    const r = await routePolicyEnforcement(
      admin as never,
      "org-1",
      baseEval({ enforcement_mode: "warn" }),
      { findingId: "f1", actorUserId: "u1" }
    );
    expect(insert).toHaveBeenCalled();
    expect(r.actions.some((a) => a.kind === "warn")).toBe(true);
  });

  it("create_exception inserts exception row", async () => {
    const admin = {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({ data: { id: "ex-1" }, error: null })),
          })),
        })),
      })),
    };
    const r = await routePolicyEnforcement(
      admin as never,
      "org-1",
      baseEval({ enforcement_mode: "create_exception" }),
      { findingId: "f1", actorUserId: "u1" }
    );
    expect(admin.from).toHaveBeenCalledWith("exceptions");
    expect(r.actions.some((a) => a.kind === "exception")).toBe(true);
  });
});
