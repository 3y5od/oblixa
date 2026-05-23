import { describe, expect, it } from "vitest";
import type { RoleCapability } from "@/lib/access-control";
import { hasRoleCapability } from "@/lib/access-control";
import type { OrgRole } from "@/lib/types";

/** Mirrors BASE_CAPABILITIES in access-control.ts — update both together. */
const BASE_CAPABILITIES: Record<OrgRole, RoleCapability[]> = {
  admin: [
    "contracts_edit",
    "approvals_manage",
    "renewals_manage",
    "maintenance_manage",
    "settings_manage",
  ],
  editor: ["contracts_edit", "approvals_manage", "renewals_manage"],
  viewer: [],
  ops_manager: ["contracts_edit", "renewals_manage", "maintenance_manage"],
  legal_reviewer: ["approvals_manage"],
  finance_reviewer: ["approvals_manage", "renewals_manage"],
  manager: ["contracts_edit", "approvals_manage", "renewals_manage", "maintenance_manage"],
};

const ALL_ROLES: OrgRole[] = [
  "admin",
  "editor",
  "viewer",
  "ops_manager",
  "legal_reviewer",
  "finance_reviewer",
  "manager",
];

const ALL_CAPS: RoleCapability[] = [
  "contracts_edit",
  "approvals_manage",
  "renewals_manage",
  "maintenance_manage",
  "settings_manage",
];

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

  it("null role never grants", () => {
    expect(hasRoleCapability({ role: null, capability: "contracts_edit" })).toBe(false);
  });

  it("unknown roles never grant", () => {
    expect(
      hasRoleCapability({
        role: "super_admin" as never,
        capability: "settings_manage",
      })
    ).toBe(false);
  });

  it("exhaustive baseline matrix matches BASE_CAPABILITIES", () => {
    for (const role of ALL_ROLES) {
      const allowed = new Set(BASE_CAPABILITIES[role] ?? []);
      for (const capability of ALL_CAPS) {
        expect(hasRoleCapability({ role, capability })).toBe(allowed.has(capability));
      }
    }
  });

  it("viewer has no baseline mutation capabilities", () => {
    for (const capability of ALL_CAPS) {
      expect(hasRoleCapability({ role: "viewer", capability })).toBe(false);
    }
  });

  it("override false revokes a baseline grant", () => {
    expect(
      hasRoleCapability({
        role: "admin",
        capability: "contracts_edit",
        rolePolicyJson: { admin: { contracts_edit: false } },
      })
    ).toBe(false);
  });
});
