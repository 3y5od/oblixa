import { describe, expect, it } from "vitest";
import type {
  AdvancedNavModuleKey,
  AssuranceNavModuleKey,
  UtilityModuleKey,
} from "@/lib/product-surface/types";
import {
  WORKSPACE_SETTINGS_ADVANCED_MODULE_OPTIONS,
  WORKSPACE_SETTINGS_ASSURANCE_MODULE_OPTIONS,
  WORKSPACE_SETTINGS_UTILITY_MODULE_OPTIONS,
} from "@/lib/product-surface/workspace-settings-module-labels";

/** Keep in sync with `AdvancedNavModuleKey` — compile fails if union grows without updating this tuple. */
const ALL_ADVANCED: readonly AdvancedNavModuleKey[] = [
  "decisions",
  "campaigns",
  "programs",
  "relationships",
  "analytics",
  "maintenance",
  "collaboration",
  "compare_views",
] as const;

const ALL_ASSURANCE: readonly AssuranceNavModuleKey[] = [
  "findings",
  "control_policies",
  "scorecards",
  "playbooks",
  "autopilot",
  "review_boards",
  "segments",
  "program_evolution",
  "health_graph",
  "outcome_intelligence",
] as const;

const ALL_UTILITY: readonly UtilityModuleKey[] = [
  "intake",
  "data_quality",
  "review_cadence",
  "watchlists",
  "execution_graph",
  "approval_workload",
  "approval_sla_simulator",
  "more_tools",
] as const;

describe("workspace settings module option exhaustiveness (V7)", () => {
  it("lists every AdvancedNavModuleKey exactly once", () => {
    const keys = WORKSPACE_SETTINGS_ADVANCED_MODULE_OPTIONS.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of ALL_ADVANCED) {
      expect(keys, k).toContain(k);
    }
    expect(keys.length).toBe(ALL_ADVANCED.length);
  });

  it("lists every AssuranceNavModuleKey exactly once", () => {
    const keys = WORKSPACE_SETTINGS_ASSURANCE_MODULE_OPTIONS.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of ALL_ASSURANCE) {
      expect(keys, k).toContain(k);
    }
    expect(keys.length).toBe(ALL_ASSURANCE.length);
  });

  it("lists every UtilityModuleKey exactly once", () => {
    const keys = WORKSPACE_SETTINGS_UTILITY_MODULE_OPTIONS.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of ALL_UTILITY) {
      expect(keys, k).toContain(k);
    }
    expect(keys.length).toBe(ALL_UTILITY.length);
  });
});
