import type { OrgRole } from "@/lib/types";
import { normalizeWorkspaceRoleAlias, type CanonicalWorkspaceRole } from "@/lib/roles";

/**
 * Capability checks for mutations (separate from product nav visibility; product-surface policy §12.4).
 * §12.3 — Admin/assurance-style controls map to these capabilities + API `canManageCapability`; optional per-org
 * overrides live in `organization_workflow_settings.role_policy_json` (see settings operations + `v4/api-auth`).
 */
export type RoleCapability =
  | "contracts_edit"
  | "approvals_manage"
  | "renewals_manage"
  | "maintenance_manage"
  | "settings_manage";

const BASE_CAPABILITIES: Record<CanonicalWorkspaceRole, RoleCapability[]> = {
  owner: [
    "contracts_edit",
    "approvals_manage",
    "renewals_manage",
    "maintenance_manage",
    "settings_manage",
  ],
  admin: [
    "contracts_edit",
    "approvals_manage",
    "renewals_manage",
    "maintenance_manage",
    "settings_manage",
  ],
  member: ["contracts_edit", "approvals_manage", "renewals_manage"],
  viewer: [],
  operator: [],
};

// Policy-aware check; `canEditContracts` in permissions.ts does NOT consult role_policy_json.
export function hasRoleCapability(input: {
  role: OrgRole | null;
  capability: RoleCapability;
  rolePolicyJson?: Record<string, unknown> | null;
}): boolean {
  const canonicalRole = normalizeWorkspaceRoleAlias(input.role);
  if (!canonicalRole) return false;
  const base = new Set(BASE_CAPABILITIES[canonicalRole] ?? []);
  const overrides = (input.rolePolicyJson ?? {}) as Record<
    string,
    Record<string, boolean> | undefined
  >;
  const roleKey = typeof input.role === "string" ? input.role : "";
  const roleOverrides = (roleKey ? overrides[roleKey] : undefined) ?? overrides[canonicalRole];
  if (roleOverrides && typeof roleOverrides[input.capability] === "boolean") {
    if (input.capability === "settings_manage" && canonicalRole !== "owner" && canonicalRole !== "admin") {
      return false;
    }
    return Boolean(roleOverrides[input.capability]);
  }
  return base.has(input.capability);
}
