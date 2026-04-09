import type { OrgRole } from "@/lib/types";

export type RoleCapability =
  | "contracts_edit"
  | "approvals_manage"
  | "renewals_manage"
  | "maintenance_manage"
  | "settings_manage";

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

export function hasRoleCapability(input: {
  role: OrgRole | null;
  capability: RoleCapability;
  rolePolicyJson?: Record<string, unknown> | null;
}): boolean {
  if (!input.role) return false;
  const base = new Set(BASE_CAPABILITIES[input.role] ?? []);
  const overrides = (input.rolePolicyJson ?? {}) as Record<
    string,
    Record<string, boolean> | undefined
  >;
  const roleOverrides = overrides[input.role];
  if (roleOverrides && typeof roleOverrides[input.capability] === "boolean") {
    return Boolean(roleOverrides[input.capability]);
  }
  return base.has(input.capability);
}
