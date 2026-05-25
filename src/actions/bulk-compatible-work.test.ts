import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { bulkAssignCompatibleV10WorkItems, bulkCompleteCompatibleV10WorkItems } from "./bulk-compatible-work";
import { canonicalizeV10MutationName } from "@/lib/mutation-rollout";
import { V10_MUTATION_CATALOG, V10_WORK_ITEM_TYPES } from "@/lib/release-contract";

const actionSource = readFileSync(new URL("./bulk-compatible-work.ts", import.meta.url), "utf8");
const helperSource = readFileSync(new URL("./bulk-compatible-work-helpers.ts", import.meta.url), "utf8");

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

  it("covers every non-specialized V10 work item type through the generic work-index path", () => {
    const genericTypes = V10_WORK_ITEM_TYPES.filter((type) => !["contract_task", "obligation"].includes(type));

    expect(genericTypes).toEqual([
      "field_review",
      "approval",
      "renewal_checkpoint",
      "exception",
      "evidence_request",
      "report_failure",
      "export_failure",
      "import_failure",
      "extraction_failure",
      "automation_approval",
      "unassigned_work",
    ]);
    expect(helperSource).toContain("V10_WORK_ITEM_TYPES.filter");
    expect(actionSource).toContain("./bulk-compatible-work-helpers");
    expect(actionSource).toContain("bulkAssignGenericV10WorkItems");
    expect(actionSource).not.toMatch(/not yet\s+implemented/);
  });
});

describe("bulkCompleteCompatibleV10WorkItems (V10)", () => {
  it("is exported as a server action entrypoint", () => {
    expect(typeof bulkCompleteCompatibleV10WorkItems).toBe("function");
  });

  it("aliases to bulk_complete_compatible_work_items for rollout tooling", () => {
    expect(canonicalizeV10MutationName("bulkCompleteCompatibleV10WorkItems")).toBe("bulk_complete_compatible_work_items");
  });

  it("uses generic completion for every V10 work item type not delegated to source-table handlers", () => {
    expect(actionSource.match(/isV10GenericBulkWorkItemType\(onlyType\)/g)).toHaveLength(2);
    expect(actionSource).toContain("bulkCompleteGenericV10WorkItems");
    expect(helperSource).toContain("No V10 work item completion changes were needed.");
    expect(actionSource).not.toMatch(/not yet\s+implemented/);
  });
});
