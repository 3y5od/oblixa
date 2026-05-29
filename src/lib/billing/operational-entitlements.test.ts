import { describe, expect, it } from "vitest";
import {
  OPERATIONAL_BILLING_STATE_IDS,
  OPERATIONAL_COMMERCIAL_FEATURE_POLICIES,
  OPERATIONAL_COMMERCIAL_GATE_IDS,
  OPERATIONAL_REVENUE_IMPACT_SAFEGUARDS,
  OPERATIONAL_REVENUE_IMPACT_SAFEGUARD_IDS,
  OPERATIONAL_SEAT_MUTATION_IDS,
  evaluateCommercialFeatureGate,
  evaluateOperationalBillingAccess,
  evaluateSeatMutation,
  resolveOperationalBillingState,
  validateOperationalBillingEntitlementRegistry,
} from "@/lib/billing/operational-entitlements";

describe("operational billing entitlements", () => {
  it("keeps a complete commercial-gate registry", () => {
    expect(OPERATIONAL_COMMERCIAL_GATE_IDS).toEqual([
      "plans",
      "billing_states",
      "feature_access",
      "workspace_modes",
      "seats",
      "usage_limits",
      "grace_periods",
      "blocked_states",
    ]);
    expect(OPERATIONAL_BILLING_STATE_IDS).toEqual([
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
    ]);
    expect(OPERATIONAL_SEAT_MUTATION_IDS).toEqual([
      "invite_creation",
      "invite_revoke",
      "invite_accept",
      "expired_invite",
      "duplicate_invite",
      "seat_limit",
      "role_change",
      "billing_mismatch",
    ]);
    expect(validateOperationalBillingEntitlementRegistry()).toEqual([]);
  });

  it("maps every billing state to deterministic allowed, denied, or ambiguous access", () => {
    const nowMs = Date.UTC(2026, 0, 1);
    const expectations = new Map([
      ["trialing", "allowed"],
      ["active", "allowed"],
      ["past_due", "denied"],
      ["unpaid", "denied"],
      ["canceled", "denied"],
      ["incomplete", "denied"],
      ["incomplete_expired", "denied"],
      ["paused", "denied"],
      ["no_customer", "denied"],
      ["no_subscription", "denied"],
      ["portal_return", "ambiguous"],
    ]);

    for (const state of OPERATIONAL_BILLING_STATE_IDS) {
      const decision = evaluateOperationalBillingAccess({
        stripeCustomerId: state === "no_customer" ? null : "cus_fixture",
        stripeSubscriptionId: state === "no_customer" || state === "no_subscription" ? null : "sub_fixture",
        stripeSubscriptionStatus:
          state === "no_customer" || state === "no_subscription" || state === "portal_return"
            ? null
            : state,
        portalReturn: state === "portal_return",
        nowMs,
      });
      expect(decision.result, state).toBe(expectations.get(state));
    }

    expect(
      evaluateOperationalBillingAccess({
        stripeCustomerId: "cus_fixture",
        stripeSubscriptionId: "sub_fixture",
        stripeSubscriptionStatus: "past_due",
        gracePeriodEndsAt: new Date(nowMs + 86_400_000).toISOString(),
        nowMs,
      })
    ).toMatchObject({ allowed: true, reason: "grace_period" });
  });

  it("normalizes no-customer, no-subscription, legacy subscription, and portal-return snapshots", () => {
    expect(resolveOperationalBillingState({ stripeCustomerId: null })).toBe("no_customer");
    expect(resolveOperationalBillingState({ stripeCustomerId: "cus_fixture", stripeSubscriptionId: null })).toBe("no_subscription");
    expect(resolveOperationalBillingState({ stripeCustomerId: "cus_fixture", stripeSubscriptionId: "sub_fixture" })).toBe("active");
    expect(
      resolveOperationalBillingState({
        stripeCustomerId: "cus_fixture",
        stripeSubscriptionId: "sub_fixture",
        portalReturn: true,
      })
    ).toBe("portal_return");
  });

  it("evaluates commercial feature gates for allowed, denied, and ambiguous states", () => {
    const billing = {
      stripeCustomerId: "cus_fixture",
      stripeSubscriptionId: "sub_fixture",
      stripeSubscriptionStatus: "active",
    };

    expect(
      evaluateCommercialFeatureGate({
        featureId: "ai_extraction",
        plan: "core",
        workspaceMode: "core",
        billing,
      })
    ).toMatchObject({ allowed: true, result: "allowed" });

    expect(
      evaluateCommercialFeatureGate({
        featureId: "report_pack_generation",
        plan: "trial",
        workspaceMode: "advanced",
        billing,
      })
    ).toMatchObject({ allowed: false, reason: "plan_gated" });

    expect(
      evaluateCommercialFeatureGate({
        featureId: "report_pack_generation",
        plan: "core",
        workspaceMode: "core",
        billing,
      })
    ).toMatchObject({ allowed: false, reason: "workspace_mode_gated" });

    expect(
      evaluateCommercialFeatureGate({
        featureId: "ai_extraction",
        plan: "core",
        workspaceMode: "core",
        billing: { ...billing, stripeSubscriptionStatus: "unpaid" },
      })
    ).toMatchObject({ allowed: false, reason: "billing_state_blocked" });

    expect(
      evaluateCommercialFeatureGate({
        featureId: "contract_upload",
        plan: "core",
        workspaceMode: "core",
        billing,
      })
    ).toMatchObject({ allowed: false, result: "ambiguous", reason: "usage_unknown" });

    expect(
      evaluateCommercialFeatureGate({
        featureId: "contract_upload",
        plan: "core",
        workspaceMode: "core",
        billing,
        usage: { activeContracts: 500 },
      })
    ).toMatchObject({ allowed: false, reason: "usage_limit_reached" });
  });

  it("covers seat and invite operations with tenant scope, idempotency, and audit intent", () => {
    expect(
      evaluateSeatMutation({
        operation: "invite_creation",
        activeSeats: 2,
        pendingInvites: 1,
      })
    ).toMatchObject({ allowed: true, tenantScoped: true, auditAction: "member.invited" });

    expect(
      evaluateSeatMutation({
        operation: "invite_creation",
        activeSeats: 10,
        pendingInvites: 0,
      })
    ).toMatchObject({ allowed: false, reason: "seat_limit_reached" });

    expect(
      evaluateSeatMutation({
        operation: "duplicate_invite",
        activeSeats: 10,
        pendingInvites: 1,
      })
    ).toMatchObject({ allowed: true, idempotent: true, reason: "duplicate_idempotent" });

    expect(
      evaluateSeatMutation({
        operation: "invite_revoke",
        activeSeats: 10,
      })
    ).toMatchObject({ allowed: true, idempotent: true, auditAction: "member.invite_revoked" });

    expect(
      evaluateSeatMutation({
        operation: "invite_accept",
        activeSeats: 10,
      })
    ).toMatchObject({ allowed: false, reason: "seat_limit_reached" });

    expect(
      evaluateSeatMutation({
        operation: "invite_accept",
        activeSeats: 10,
        existingMember: true,
      })
    ).toMatchObject({ allowed: true, idempotent: true, auditAction: "member.invite_accepted" });

    expect(
      evaluateSeatMutation({
        operation: "expired_invite",
        activeSeats: 1,
      })
    ).toMatchObject({ allowed: false, idempotent: true, reason: "invite_expired" });

    expect(
      evaluateSeatMutation({
        operation: "role_change",
        activeSeats: 10,
      })
    ).toMatchObject({ allowed: true, idempotent: true, auditAction: "member.role_changed" });

    expect(
      evaluateSeatMutation({
        operation: "billing_mismatch",
        activeSeats: 1,
        billingCustomerMatches: false,
      })
    ).toMatchObject({ allowed: false, reason: "billing_mismatch" });

    expect(
      evaluateSeatMutation({
        operation: "invite_creation",
        activeSeats: 1,
        sameTenant: false,
      })
    ).toMatchObject({ allowed: false, reason: "tenant_scope_mismatch" });
  });

  it("tracks revenue-impact safeguards for billing mutations", () => {
    expect(OPERATIONAL_REVENUE_IMPACT_SAFEGUARDS.map((row) => row.id)).toEqual(
      OPERATIONAL_REVENUE_IMPACT_SAFEGUARD_IDS
    );
    expect(OPERATIONAL_REVENUE_IMPACT_SAFEGUARDS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "idempotency", validationCommand: "check:idempotency-policy" }),
        expect.objectContaining({ id: "audit_events", validationCommand: "check:audit-event-coverage" }),
        expect.objectContaining({ id: "redaction", validationCommand: "check:provider-integration-fixtures" }),
        expect.objectContaining({ id: "provider_event_replay", validationCommand: "check:provider-integration-fixtures" }),
        expect.objectContaining({ id: "manual_boundary", validationCommand: "check:release-security-required-env" }),
      ])
    );
  });

  it("keeps feature policies owned and classified", () => {
    expect(OPERATIONAL_COMMERCIAL_FEATURE_POLICIES).toHaveLength(8);
    expect(
      OPERATIONAL_COMMERCIAL_FEATURE_POLICIES.every((row) => row.owner.startsWith("@") && row.workspaceModes.length > 0)
    ).toBe(true);
  });
});
