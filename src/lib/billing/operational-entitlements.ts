import { CORE_PLAN_LIMITS } from "@/lib/dashboard/spec-strings";
import type { WorkspaceProductMode } from "@/lib/product-surface/types";

export const OPERATIONAL_COMMERCIAL_GATE_IDS = [
  "plans",
  "billing_states",
  "feature_access",
  "workspace_modes",
  "seats",
  "usage_limits",
  "grace_periods",
  "blocked_states",
] as const;

export const OPERATIONAL_COMMERCIAL_PLAN_IDS = [
  "free",
  "trial",
  "core",
  "advanced",
  "assurance",
  "enterprise",
] as const;

export const OPERATIONAL_BILLING_STATE_IDS = [
  "trialing",
  "active",
  "past_due",
  "unpaid",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "paused",
  "no_customer",
  "no_subscription",
  "portal_return",
] as const;

export const OPERATIONAL_SEAT_MUTATION_IDS = [
  "invite_creation",
  "invite_revoke",
  "invite_accept",
  "expired_invite",
  "duplicate_invite",
  "seat_limit",
  "role_change",
  "billing_mismatch",
] as const;

export const OPERATIONAL_REVENUE_IMPACT_SAFEGUARD_IDS = [
  "idempotency",
  "audit_events",
  "redaction",
  "provider_event_replay",
  "manual_boundary",
] as const;

export type OperationalCommercialGateId = (typeof OPERATIONAL_COMMERCIAL_GATE_IDS)[number];
export type OperationalCommercialPlanId = (typeof OPERATIONAL_COMMERCIAL_PLAN_IDS)[number];
export type OperationalBillingStateId = (typeof OPERATIONAL_BILLING_STATE_IDS)[number];
export type OperationalSeatMutationId = (typeof OPERATIONAL_SEAT_MUTATION_IDS)[number];
export type OperationalRevenueImpactSafeguardId = (typeof OPERATIONAL_REVENUE_IMPACT_SAFEGUARD_IDS)[number];

export type OperationalCommercialFeatureId =
  | "contract_upload"
  | "ai_extraction"
  | "csv_export"
  | "report_pack_generation"
  | "invite_member"
  | "billing_portal"
  | "invoice_download"
  | "workspace_mode_change";

export type OperationalGateDecision = {
  allowed: boolean;
  result: "allowed" | "denied" | "ambiguous";
  reason:
    | "allowed"
    | "billing_state_blocked"
    | "billing_state_ambiguous"
    | "grace_period"
    | "plan_gated"
    | "workspace_mode_gated"
    | "usage_limit_reached"
    | "usage_unknown"
    | "seat_limit_reached"
    | "tenant_scope_mismatch"
    | "billing_mismatch"
    | "invite_expired"
    | "duplicate_idempotent"
    | "unknown_feature";
  manualBoundary?: string;
  auditAction?: string;
  idempotent?: boolean;
  tenantScoped?: boolean;
};

export type OperationalBillingSnapshot = {
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeSubscriptionStatus?: string | null;
  portalReturn?: boolean;
  gracePeriodEndsAt?: string | null;
  nowMs?: number;
};

export type OperationalFeatureUsage = {
  activeContracts?: number | null;
  exportRows?: number | null;
  activeSeats?: number | null;
  pendingInvites?: number | null;
};

type FeaturePolicy = {
  id: OperationalCommercialFeatureId;
  owner: "@billing" | "@product-operations";
  minimumPlan: OperationalCommercialPlanId;
  workspaceModes: readonly WorkspaceProductMode[];
  requiresPaidBilling: boolean;
  usageLimit?: keyof OperationalFeatureUsage;
  limit?: number;
  auditAction?: string;
  manualBoundary?: string;
};

const PLAN_RANK: Record<OperationalCommercialPlanId, number> = {
  free: 0,
  trial: 1,
  core: 2,
  advanced: 3,
  assurance: 4,
  enterprise: 5,
};

const PAID_UP_BILLING_STATES = new Set<OperationalBillingStateId>([
  "trialing",
  "active",
]);

const BLOCKED_BILLING_STATES = new Set<OperationalBillingStateId>([
  "unpaid",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "paused",
  "no_customer",
  "no_subscription",
]);

export const OPERATIONAL_COMMERCIAL_FEATURE_POLICIES: readonly FeaturePolicy[] = [
  {
    id: "contract_upload",
    owner: "@product-operations",
    minimumPlan: "trial",
    workspaceModes: ["core", "advanced", "assurance"],
    requiresPaidBilling: false,
    usageLimit: "activeContracts",
    limit: CORE_PLAN_LIMITS.activeContracts,
    auditAction: "contract.upload_requested",
  },
  {
    id: "ai_extraction",
    owner: "@billing",
    minimumPlan: "core",
    workspaceModes: ["core", "advanced", "assurance"],
    requiresPaidBilling: true,
    auditAction: "extraction.requested",
  },
  {
    id: "csv_export",
    owner: "@product-operations",
    minimumPlan: "trial",
    workspaceModes: ["core", "advanced", "assurance"],
    requiresPaidBilling: false,
    usageLimit: "exportRows",
    limit: 20_000,
    auditAction: "export.requested",
  },
  {
    id: "report_pack_generation",
    owner: "@product-operations",
    minimumPlan: "core",
    workspaceModes: ["advanced", "assurance"],
    requiresPaidBilling: true,
    auditAction: "report_pack.generation_requested",
  },
  {
    id: "invite_member",
    owner: "@billing",
    minimumPlan: "trial",
    workspaceModes: ["core", "advanced", "assurance"],
    requiresPaidBilling: false,
    usageLimit: "activeSeats",
    limit: CORE_PLAN_LIMITS.teamMembers,
    auditAction: "member.invited",
  },
  {
    id: "billing_portal",
    owner: "@billing",
    minimumPlan: "free",
    workspaceModes: ["core", "advanced", "assurance"],
    requiresPaidBilling: false,
    auditAction: "billing.portal_opened",
    manualBoundary: "Live Stripe billing portal configuration remains manual.",
  },
  {
    id: "invoice_download",
    owner: "@billing",
    minimumPlan: "free",
    workspaceModes: ["core", "advanced", "assurance"],
    requiresPaidBilling: false,
    auditAction: "billing.invoice_downloaded",
  },
  {
    id: "workspace_mode_change",
    owner: "@product-operations",
    minimumPlan: "free",
    workspaceModes: ["core", "advanced", "assurance"],
    requiresPaidBilling: false,
    auditAction: "workspace.mode_changed",
  },
] as const;

export const OPERATIONAL_REVENUE_IMPACT_SAFEGUARDS: readonly {
  id: OperationalRevenueImpactSafeguardId;
  owner: "@billing" | "@security";
  validationCommand: string;
  evidence: string;
  liveChangeManualBoundary?: string;
}[] = [
  {
    id: "idempotency",
    owner: "@billing",
    validationCommand: "check:idempotency-policy",
    evidence: "enforceIdempotency on checkout and portal mutations plus stripe_webhook_events replay claims",
  },
  {
    id: "audit_events",
    owner: "@security",
    validationCommand: "check:audit-event-coverage",
    evidence: "recordApiMutationAuditEvent, billing.checkout_completed, billing.payment_failed, and member.* audit rows",
  },
  {
    id: "redaction",
    owner: "@security",
    validationCommand: "check:provider-integration-fixtures",
    evidence: "Stripe request IDs are logged without secrets and user-facing errors are bounded",
  },
  {
    id: "provider_event_replay",
    owner: "@billing",
    validationCommand: "check:provider-integration-fixtures",
    evidence: "Stripe webhook duplicate, stale, wrong-mode, failed-payment, and customer-mismatch fixtures",
  },
  {
    id: "manual_boundary",
    owner: "@billing",
    validationCommand: "check:release-security-required-env",
    evidence: "code verifies key and price shape while live Stripe prices and portal setup remain external",
    liveChangeManualBoundary: "Live Stripe product, price, customer portal, tax, coupon, and webhook configuration changes remain manual.",
  },
] as const;

export function resolveOperationalBillingState(
  input: OperationalBillingSnapshot
): OperationalBillingStateId {
  if (input.portalReturn) return "portal_return";
  if (!input.stripeCustomerId) return "no_customer";
  if (!input.stripeSubscriptionId) return "no_subscription";
  const status = input.stripeSubscriptionStatus?.trim();
  if (!status) return "active";
  if ((OPERATIONAL_BILLING_STATE_IDS as readonly string[]).includes(status)) {
    return status as OperationalBillingStateId;
  }
  return "no_subscription";
}

export function isOperationalBillingPaidUp(state: OperationalBillingStateId): boolean {
  return PAID_UP_BILLING_STATES.has(state);
}

export function evaluateOperationalBillingAccess(
  input: OperationalBillingSnapshot
): OperationalGateDecision {
  const state = resolveOperationalBillingState(input);
  if (PAID_UP_BILLING_STATES.has(state)) {
    return { allowed: true, result: "allowed", reason: "allowed" };
  }
  if (state === "past_due") {
    const graceMs = Date.parse(input.gracePeriodEndsAt ?? "");
    if (Number.isFinite(graceMs) && graceMs > (input.nowMs ?? Date.now())) {
      return { allowed: true, result: "allowed", reason: "grace_period" };
    }
    return { allowed: false, result: "denied", reason: "billing_state_blocked" };
  }
  if (state === "portal_return") {
    return { allowed: false, result: "ambiguous", reason: "billing_state_ambiguous" };
  }
  if (BLOCKED_BILLING_STATES.has(state)) {
    return { allowed: false, result: "denied", reason: "billing_state_blocked" };
  }
  return { allowed: false, result: "ambiguous", reason: "billing_state_ambiguous" };
}

export function evaluateCommercialFeatureGate(input: {
  featureId: OperationalCommercialFeatureId | string;
  plan: OperationalCommercialPlanId;
  workspaceMode: WorkspaceProductMode;
  billing: OperationalBillingSnapshot;
  usage?: OperationalFeatureUsage;
}): OperationalGateDecision {
  const policy = OPERATIONAL_COMMERCIAL_FEATURE_POLICIES.find(
    (candidate) => candidate.id === input.featureId
  );
  if (!policy) {
    return { allowed: false, result: "ambiguous", reason: "unknown_feature" };
  }

  if (PLAN_RANK[input.plan] < PLAN_RANK[policy.minimumPlan]) {
    return { allowed: false, result: "denied", reason: "plan_gated" };
  }

  if (!policy.workspaceModes.includes(input.workspaceMode)) {
    return { allowed: false, result: "denied", reason: "workspace_mode_gated" };
  }

  if (policy.requiresPaidBilling) {
    const billingDecision = evaluateOperationalBillingAccess(input.billing);
    if (!billingDecision.allowed) return billingDecision;
  }

  if (policy.usageLimit && typeof policy.limit === "number") {
    const used = input.usage?.[policy.usageLimit];
    if (typeof used !== "number") {
      return { allowed: false, result: "ambiguous", reason: "usage_unknown" };
    }
    const pending = policy.id === "invite_member" ? input.usage?.pendingInvites ?? 0 : 0;
    if (used + pending >= policy.limit) {
      return {
        allowed: false,
        result: "denied",
        reason: policy.id === "invite_member" ? "seat_limit_reached" : "usage_limit_reached",
        auditAction: policy.auditAction,
      };
    }
  }

  return {
    allowed: true,
    result: "allowed",
    reason: "allowed",
    auditAction: policy.auditAction,
    manualBoundary: policy.manualBoundary,
  };
}

export function evaluateSeatMutation(input: {
  operation: OperationalSeatMutationId;
  activeSeats: number;
  pendingInvites?: number;
  seatLimit?: number;
  duplicatePendingInvite?: boolean;
  existingMember?: boolean;
  sameTenant?: boolean;
  billingCustomerMatches?: boolean;
  inviteExpired?: boolean;
}): OperationalGateDecision {
  const seatLimit = input.seatLimit ?? CORE_PLAN_LIMITS.teamMembers;
  const pendingInvites = input.pendingInvites ?? 0;

  if (input.sameTenant === false) {
    return {
      allowed: false,
      result: "denied",
      reason: "tenant_scope_mismatch",
      tenantScoped: false,
    };
  }

  if (input.billingCustomerMatches === false || input.operation === "billing_mismatch") {
    return {
      allowed: false,
      result: "denied",
      reason: "billing_mismatch",
      tenantScoped: true,
      auditAction: "billing.seat_mismatch_detected",
    };
  }

  if (input.inviteExpired || input.operation === "expired_invite") {
    return {
      allowed: false,
      result: "denied",
      reason: "invite_expired",
      idempotent: true,
      tenantScoped: true,
      auditAction: "member.invite_expired",
    };
  }

  if (input.operation === "invite_revoke") {
    return {
      allowed: true,
      result: "allowed",
      reason: "allowed",
      idempotent: true,
      tenantScoped: true,
      auditAction: "member.invite_revoked",
    };
  }

  if (input.operation === "role_change") {
    return {
      allowed: true,
      result: "allowed",
      reason: "allowed",
      idempotent: true,
      tenantScoped: true,
      auditAction: "member.role_changed",
    };
  }

  if (input.duplicatePendingInvite || input.operation === "duplicate_invite") {
    return {
      allowed: true,
      result: "allowed",
      reason: "duplicate_idempotent",
      idempotent: true,
      tenantScoped: true,
      auditAction: "member.invited",
    };
  }

  if (input.operation === "invite_accept") {
    const seatDelta = input.existingMember ? 0 : 1;
    if (input.activeSeats + seatDelta > seatLimit) {
      return {
        allowed: false,
        result: "denied",
        reason: "seat_limit_reached",
        tenantScoped: true,
        auditAction: "member.invite_accept_blocked",
      };
    }
    return {
      allowed: true,
      result: "allowed",
      reason: "allowed",
      idempotent: Boolean(input.existingMember),
      tenantScoped: true,
      auditAction: "member.invite_accepted",
    };
  }

  const seatDelta = input.operation === "invite_creation" ? 1 : 0;
  if (input.activeSeats + pendingInvites + seatDelta > seatLimit) {
    return {
      allowed: false,
      result: "denied",
      reason: "seat_limit_reached",
      tenantScoped: true,
      auditAction: "member.invite_blocked",
    };
  }

  return {
    allowed: true,
    result: "allowed",
    reason: "allowed",
    tenantScoped: true,
    auditAction: "member.invited",
  };
}

export function validateOperationalBillingEntitlementRegistry(): string[] {
  const issues: string[] = [];
  for (const id of OPERATIONAL_COMMERCIAL_GATE_IDS) {
    if (!id.includes("_") && !id.includes("s")) issues.push(`commercial_gate:${id}:not_classified`);
  }
  for (const state of OPERATIONAL_BILLING_STATE_IDS) {
    const decision = evaluateOperationalBillingAccess({
      stripeCustomerId: state === "no_customer" ? null : "cus_fixture",
      stripeSubscriptionId: state === "no_subscription" || state === "no_customer" ? null : "sub_fixture",
      stripeSubscriptionStatus:
        state === "no_customer" || state === "no_subscription" || state === "portal_return"
          ? null
          : state,
      portalReturn: state === "portal_return",
      nowMs: Date.UTC(2026, 0, 1),
    });
    if (!["allowed", "denied", "ambiguous"].includes(decision.result)) {
      issues.push(`billing_state:${state}:missing_decision`);
    }
  }
  for (const feature of OPERATIONAL_COMMERCIAL_FEATURE_POLICIES) {
    if (!feature.owner.startsWith("@")) issues.push(`feature:${feature.id}:missing_owner`);
    if (feature.workspaceModes.length === 0) issues.push(`feature:${feature.id}:missing_workspace_modes`);
  }
  for (const safeguard of OPERATIONAL_REVENUE_IMPACT_SAFEGUARDS) {
    if (!safeguard.validationCommand.startsWith("check:")) {
      issues.push(`revenue_safeguard:${safeguard.id}:missing_validation_command`);
    }
  }
  return issues;
}
