import { describe, expect, it } from "vitest";
import { NEW_WORKSPACE_V6_ORG_SETTINGS_JSON } from "@/lib/supabase/server";
import { parseWorkspaceMode } from "@/lib/product-surface/context";

describe("NEW_WORKSPACE_V6_ORG_SETTINGS_JSON (refinement §13.1 / §17.1)", () => {
  it("defaults new workspaces to Core mode with autopilot execution off", () => {
    expect(parseWorkspaceMode(NEW_WORKSPACE_V6_ORG_SETTINGS_JSON)).toBe("core");
    expect(NEW_WORKSPACE_V6_ORG_SETTINGS_JSON.autopilot_allow_execution).not.toBe(true);
  });
});
