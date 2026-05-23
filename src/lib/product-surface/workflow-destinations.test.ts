import { describe, expect, it } from "vitest";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import {
  WORKFLOW_DESTINATIONS,
  assertNoForbiddenCoreWorkflowDestinationTerms,
  buildWorkflowDestinationManifest,
  listMoreJumpDestinations,
  listWorkflowDestinationsForSurface,
  resolveMorePageChrome,
  resolveWorkflowDestination,
  workflowDestinationForHref,
  type WorkflowDestinationSurface,
} from "@/lib/product-surface/workflow-destinations";

const KNOWN_FLAGS: FeatureFlagKey[] = [
  "v5DecisionFoundation",
  "v5PortfolioCampaigns",
  "v5SimulationAndIntelligence",
  "v5RelationshipLayer",
  "v5ExternalCollaboration",
  "v5ControlRoomUx",
  "v6AssuranceCore",
  "v6ControlPolicies",
  "v6AdaptivePlaybooks",
  "v6Autopilot",
  "v6OutcomeIntelligence",
  "v6ReviewBoards",
  "v6Segments",
];

const flagsOn = Object.fromEntries(KNOWN_FLAGS.map((key) => [key, true])) as Record<
  FeatureFlagKey,
  boolean
>;

function surface(input: Partial<WorkflowDestinationSurface> = {}): WorkflowDestinationSurface {
  return {
    mode: "core",
    role: "admin",
    featureFlags: flagsOn,
    advancedModulesHidden: [],
    assuranceModulesHidden: [],
    utilityModulesHidden: [],
    searchScope: "match_mode",
    ...input,
  };
}

describe("workflow destination content", () => {
  it("keeps destination keys and hrefs unique", () => {
    const keys = WORKFLOW_DESTINATIONS.map((d) => d.key);
    const hrefs = WORKFLOW_DESTINATIONS.map((d) => d.href);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("does not expose Advanced or Assurance vocabulary in Core-visible destination copy", () => {
    expect(assertNoForbiddenCoreWorkflowDestinationTerms()).toEqual([]);
  });

  it("resolves mode-specific More page chrome", () => {
    expect(resolveMorePageChrome(surface({ mode: "core" })).title).toBe("Essential tools");
    expect(resolveMorePageChrome(surface({ mode: "advanced" })).title).toBe("Portfolio tools");
    expect(resolveMorePageChrome(surface({ mode: "assurance" })).title).toBe("Assurance tools");
  });

  it("limits More jump destinations by mode and module visibility", () => {
    const coreKeys = listMoreJumpDestinations(surface({ mode: "core" })).map((d) => d.key);
    expect(coreKeys).toEqual([]);

    const advancedKeys = listMoreJumpDestinations(surface({ mode: "advanced" })).map((d) => d.key);
    expect(advancedKeys).toContain("programs");
    expect(advancedKeys).toContain("relationships");
    expect(advancedKeys).not.toContain("assurance");

    const hiddenRelationships = listMoreJumpDestinations(
      surface({ mode: "advanced", advancedModulesHidden: ["relationships"] })
    ).map((d) => d.key);
    expect(hiddenRelationships).not.toContain("relationships");
  });

  it("suppresses Assurance destinations when flags or modules are disabled", () => {
    const allowed = resolveWorkflowDestination(surface({ mode: "assurance" }), "control_policies");
    expect(allowed?.visible).toBe(true);

    const flagDisabled = resolveWorkflowDestination(
      surface({ mode: "assurance", featureFlags: { ...flagsOn, v6ControlPolicies: false } }),
      "control_policies"
    );
    expect(flagDisabled).toMatchObject({ visible: false, reason: "feature_flag" });

    const moduleHidden = resolveWorkflowDestination(
      surface({ mode: "assurance", assuranceModulesHidden: ["control_policies"] }),
      "control_policies"
    );
    expect(moduleHidden).toMatchObject({ visible: false, reason: "assurance_module_hidden" });
  });

  it("provides destination content for command/search placements", () => {
    const cmdk = listWorkflowDestinationsForSurface(surface({ mode: "assurance" }), {
      placements: ["cmdk"],
    });
    expect(cmdk.map((d) => d.key)).toContain("findings");
    expect(cmdk.every((d) => d.copy.label && d.copy.description)).toBe(true);
  });

  it("keeps Evidence available to Core child, command, and contextual placements", () => {
    const core = surface({ mode: "core" });
    for (const placement of ["nav_child", "cmdk", "contextual"] as const) {
      const keys = listWorkflowDestinationsForSurface(core, {
        placements: [placement],
      }).map((d) => d.key);
      expect(keys, placement).toContain("evidence");
    }
  });

  it("normalizes stale href labels through destination lookup", () => {
    expect(workflowDestinationForHref("/contracts/renewals?source=dashboard")?.key).toBe("renewals");
    expect(workflowDestinationForHref("/reports#outcome-intelligence")?.key).toBe(
      "outcome_intelligence"
    );
  });

  it("builds deterministic manifests without hidden destinations", () => {
    const first = buildWorkflowDestinationManifest(
      surface({ mode: "assurance", assuranceModulesHidden: ["autopilot"] })
    );
    const second = buildWorkflowDestinationManifest(
      surface({ mode: "assurance", assuranceModulesHidden: ["autopilot"] })
    );
    expect(second).toEqual(first);
    expect(first.map((d) => d.key)).not.toContain("autopilot");
    expect(first.every((d) => d.label && d.description && d.placements.length > 0)).toBe(true);
  });
});
