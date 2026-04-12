import { describe, expect, it } from "vitest";
import { displayLabelForFeature, type FeatureFamilyKey } from "@/lib/product-surface/feature-registry";
import {
  WORKSPACE_SETTINGS_ADVANCED_MODULE_OPTIONS,
  WORKSPACE_SETTINGS_ASSURANCE_MODULE_OPTIONS,
  WORKSPACE_SETTINGS_UTILITY_MODULE_OPTIONS,
} from "@/lib/product-surface/workspace-settings-module-labels";

const ADVANCED_LABEL_FEATURE: Record<
  (typeof WORKSPACE_SETTINGS_ADVANCED_MODULE_OPTIONS)[number]["key"],
  FeatureFamilyKey
> = {
  decisions: "decisions",
  campaigns: "campaigns",
  programs: "programs",
  relationships: "relationship_workspaces",
  analytics: "advanced_analytics",
  maintenance: "maintenance",
  collaboration: "collaboration",
  compare_views: "compare_views",
};

describe("workspace settings product labels vs registry", () => {
  it("keeps advanced module hide labels aligned with displayLabelForFeature", () => {
    for (const row of WORKSPACE_SETTINGS_ADVANCED_MODULE_OPTIONS) {
      const fk = ADVANCED_LABEL_FEATURE[row.key];
      expect(row.label, row.key).toBe(displayLabelForFeature(fk));
    }
  });

  it("keeps assurance module hide labels aligned with displayLabelForFeature", () => {
    for (const row of WORKSPACE_SETTINGS_ASSURANCE_MODULE_OPTIONS) {
      expect(row.label, row.key).toBe(displayLabelForFeature(row.key));
    }
  });

  it("keeps utility module hide labels aligned with displayLabelForFeature (more_tools suffix)", () => {
    for (const row of WORKSPACE_SETTINGS_UTILITY_MODULE_OPTIONS) {
      if (row.key === "more_tools") {
        expect(row.label).toBe(`${displayLabelForFeature("more_tools")} index`);
      } else {
        expect(row.label, row.key).toBe(displayLabelForFeature(row.key));
      }
    }
  });
});
