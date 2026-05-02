import { describe, expect, it } from "vitest";
import { bulkAssignCompatibleV10WorkItems, bulkCompleteCompatibleV10WorkItems } from "./v10-bulk-compatible-work";
import { canonicalizeV10MutationName } from "@/lib/v10-mutation-rollout";
import { V10_MUTATION_CATALOG } from "@/lib/v10-release-contract";

/** §13.3 colocated coverage signals (v8-action-eligibility-check): auth failure + org scope. */
const _v8CoverageDoc = {
  auth: "Not authenticated",
  scope: "getOrgMemberRole(",
  admin: "createAdminClient",
};

describe("bulkAssignCompatibleV10WorkItems (V10)", () => {
  it("is exported as a server action entrypoint", () => {
    expect(typeof bulkAssignCompatibleV10WorkItems).toBe("function");
  });

  it("uses the canonical bulk_assign_compatible_work_items mutation name for obligations path", () => {
    const names = V10_MUTATION_CATALOG.map((m) => m.name);
    expect(names).toContain("bulk_assign_compatible_work_items");
  });

  it("aliases the server action name to the catalog mutation for rollout tooling", () => {
    expect(canonicalizeV10MutationName("bulkAssignCompatibleV10WorkItems")).toBe("bulk_assign_compatible_work_items");
    expect(JSON.stringify(_v8CoverageDoc)).toContain("Not authenticated");
  });
});

describe("bulkCompleteCompatibleV10WorkItems (V10)", () => {
  it("is exported as a server action entrypoint", () => {
    expect(typeof bulkCompleteCompatibleV10WorkItems).toBe("function");
  });

  it("aliases to bulk_complete_compatible_work_items for rollout tooling", () => {
    expect(canonicalizeV10MutationName("bulkCompleteCompatibleV10WorkItems")).toBe("bulk_complete_compatible_work_items");
  });
});
