import { describe, expect, it, vi } from "vitest";

import {
  countScheduledReportSubscriptionsSuppressedByModeChange,
  minimumPlanForWorkspaceMode,
  parseAdvancedNavRolesForPatch,
  parseAssuranceNavRolesForPatch,
  parseHiddenHomeSections,
  parseMode,
  parseSearchScope,
  resolveExplicitWorkspacePlan,
  workspaceModeRank,
} from "@/actions/product-surface-settings-helpers";

function queryResult<T>(result: T) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    then: (resolve: (value: T) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return query;
}

describe("product surface settings helper boundaries", () => {
  it("parses workspace mode settings without accepting unknown modes", () => {
    expect(parseMode("core")).toBe("core");
    expect(parseMode("advanced")).toBe("advanced");
    expect(parseMode("assurance")).toBe("assurance");
    expect(parseMode("enterprise")).toBeUndefined();
    expect(minimumPlanForWorkspaceMode("assurance")).toBe("assurance");
    expect(workspaceModeRank("advanced")).toBeLessThan(workspaceModeRank("assurance"));
  });

  it("normalizes role and home-section patches from explicit form controls only", () => {
    const formData = new FormData();
    formData.set("customize_advanced_nav_roles", "on");
    formData.set("adv_nav_admin", "on");
    formData.set("adv_nav_intruder", "on");
    formData.set("customize_assurance_nav_roles", "on");
    formData.set("asm_nav_viewer", "on");
    formData.set("hide_home_telemetry_compact", "on");
    formData.set("search_scope", "core_only");

    expect(parseAdvancedNavRolesForPatch(formData)).toEqual(["admin"]);
    expect(parseAssuranceNavRolesForPatch(formData, "assurance")).toEqual(["viewer"]);
    expect(parseAssuranceNavRolesForPatch(formData, "core")).toBeUndefined();
    expect(parseHiddenHomeSections(formData)).toEqual(["telemetry_compact"]);
    expect(parseSearchScope(formData)).toBe("core_only");
  });

  it("resolves only supported plan values from existing settings", () => {
    expect(resolveExplicitWorkspacePlan({ workspace_plan: "enterprise" })).toBe("enterprise");
    expect(resolveExplicitWorkspacePlan({ workspace_plan: "invalid", billing_plan: "advanced" })).toBeNull();
    expect(resolveExplicitWorkspacePlan({ billing_plan: "advanced" })).toBe("advanced");
    expect(resolveExplicitWorkspacePlan({ plan: "unknown" })).toBeNull();
  });

  it("does not query report packs when no active subscriptions exist", async () => {
    const activeSubscriptions = queryResult({ data: [], error: null });
    const admin = { from: vi.fn(() => activeSubscriptions) };

    const suppressed = await countScheduledReportSubscriptionsSuppressedByModeChange(
      admin as never,
      "org-1",
      "core"
    );

    expect(suppressed).toBe(0);
    expect(admin.from).toHaveBeenCalledTimes(1);
    expect(admin.from).toHaveBeenCalledWith("report_pack_subscriptions");
    expect(activeSubscriptions.eq).toHaveBeenCalledWith("organization_id", "org-1");
    expect(activeSubscriptions.eq).toHaveBeenCalledWith("active", true);
  });
});
