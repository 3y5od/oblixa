import { describe, expect, it } from "vitest";
import { hasRoleCapability } from "@/lib/access-control";

describe("hasRoleCapability", () => {
  it("applies baseline capabilities by role", () => {
    expect(
      hasRoleCapability({ role: "legal_reviewer", capability: "approvals_manage" })
    ).toBe(true);
    expect(
      hasRoleCapability({ role: "legal_reviewer", capability: "contracts_edit" })
    ).toBe(false);
  });

  it("allows role-policy overrides", () => {
    expect(
      hasRoleCapability({
        role: "ops_manager",
        capability: "approvals_manage",
        rolePolicyJson: { ops_manager: { approvals_manage: true } },
      })
    ).toBe(true);
  });
});
