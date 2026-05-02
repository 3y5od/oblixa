import { describe, expect, it } from "vitest";
import { V10_IMPLEMENTATION_REQUIREMENTS } from "./v10-implementation-checklist";
import { V10_RELEASE_PRIORITY_TIERS } from "./v10-release-contract";

describe("V10 P2 branch scope decision", () => {
  it("keeps a single enumerated P2 requirement on this release branch (approval-gated automation)", () => {
    const p2 = V10_IMPLEMENTATION_REQUIREMENTS.filter((row) => row.priority === "P2");
    expect(p2.map((row) => row.id)).toEqual(["approval-gated-automation"]);
  });

  it("documents full P2 stretch backlog from release contract for out-of-branch tracking", () => {
    expect(V10_RELEASE_PRIORITY_TIERS.P2).toEqual([
      "additional_report_families",
      "additional_automation_playbooks",
      "additional_relationship_timeline_visualizations",
      "predictive_scoring",
      "custom_workspace_defined_work_item_types",
    ]);
  });
});
