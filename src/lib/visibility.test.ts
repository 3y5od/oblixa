import { describe, expect, it } from "vitest";
import {
  applyV10CommandSearchVisibility,
  applyV10ReadModelVisibility,
  evaluateV10ReadModelVisibility,
  getV10ReadablePlanMinimums,
  getV10ReadableRoleMinimums,
  getV10ReadableWorkspaceModes,
  type V10FilterableQuery,
} from "./visibility";
import { evaluateV10Eligibility } from "./governance";

function makeQuery() {
  const calls: Array<{ method: "eq" | "in"; column: string; value: unknown }> = [];
  const query: V10FilterableQuery & { calls: typeof calls } = {
    calls,
    eq(column, value) {
      calls.push({ method: "eq", column, value });
      return query;
    },
    in(column, value) {
      calls.push({ method: "in", column, value });
      return query;
    },
  };
  return query;
}

describe("V10 visibility filters", () => {
  it("derives readable role, mode, and plan minimums without widening access", () => {
    expect(getV10ReadableRoleMinimums("viewer")).toEqual(["viewer"]);
    expect(getV10ReadableRoleMinimums("ops_manager")).toEqual([
      "viewer",
      "legal_reviewer",
      "finance_reviewer",
      "editor",
      "ops_manager",
    ]);
    expect(getV10ReadableWorkspaceModes("assurance")).toEqual(["core", "advanced", "assurance"]);
    expect(getV10ReadablePlanMinimums("trial")).toEqual(["trial"]);
    expect(getV10ReadablePlanMinimums("unknown")).toEqual(["trial", "core"]);
  });

  it("keeps visibility and governance role ordering aligned", () => {
    expect(getV10ReadableRoleMinimums("legal_reviewer")).toEqual(["viewer", "legal_reviewer"]);
    expect(getV10ReadableRoleMinimums("finance_reviewer")).toEqual(["viewer", "legal_reviewer", "finance_reviewer"]);
    expect(
      evaluateV10Eligibility({
        workspaceMode: "core",
        requiredMode: "core",
        role: "legal_reviewer",
        requiredRole: "finance_reviewer",
        plan: "core",
        requiredPlan: "core",
      })
    ).toMatchObject({ allowed: false, outcome: "forbidden", reason: "role_required" });
    expect(
      evaluateV10Eligibility({
        workspaceMode: "core",
        requiredMode: "core",
        role: "finance_reviewer",
        requiredRole: "legal_reviewer",
        plan: "core",
        requiredPlan: "core",
      })
    ).toMatchObject({ allowed: true, outcome: "success" });
  });

  it("applies member-facing read-model filters for service-role UI reads", () => {
    const query = makeQuery();

    applyV10ReadModelVisibility(query, {
      organizationId: "org_1",
      role: "editor",
      workspaceMode: "advanced",
    });

    expect(query.calls).toEqual([
      { method: "eq", column: "organization_id", value: "org_1" },
      { method: "eq", column: "visibility_state", value: "visible" },
      { method: "in", column: "required_role_minimum", value: ["viewer", "legal_reviewer", "finance_reviewer", "editor"] },
      { method: "in", column: "workspace_mode", value: ["core", "advanced"] },
    ]);
  });

  it("applies command-search specific mode and plan filters", () => {
    const query = makeQuery();

    applyV10CommandSearchVisibility(query, {
      organizationId: "org_1",
      role: "admin",
      workspaceMode: "assurance",
      plan: "advanced",
    });

    expect(query.calls).toContainEqual({ method: "in", column: "workspace_mode_minimum", value: ["core", "advanced", "assurance"] });
    expect(query.calls).toContainEqual({ method: "in", column: "plan_minimum", value: ["trial", "core", "advanced"] });
  });

  it("returns non-enumerating denial reasons for V10 negative visibility cases", () => {
    const base = {
      organizationId: "org_1",
      rowOrganizationId: "org_1",
      visibilityState: "visible",
      requiredRoleMinimum: "viewer",
      workspaceMode: "core",
      currentRole: "admin",
      currentWorkspaceMode: "assurance",
      currentPlan: "enterprise",
    };

    expect(evaluateV10ReadModelVisibility(base)).toEqual({ allowed: true, reason: "visible" });
    expect(evaluateV10ReadModelVisibility({ ...base, rowOrganizationId: "org_2" }).reason).toBe("cross_org");
    expect(evaluateV10ReadModelVisibility({ ...base, visibilityState: "archived" }).reason).toBe("hidden_visibility_state");
    expect(evaluateV10ReadModelVisibility({ ...base, requiredRoleMinimum: "admin", currentRole: "viewer" }).reason).toBe("insufficient_role");
    expect(evaluateV10ReadModelVisibility({ ...base, workspaceMode: "assurance", currentWorkspaceMode: "core" }).reason).toBe("workspace_mode_hidden");
    expect(evaluateV10ReadModelVisibility({ ...base, planMinimum: "enterprise", currentPlan: "core" }).reason).toBe("plan_gated");
    expect(evaluateV10ReadModelVisibility({ ...base, moduleKey: "assurance", enabledModuleKeys: ["contracts"] }).reason).toBe("module_hidden");
    expect(evaluateV10ReadModelVisibility({ ...base, ownerState: "inactive" }).reason).toBe("inactive_owner");
    expect(evaluateV10ReadModelVisibility({ ...base, ownerState: "stale" }).reason).toBe("stale_owner");
    expect(evaluateV10ReadModelVisibility({ ...base, externalTokenState: "expired" }).reason).toBe("external_token_expired");
    expect(evaluateV10ReadModelVisibility({ ...base, externalTokenState: "revoked" }).reason).toBe("external_token_revoked");
  });
});
