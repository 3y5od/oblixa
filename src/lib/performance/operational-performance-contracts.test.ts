import { describe, expect, it } from "vitest";
import {
  BUNDLE_RUNTIME_BUDGETS,
  CACHE_CONSISTENCY_CASES,
  CHAOS_FIXTURES,
  LOAD_SMOKE_TARGETS,
  isSafeLoadTarget,
  validateOperationalPerformanceContracts,
  type BudgetContractId,
  type CacheConsistencyCaseId,
  type ChaosFixtureId,
  type LoadSmokeTargetId,
} from "@/lib/performance/operational-performance-contracts";

describe("operational performance/load/chaos contracts", () => {
  it("covers every Section 19 load smoke surface with thresholds and cost caps", () => {
    const required: readonly LoadSmokeTargetId[] = [
      "landing",
      "login",
      "dashboard",
      "contracts-list",
      "contract-detail",
      "upload",
      "search",
      "reports",
      "exports",
      "cron-like",
      "provider-mocked",
    ];

    expect(LOAD_SMOKE_TARGETS.map((target) => target.id).sort()).toEqual([...required].sort());
    for (const target of LOAD_SMOKE_TARGETS) {
      expect(target.thresholds.p95Ms).toBeGreaterThan(0);
      expect(target.thresholds.maxErrorRate).toBeGreaterThanOrEqual(0);
      expect(target.thresholds.maxErrorRate).toBeLessThanOrEqual(0.05);
      expect(target.thresholds.maxResponseKb).toBeGreaterThan(0);
      expect(target.resourceBudget.maxVus).toBeLessThanOrEqual(2);
      expect(target.resourceBudget.maxDurationSeconds).toBeLessThanOrEqual(30);
      expect(target.acceptedStatuses.length).toBeGreaterThan(0);
    }
  });

  it("blocks production load targets unless the explicit opt-in is present", () => {
    expect(isSafeLoadTarget("https://oblixa.app", {})).toBe(false);
    expect(isSafeLoadTarget("https://www.oblixa.app", {})).toBe(false);
    expect(isSafeLoadTarget("https://staging.oblixa.invalid", {})).toBe(true);
    expect(isSafeLoadTarget("http://127.0.0.1:3000", {})).toBe(true);
    expect(isSafeLoadTarget("https://oblixa.app", { OBLIXA_ALLOW_PRODUCTION_LOAD: "1" })).toBe(true);
  });

  it("covers all chaos fixtures with sanitized observability expectations", () => {
    const required: readonly ChaosFixtureId[] = [
      "supabase-latency",
      "stripe-failure",
      "resend-failure",
      "openai-timeout",
      "upstash-outage",
      "webhook-duplicate",
      "cron-overlap",
      "db-conflict",
    ];

    expect(CHAOS_FIXTURES.map((fixture) => fixture.id).sort()).toEqual([...required].sort());
    for (const fixture of CHAOS_FIXTURES) {
      expect(fixture.observability.sanitized).toBe(true);
      expect(fixture.observability.requiredTags.length).toBeGreaterThanOrEqual(2);
      expect(fixture.observability.forbiddenFields.join(" ")).toMatch(
        /key|secret|token|payload|email|text|sql|id|headers|url/i
      );
    }
  });

  it("covers cache consistency and bundle/runtime budget objectives", () => {
    const cacheCases: readonly CacheConsistencyCaseId[] = [
      "stale-reads",
      "read-after-write-lag",
      "revalidation-tags",
      "cache-headers",
      "stale-mutation-guards",
      "cache-poisoning-inputs",
    ];
    const budgetContracts: readonly BudgetContractId[] = [
      "js-bundle",
      "server-build-output",
      "route-runtime-class",
      "max-duration",
      "expensive-dependency-imports",
    ];

    expect(CACHE_CONSISTENCY_CASES.map((row) => row.id).sort()).toEqual([...cacheCases].sort());
    expect(BUNDLE_RUNTIME_BUDGETS.map((row) => row.id).sort()).toEqual([...budgetContracts].sort());
    expect(validateOperationalPerformanceContracts()).toMatchObject({ ok: true, issues: [] });
  });
});
