import { describe, expect, it } from "vitest";
import {
  WORKSPACE_SETTINGS_ADVANCED_MODULE_OPTIONS,
  WORKSPACE_SETTINGS_ASSURANCE_MODULE_OPTIONS,
  WORKSPACE_SETTINGS_UTILITY_MODULE_OPTIONS,
} from "@/lib/product-surface/workspace-settings-module-labels";
import {
  ALL_ADVANCED_NAV_MODULE_KEYS,
  ALL_ASSURANCE_NAV_MODULE_KEYS,
  ALL_UTILITY_MODULE_KEYS,
} from "@/lib/product-surface/workspace-module-keys";

describe("workspace settings module option exhaustiveness (V7)", () => {
  it("lists every AdvancedNavModuleKey exactly once", () => {
    const keys = WORKSPACE_SETTINGS_ADVANCED_MODULE_OPTIONS.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of ALL_ADVANCED_NAV_MODULE_KEYS) {
      expect(keys, k).toContain(k);
    }
    expect(keys.length).toBe(ALL_ADVANCED_NAV_MODULE_KEYS.length);
  });

  it("lists every AssuranceNavModuleKey exactly once", () => {
    const keys = WORKSPACE_SETTINGS_ASSURANCE_MODULE_OPTIONS.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of ALL_ASSURANCE_NAV_MODULE_KEYS) {
      expect(keys, k).toContain(k);
    }
    expect(keys.length).toBe(ALL_ASSURANCE_NAV_MODULE_KEYS.length);
  });

  it("lists every UtilityModuleKey exactly once", () => {
    const keys = WORKSPACE_SETTINGS_UTILITY_MODULE_OPTIONS.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of ALL_UTILITY_MODULE_KEYS) {
      expect(keys, k).toContain(k);
    }
    expect(keys.length).toBe(ALL_UTILITY_MODULE_KEYS.length);
  });
});
