import type { OrgRole } from "@/lib/types";

/**
 * Capability checks for mutations (separate from product nav visibility; docs/refinement.md §12.4).
 * §12.3 — Admin/assurance-style controls map to these capabilities + API `canManageCapability`; optional per-org
 * overrides live in `organization_workflow_settings.role_policy_json` (see settings operations + `v4/api-auth`).
 */
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

// Policy-aware check; `canEditContracts` in permissions.ts does NOT consult role_policy_json.
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
