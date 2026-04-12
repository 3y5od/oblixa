import type { OrgRole } from "@/lib/types";
import type { RoleCapability } from "@/lib/access-control";

const ROLE_KEYS: readonly OrgRole[] = [
  "admin",
  "editor",
  "viewer",
  "ops_manager",
  "legal_reviewer",
  "finance_reviewer",
  "manager",
];

const CAPABILITY_KEYS: readonly RoleCapability[] = [
  "contracts_edit",
  "approvals_manage",
  "renewals_manage",
  "maintenance_manage",
  "settings_manage",
];

/** Pure helper: strip unknown roles/capabilities from workflow role policy JSON. */
export function sanitizeRolePolicyJson(input: Record<string, unknown>): Record<string, Record<string, boolean>> {
  const sanitized: Record<string, Record<string, boolean>> = {};
  for (const role of ROLE_KEYS) {
    const roleConfig = input[role];
    if (!roleConfig || typeof roleConfig !== "object" || Array.isArray(roleConfig)) continue;
    const source = roleConfig as Record<string, unknown>;
    const capabilityConfig: Record<string, boolean> = {};
    for (const capability of CAPABILITY_KEYS) {
      if (typeof source[capability] === "boolean") {
        capabilityConfig[capability] = source[capability] as boolean;
      }
    }
    if (Object.keys(capabilityConfig).length > 0) {
      sanitized[role] = capabilityConfig;
    }
  }
  return sanitized;
}
