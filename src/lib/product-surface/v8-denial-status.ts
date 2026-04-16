import type { V8EligibilityDenialClass } from "@/lib/product-surface/eligibility";

const DENIAL_STATUS_MAP: Record<V8EligibilityDenialClass, 401 | 403 | 404> = {
  unauthenticated: 401,
  unauthorized_role: 403,
  insufficient_workspace_mode: 404,
  hidden_by_module_config: 404,
  retired_feature: 404,
  experimental_deep_link_only_suppression: 404,
  registry_missing_or_mapping_missing: 404,
  org_context_unresolved: 403,
};

export function statusForEligibilityDenial(
  denialClass: V8EligibilityDenialClass | null | undefined,
  fallbackStatus: 403 | 404 = 403
): 401 | 403 | 404 {
  if (!denialClass) return fallbackStatus;
  return DENIAL_STATUS_MAP[denialClass] ?? fallbackStatus;
}

export function v8DenialStatusMatrix(): Record<V8EligibilityDenialClass, 401 | 403 | 404> {
  return { ...DENIAL_STATUS_MAP };
}
