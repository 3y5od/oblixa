import { describe, expect, it } from "vitest";

describe("validateWorkspaceModeBillingEligibility", () => {
  it("does not gate workspace product mode by explicit billing plan metadata", async () => {
    const { validateWorkspaceModeBillingEligibility } = await import("@/actions/workspace-mode-billing-eligibility");
    await expect(
      validateWorkspaceModeBillingEligibility({
        admin: {} as never,
        orgId: "org-1",
        mode: "assurance",
        prevSettings: { workspace_plan: "core" },
      })
    ).resolves.toBeNull();
  });

  it("does not require active Stripe subscription metadata when no explicit workspace plan is stored", async () => {
    const { validateWorkspaceModeBillingEligibility } = await import("@/actions/workspace-mode-billing-eligibility");
    await expect(
      validateWorkspaceModeBillingEligibility({
        admin: {} as never,
        orgId: "org-1",
        mode: "advanced",
        prevSettings: {},
      })
    ).resolves.toBeNull();
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