import {
  V10_PLAN_ORDER,
  V10_ROLE_ORDER,
  V10_WORKSPACE_MODE_ORDER,
  type V10Plan,
  type V10Role,
  type V10WorkspaceMode,
} from "./release-contract";

export type V10FilterableQuery = {
  eq(column: string, value: unknown): V10FilterableQuery;
  in?(column: string, values: readonly unknown[]): V10FilterableQuery;
};

export type V10VisibilityDenialReason =
  | "cross_org"
  | "hidden_visibility_state"
  | "insufficient_role"
  | "workspace_mode_hidden"
  | "plan_gated"
  | "module_hidden"
  | "inactive_owner"
  | "stale_owner"
  | "external_token_expired"
  | "external_token_revoked";

export type V10VisibilityDecision = {
  allowed: boolean;
  reason: "visible" | V10VisibilityDenialReason;
};

export type V10ReadModelVisibilityInput = {
  organizationId: string;
  rowOrganizationId: string | null | undefined;
  visibilityState?: string | null;
  requiredRoleMinimum?: string | null;
  workspaceMode?: string | null;
  currentRole?: string | null;
  currentWorkspaceMode?: string | null;
  planMinimum?: string | null;
  currentPlan?: string | null;
  moduleKey?: string | null;
  enabledModuleKeys?: readonly string[] | null;
  ownerState?: string | null;
  externalTokenState?: string | null;
};

function readableValues<T extends string>(ordered: readonly T[], current: string | null | undefined, fallback: T): T[] {
  const value = ordered.includes(current as T) ? (current as T) : fallback;
  const rank = ordered.indexOf(value);
  return ordered.slice(0, rank + 1);
}

export function getV10ReadableRoleMinimums(role: string | null | undefined): V10Role[] {
  return readableValues(V10_ROLE_ORDER, role, "viewer");
}

export function getV10ReadableWorkspaceModes(mode: string | null | undefined): V10WorkspaceMode[] {
  return readableValues(V10_WORKSPACE_MODE_ORDER, mode, "core");
}

export function getV10ReadablePlanMinimums(plan: string | null | undefined): V10Plan[] {
  return readableValues(V10_PLAN_ORDER, plan, "core");
}

export function evaluateV10ReadModelVisibility(input: V10ReadModelVisibilityInput): V10VisibilityDecision {
  if (input.rowOrganizationId !== input.organizationId) return { allowed: false, reason: "cross_org" };
  if ((input.visibilityState ?? "visible") !== "visible") return { allowed: false, reason: "hidden_visibility_state" };
  if (!getV10ReadableRoleMinimums(input.currentRole).includes((input.requiredRoleMinimum ?? "viewer") as V10Role)) {
    return { allowed: false, reason: "insufficient_role" };
  }
  if (!getV10ReadableWorkspaceModes(input.currentWorkspaceMode).includes((input.workspaceMode ?? "core") as V10WorkspaceMode)) {
    return { allowed: false, reason: "workspace_mode_hidden" };
  }
  if (input.planMinimum && !getV10ReadablePlanMinimums(input.currentPlan).includes(input.planMinimum as V10Plan)) {
    return { allowed: false, reason: "plan_gated" };
  }
  if (input.moduleKey && input.enabledModuleKeys && !input.enabledModuleKeys.includes(input.moduleKey)) {
    return { allowed: false, reason: "module_hidden" };
  }
  if (input.ownerState === "inactive") return { allowed: false, reason: "inactive_owner" };
  if (input.ownerState === "stale") return { allowed: false, reason: "stale_owner" };
  if (input.externalTokenState === "expired") return { allowed: false, reason: "external_token_expired" };
  if (input.externalTokenState === "revoked") return { allowed: false, reason: "external_token_revoked" };
  return { allowed: true, reason: "visible" };
}

export function applyV10ReadModelVisibility<TQuery>(
  query: TQuery,
  input: {
    organizationId: string;
    role: string | null | undefined;
    workspaceMode?: string | null;
    includeWorkspaceMode?: boolean;
  }
): TQuery {
  const original = query as V10FilterableQuery;
  let next: V10FilterableQuery = original
    .eq("organization_id", input.organizationId)
    .eq("visibility_state", "visible");
  if (typeof next.in === "function") {
    next = next.in("required_role_minimum", getV10ReadableRoleMinimums(input.role));
  }
  if (input.includeWorkspaceMode ?? true) {
    if (typeof next.in === "function") {
      next = next.in("workspace_mode", getV10ReadableWorkspaceModes(input.workspaceMode));
    }
  }
  return (typeof next.eq === "function" ? next : original) as TQuery;
}

export function applyV10CommandSearchVisibility<TQuery>(
  query: TQuery,
  input: {
    organizationId: string;
    role: string | null | undefined;
    workspaceMode: string | null | undefined;
    plan?: string | null;
  }
): TQuery {
  const original = query as V10FilterableQuery;
  let next: V10FilterableQuery = original
    .eq("organization_id", input.organizationId)
    .eq("visibility_state", "visible");
  if (typeof next.in === "function") {
    next = next.in("required_role_minimum", getV10ReadableRoleMinimums(input.role));
  }
  if (typeof next.in === "function") {
    next = next.in("workspace_mode_minimum", getV10ReadableWorkspaceModes(input.workspaceMode));
  }
  if (typeof next.in === "function") {
    next = next.in("plan_minimum", getV10ReadablePlanMinimums(input.plan));
  }
  return (typeof next.eq === "function" ? next : original) as TQuery;
}

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { applyV10CommandSearchVisibility as applyCommandSearchVisibility };
export { applyV10ReadModelVisibility as applyReadModelVisibility };
export { evaluateV10ReadModelVisibility as evaluateReadModelVisibility };
export { getV10ReadablePlanMinimums as getReadablePlanMinimums };
export { getV10ReadableRoleMinimums as getReadableRoleMinimums };
export { getV10ReadableWorkspaceModes as getReadableWorkspaceModes };
export type { V10FilterableQuery as FilterableQuery };
export type { V10ReadModelVisibilityInput as ReadModelVisibilityInput };
export type { V10VisibilityDecision as VisibilityDecision };
export type { V10VisibilityDenialReason as VisibilityDenialReason };
// End version-name compatibility aliases.
