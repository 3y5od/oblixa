import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  V10_AUTONOMOUS_COVERAGE_CONTRACTS,
  V10_REQUIRED_PLAN_TODO_IDS,
  classifyV10CoveragePromotionState,
  getV10CoverageContract,
  summarizeV10CoverageByStatus,
  validateV10AutonomousCoveragePromotion,
  v10CoverageHasRequirement,
} from "./v10-autonomous-coverage";

const REMAINING_PLAN_TODOS = [
  "migration-rls-runtime",
  "intake-review-renewal-evidence",
  "api-cron-job-coverage",
  "route-surface-parity",
  "source-schema-discovery",
  "advanced-assurance-p2",
  "privacy-a11y-performance",
  "fixture-seed-and-metrics",
  "security-negative-tests",
  "observability-slo-artifacts",
  "requirement-ledger",
  "api-action-inventory",
  "action-compatibility-model",
  "data-freshness-contracts",
  "query-index-budgets",
  "edge-case-semantics",
  "lifecycle-retention",
  "shared-primitives",
  "data-classification",
  "notification-communication-policy",
  "deterministic-oracles",
  "end-to-end-journeys",
  "failure-mode-taxonomy",
  "provider-ai-boundaries",
  "implementation-slicing",
  "final-reporting",
  "docs-and-removals",
  "rollout-backfill-recovery",
  "regression-boundaries",
  "ci-ratchets",
  "release-promotion-rollback",
  "domain-workflows",
  "security-privacy",
  "release-evidence-boundaries",
  "fixtures-backfill",
  "observability-ops",
  "rollout-rollback",
  "entitlements-integrations",
  "browser-performance",
  "ship-stop-criteria",
  "exhaustive-artifact-sweep",
  "non-autonomous-proof",
] as const;

describe("V10 autonomous coverage ledger", () => {
  it("maps every remaining plan todo to executable or release-check coverage", () => {
    expect(V10_REQUIRED_PLAN_TODO_IDS).toEqual(REMAINING_PLAN_TODOS);
    expect(new Set(V10_REQUIRED_PLAN_TODO_IDS).size).toBe(V10_REQUIRED_PLAN_TODO_IDS.length);
    expect(new Set(V10_AUTONOMOUS_COVERAGE_CONTRACTS.map((contract) => contract.id)).size).toBe(
      V10_AUTONOMOUS_COVERAGE_CONTRACTS.length
    );

    for (const planTodoId of REMAINING_PLAN_TODOS) {
      const contract = getV10CoverageContract(planTodoId);
      expect(contract, planTodoId).not.toBeNull();
      expect(contract?.sourceArtifacts.length, planTodoId).toBeGreaterThan(0);
      expect(contract?.requirements.length, planTodoId).toBeGreaterThan(3);
    }
  });

  it("keeps every referenced source artifact present", () => {
    for (const contract of V10_AUTONOMOUS_COVERAGE_CONTRACTS) {
      for (const artifact of contract.sourceArtifacts) {
        expect(existsSync(join(process.cwd(), artifact)), `${contract.planTodoId}:${artifact}`).toBe(true);
      }
    }
  });

  it("tracks autonomous coverage as shipped with CI-backed promotion state", () => {
    const summary = summarizeV10CoverageByStatus();

    expect(validateV10AutonomousCoveragePromotion()).toEqual([]);
    expect(Object.keys(summary).sort()).toEqual(["environment_gated", "release_check_required", "shipped_behavior", "typed_contract"]);
    expect(summary.shipped_behavior).toBe(V10_AUTONOMOUS_COVERAGE_CONTRACTS.length);
    expect(summary.typed_contract).toBe(0);
    expect(summary.release_check_required).toBe(0);
    expect(summary.environment_gated).toBe(0);
    for (const contract of V10_AUTONOMOUS_COVERAGE_CONTRACTS) {
      expect(contract.status, contract.planTodoId).toBe("shipped_behavior");
      expect(classifyV10CoveragePromotionState(contract), contract.planTodoId).toBe("runtime_backed");
    }
    expect(
      validateV10AutonomousCoveragePromotion([
        {
          id: "static-shipped",
          planTodoId: "static-shipped",
          status: "typed_contract",
          sourceArtifacts: ["src/lib/v10-implementation-checklist.ts"],
          requirements: ["runtime_claim"],
        },
      ])
    ).toEqual([]);
  });

  it("captures high-risk operational invariants from the plan", () => {
    expect(v10CoverageHasRequirement("migration-rls-runtime", "idempotency_no_direct_member_access")).toBe(true);
    expect(v10CoverageHasRequirement("data-freshness-contracts", "count_reconciliation")).toBe(true);
    expect(v10CoverageHasRequirement("query-index-budgets", "indexes_for_lenses")).toBe(true);
    expect(v10CoverageHasRequirement("provider-ai-boundaries", "openai_prompt_injection_boundary")).toBe(true);
    expect(v10CoverageHasRequirement("ci-ratchets", "missing_rls_failure")).toBe(true);
    expect(v10CoverageHasRequirement("domain-workflows", "approval_exception_state_changes")).toBe(true);
    expect(v10CoverageHasRequirement("advanced-assurance-p2", "notification_delivery_or_suppression_policy")).toBe(true);
    expect(v10CoverageHasRequirement("security-privacy", "denial_non_leakage")).toBe(true);
    expect(v10CoverageHasRequirement("release-evidence-boundaries", "waiver_rules")).toBe(true);
    expect(v10CoverageHasRequirement("fixtures-backfill", "privacy_scan")).toBe(true);
    expect(v10CoverageHasRequirement("observability-ops", "operator_runbooks")).toBe(true);
    expect(v10CoverageHasRequirement("rollout-rollback", "canary_blast_radius")).toBe(true);
    expect(v10CoverageHasRequirement("entitlements-integrations", "provider_configuration")).toBe(true);
    expect(v10CoverageHasRequirement("browser-performance", "large_workspace_budgets")).toBe(true);
    expect(v10CoverageHasRequirement("ship-stop-criteria", "blocked_with_reason")).toBe(true);
    expect(v10CoverageHasRequirement("exhaustive-artifact-sweep", "no_silent_exclusions")).toBe(true);
    expect(v10CoverageHasRequirement("non-autonomous-proof", "blocker_or_promoted_evidence")).toBe(true);
  });
});
