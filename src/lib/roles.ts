import type { OrgRole } from "@/lib/types";

export type CanonicalWorkspaceRole = "owner" | "admin" | "member" | "viewer" | "operator";

export type WorkspaceRoleInput = OrgRole | "owner" | "member" | "operator" | string | null | undefined;

export const CANONICAL_WORKSPACE_ROLE_LABELS: Record<CanonicalWorkspaceRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
  operator: "Operator",
};

const MEMBER_ALIASES = new Set([
  "editor",
  "member",
  "manager",
  "ops_manager",
  "legal_reviewer",
  "finance_reviewer",
]);

export function normalizeWorkspaceRoleAlias(
  role: WorkspaceRoleInput,
  options: { isWorkspaceOwner?: boolean; isOperator?: boolean } = {}
): CanonicalWorkspaceRole | null {
  if (options.isOperator) return "operator";
  if (options.isWorkspaceOwner) return "owner";
  const normalized = typeof role === "string" ? role.trim().toLowerCase() : "";
  if (!normalized) return null;
  if (normalized === "owner") return "owner";
  if (normalized === "admin") return "admin";
  if (normalized === "viewer" || normalized === "read_only" || normalized === "readonly") {
    return "viewer";
  }
  if (normalized === "operator" || normalized === "support" || normalized === "service") {
    return "operator";
  }
  if (MEMBER_ALIASES.has(normalized)) return "member";
  return null;
}

export function isWorkspaceOwnerRole(
  role: WorkspaceRoleInput,
  options: { isWorkspaceOwner?: boolean } = {}
): boolean {
  return normalizeWorkspaceRoleAlias(role, options) === "owner";
}

export function isWorkspaceAdminRole(
  role: WorkspaceRoleInput,
  options: { isWorkspaceOwner?: boolean } = {}
): boolean {
  const canonical = normalizeWorkspaceRoleAlias(role, options);
  return canonical === "owner" || canonical === "admin";
}

export function canManageWorkspaceSettings(
  role: WorkspaceRoleInput,
  options: { isWorkspaceOwner?: boolean } = {}
): boolean {
  return isWorkspaceAdminRole(role, options);
}

export function canManageWorkspaceBilling(
  role: WorkspaceRoleInput,
  options: { isWorkspaceOwner?: boolean } = {}
): boolean {
  return isWorkspaceAdminRole(role, options);
}

export function canInviteWorkspaceMembers(
  role: WorkspaceRoleInput,
  options: { isWorkspaceOwner?: boolean } = {}
): boolean {
  return isWorkspaceAdminRole(role, options);
}

export function canMutateCoreWorkspaceRecords(role: WorkspaceRoleInput): boolean {
  const canonical = normalizeWorkspaceRoleAlias(role);
  return canonical === "owner" || canonical === "admin" || canonical === "member";
}

export function canDeleteCoreWorkspaceRecords(
  role: WorkspaceRoleInput,
  options: { isWorkspaceOwner?: boolean } = {}
): boolean {
  return isWorkspaceAdminRole(role, options);
}

export function canonicalRoleLabel(
  role: WorkspaceRoleInput,
  options: { isWorkspaceOwner?: boolean; fallback?: string } = {}
): string {
  const canonical = normalizeWorkspaceRoleAlias(role, options);
  return canonical ? CANONICAL_WORKSPACE_ROLE_LABELS[canonical] : options.fallback ?? "Unknown";
}
