import { beforeEach, describe, expect, it, vi } from "vitest";

const orgHasActivePlan = vi.fn();

vi.mock("@/lib/plan", () => ({
  orgHasActivePlan: (...args: unknown[]) => orgHasActivePlan(...args),
}));

describe("validateWorkspaceModeBillingEligibility", () => {
  beforeEach(() => {
    orgHasActivePlan.mockReset();
    orgHasActivePlan.mockResolvedValue(true);
  });

  it("rejects when explicit billing plan is insufficient for the selected mode", async () => {
    const { validateWorkspaceModeBillingEligibility } = await import("@/actions/workspace-mode-billing-eligibility");
    await expect(
      validateWorkspaceModeBillingEligibility({
        admin: {} as never,
        orgId: "org-1",
        mode: "assurance",
        prevSettings: { workspace_plan: "core" },
      })
    ).resolves.toBe("Assurance mode is not included in the current workspace billing plan. Open Billing before saving this change.");
    expect(orgHasActivePlan).not.toHaveBeenCalled();
  });

  it("requires an active plan for non-core mode when no explicit workspace plan is stored", async () => {
    orgHasActivePlan.mockResolvedValue(false);
    const { validateWorkspaceModeBillingEligibility } = await import("@/actions/workspace-mode-billing-eligibility");
    await expect(
      validateWorkspaceModeBillingEligibility({
        admin: {} as never,
        orgId: "org-1",
        mode: "advanced",
        prevSettings: {},
      })
    ).resolves.toBe("Advanced mode requires an active billing plan. Open Billing before saving this change.");
    expect(orgHasActivePlan).toHaveBeenCalledWith({}, "org-1");
  });

  it("allows mode changes when billing requirements are satisfied", async () => {
    const { validateWorkspaceModeBillingEligibility } = await import("@/actions/workspace-mode-billing-eligibility");
    await expect(
      validateWorkspaceModeBillingEligibility({
        admin: {} as never,
        orgId: "org-1",
        mode: "advanced",
        prevSettings: { workspace_plan: "enterprise" },
      })
    ).resolves.toBeNull();
  });
});