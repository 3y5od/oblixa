import { describe, expect, it } from "vitest";
import { NEW_WORKSPACE_V6_ORG_SETTINGS_JSON } from "@/lib/supabase/server";
import { parseWorkspaceMode } from "@/lib/product-surface/context";
import {
  ALL_ADVANCED_NAV_MODULE_KEYS,
  ALL_ASSURANCE_NAV_MODULE_KEYS,
} from "@/lib/product-surface/workspace-module-keys";

describe("NEW_WORKSPACE_V6_ORG_SETTINGS_JSON (refinement §13.1 / §17.1)", () => {
  it("defaults new workspaces to Core mode with autopilot execution off", () => {
    expect(parseWorkspaceMode(NEW_WORKSPACE_V6_ORG_SETTINGS_JSON)).toBe("core");
    expect(NEW_WORKSPACE_V6_ORG_SETTINGS_JSON.autopilot_allow_execution).not.toBe(true);
  });

  it("starts Core workspaces with every advanced and assurance family hidden", () => {
    expect(NEW_WORKSPACE_V6_ORG_SETTINGS_JSON.advanced_modules_hidden).toEqual([
      ...ALL_ADVANCED_NAV_MODULE_KEYS,
    ]);
    expect(NEW_WORKSPACE_V6_ORG_SETTINGS_JSON.assurance_modules_hidden).toEqual([
      ...ALL_ASSURANCE_NAV_MODULE_KEYS,
    ]);
  });
});
