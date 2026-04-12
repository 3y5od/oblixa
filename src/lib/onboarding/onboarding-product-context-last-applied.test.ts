import { describe, expect, it } from "vitest";
import { getFeatureFlags } from "@/lib/feature-flags";
import { buildProductSurfaceContext } from "@/lib/product-surface/context";
import type { V6OrgSettingsJson } from "@/lib/v6/org-settings";

const flags = getFeatureFlags();

describe("onboarding last_applied vs runtime surface (§3)", () => {
  it("buildProductSurfaceContext uses v6.workspace_mode, not last_applied.applied_workspace_mode", () => {
    const v6 = {
      workspace_mode: "advanced",
      search_scope: "match_mode",
      default_landing_path: "/dashboard",
      advanced_modules_hidden: [],
      assurance_modules_hidden: [],
      onboarding_calibration: {
        version: 2,
        blocking_required: false,
        status: "completed",
        last_applied: {
          applied_at: "2020-01-01T00:00:00.000Z",
          applied_by_user_id: "user-1",
          applied_workspace_mode: "core",
          advanced_modules_hidden: ["decisions"],
          assurance_modules_hidden: [],
          home_hidden_sections: [],
          search_scope: "core_only",
          default_landing_path: "/dashboard",
        },
      },
    } as unknown as V6OrgSettingsJson;

    const ctx = buildProductSurfaceContext({
      orgId: "org",
      role: "admin",
      v6,
      featureFlags: flags,
    });
    expect(ctx.mode).toBe("advanced");
    expect(ctx.searchScope).toBe("match_mode");
  });
});
