export type LoadSmokeTargetId =
  | "landing"
  | "login"
  | "dashboard"
  | "contracts-list"
  | "contract-detail"
  | "upload"
  | "search"
  | "reports"
  | "exports"
  | "cron-like"
  | "provider-mocked";

export type ChaosFixtureId =
  | "supabase-latency"
  | "stripe-failure"
  | "resend-failure"
  | "openai-timeout"
  | "upstash-outage"
  | "webhook-duplicate"
  | "cron-overlap"
  | "db-conflict";

export type CacheConsistencyCaseId =
  | "stale-reads"
  | "read-after-write-lag"
  | "revalidation-tags"
  | "cache-headers"
  | "stale-mutation-guards"
  | "cache-poisoning-inputs";

export type BudgetContractId =
  | "js-bundle"
  | "server-build-output"
  | "route-runtime-class"
  | "max-duration"
  | "expensive-dependency-imports";

export type LoadSmokeTarget = {
  id: LoadSmokeTargetId;
  path: string;
  ownerArea: "frontend-platform" | "api-platform" | "document-pipeline" | "platform-runtime";
  authMode: "public" | "auth-redirect-ok" | "cron-deny-ok" | "provider-mock";
  thresholds: {
    p95Ms: number;
    maxErrorRate: number;
    maxResponseKb: number;
  };
  resourceBudget: {
    maxVus: number;
    maxDurationSeconds: number;
  };
  acceptedStatuses: readonly number[];
};

export const LOAD_SMOKE_TARGETS: readonly LoadSmokeTarget[] = [
  {
    id: "landing",
    path: "/",
    ownerArea: "frontend-platform",
    authMode: "public",
    thresholds: { p95Ms: 1500, maxErrorRate: 0.01, maxResponseKb: 900 },
    resourceBudget: { maxVus: 2, maxDurationSeconds: 30 },
    acceptedStatuses: [200],
  },
  {
    id: "login",
    path: "/login",
    ownerArea: "frontend-platform",
    authMode: "public",
    thresholds: { p95Ms: 1500, maxErrorRate: 0.01, maxResponseKb: 600 },
    resourceBudget: { maxVus: 2, maxDurationSeconds: 30 },
    acceptedStatuses: [200],
  },
  {
    id: "dashboard",
    path: "/dashboard",
    ownerArea: "frontend-platform",
    authMode: "auth-redirect-ok",
    thresholds: { p95Ms: 2500, maxErrorRate: 0.02, maxResponseKb: 900 },
    resourceBudget: { maxVus: 2, maxDurationSeconds: 30 },
    acceptedStatuses: [200, 302, 303, 307, 308, 401, 403],
  },
  {
    id: "contracts-list",
    path: "/contracts",
    ownerArea: "frontend-platform",
    authMode: "auth-redirect-ok",
    thresholds: { p95Ms: 2500, maxErrorRate: 0.02, maxResponseKb: 900 },
    resourceBudget: { maxVus: 2, maxDurationSeconds: 30 },
    acceptedStatuses: [200, 302, 303, 307, 308, 401, 403],
  },
  {
    id: "contract-detail",
    path: "/contracts/performance-smoke-contract",
    ownerArea: "frontend-platform",
    authMode: "auth-redirect-ok",
    thresholds: { p95Ms: 2500, maxErrorRate: 0.02, maxResponseKb: 900 },
    resourceBudget: { maxVus: 2, maxDurationSeconds: 30 },
    acceptedStatuses: [200, 302, 303, 307, 308, 401, 403, 404],
  },
  {
    id: "upload",
    path: "/contracts/bulk",
    ownerArea: "document-pipeline",
    authMode: "auth-redirect-ok",
    thresholds: { p95Ms: 2500, maxErrorRate: 0.02, maxResponseKb: 900 },
    resourceBudget: { maxVus: 2, maxDurationSeconds: 30 },
    acceptedStatuses: [200, 302, 303, 307, 308, 401, 403],
  },
  {
    id: "search",
    path: "/search?q=renewal",
    ownerArea: "frontend-platform",
    authMode: "auth-redirect-ok",
    thresholds: { p95Ms: 2500, maxErrorRate: 0.02, maxResponseKb: 900 },
    resourceBudget: { maxVus: 2, maxDurationSeconds: 30 },
    acceptedStatuses: [200, 302, 303, 307, 308, 401, 403],
  },
  {
    id: "reports",
    path: "/reports",
    ownerArea: "frontend-platform",
    authMode: "auth-redirect-ok",
    thresholds: { p95Ms: 2500, maxErrorRate: 0.02, maxResponseKb: 900 },
    resourceBudget: { maxVus: 2, maxDurationSeconds: 30 },
    acceptedStatuses: [200, 302, 303, 307, 308, 401, 403],
  },
  {
    id: "exports",
    path: "/api/report-packs",
    ownerArea: "api-platform",
    authMode: "auth-redirect-ok",
    thresholds: { p95Ms: 2500, maxErrorRate: 0.02, maxResponseKb: 900 },
    resourceBudget: { maxVus: 2, maxDurationSeconds: 30 },
    acceptedStatuses: [200, 302, 303, 307, 308, 401, 403, 405],
  },
  {
    id: "cron-like",
    path: "/api/reminders/send",
    ownerArea: "platform-runtime",
    authMode: "cron-deny-ok",
    thresholds: { p95Ms: 2000, maxErrorRate: 0.02, maxResponseKb: 64 },
    resourceBudget: { maxVus: 1, maxDurationSeconds: 15 },
    acceptedStatuses: [401, 403, 503],
  },
  {
    id: "provider-mocked",
    path: "/external/performance-provider-mock",
    ownerArea: "api-platform",
    authMode: "provider-mock",
    thresholds: { p95Ms: 2500, maxErrorRate: 0.02, maxResponseKb: 900 },
    resourceBudget: { maxVus: 1, maxDurationSeconds: 15 },
    acceptedStatuses: [200],
  },
];

export const SOAK_STRESS_GUARDRAILS = {
  tool: "k6",
  smokeScript: "k6/smoke.js",
  soakScript: "k6/soak-spike-stub.js",
  localDefaultBaseUrl: "http://127.0.0.1:3000",
  explicitSoakOptInEnv: "RUN_K6_SOAK",
  explicitProductionOptInEnv: "OBLIXA_ALLOW_PRODUCTION_LOAD",
  maxVusWithoutOverride: 2,
  maxDurationSecondsWithoutOverride: 30,
  blockedProductionHosts: ["oblixa.app", "www.oblixa.app"],
} as const;

export const CHAOS_FIXTURES: readonly {
  id: ChaosFixtureId;
  provider: "supabase" | "stripe" | "resend" | "openai" | "upstash" | "webhook" | "cron" | "database";
  fault: "latency" | "failure" | "timeout" | "outage" | "duplicate" | "overlap" | "conflict";
  expectedUserState: "retryable_degraded" | "queued_for_retry" | "fail_closed" | "idempotent_noop";
  observability: {
    sanitized: true;
    requiredTags: readonly string[];
    forbiddenFields: readonly string[];
  };
}[] = [
  {
    id: "supabase-latency",
    provider: "supabase",
    fault: "latency",
    expectedUserState: "retryable_degraded",
    observability: {
      sanitized: true,
      requiredTags: ["provider", "fault", "correlation_id"],
      forbiddenFields: ["service_role_key", "raw_sql", "contract_text"],
    },
  },
  {
    id: "stripe-failure",
    provider: "stripe",
    fault: "failure",
    expectedUserState: "queued_for_retry",
    observability: {
      sanitized: true,
      requiredTags: ["provider", "fault", "billing_route"],
      forbiddenFields: ["card_number", "payment_method_id", "customer_email"],
    },
  },
  {
    id: "resend-failure",
    provider: "resend",
    fault: "failure",
    expectedUserState: "queued_for_retry",
    observability: {
      sanitized: true,
      requiredTags: ["provider", "fault", "message_type"],
      forbiddenFields: ["email_body", "recipient_email", "api_key"],
    },
  },
  {
    id: "openai-timeout",
    provider: "openai",
    fault: "timeout",
    expectedUserState: "retryable_degraded",
    observability: {
      sanitized: true,
      requiredTags: ["provider", "fault", "model_family"],
      forbiddenFields: ["prompt", "raw_contract_text", "api_key"],
    },
  },
  {
    id: "upstash-outage",
    provider: "upstash",
    fault: "outage",
    expectedUserState: "fail_closed",
    observability: {
      sanitized: true,
      requiredTags: ["provider", "fault", "rate_limit_policy"],
      forbiddenFields: ["redis_url", "token", "ip_address"],
    },
  },
  {
    id: "webhook-duplicate",
    provider: "webhook",
    fault: "duplicate",
    expectedUserState: "idempotent_noop",
    observability: {
      sanitized: true,
      requiredTags: ["provider", "fault", "event_type"],
      forbiddenFields: ["signature", "raw_payload", "provider_secret"],
    },
  },
  {
    id: "cron-overlap",
    provider: "cron",
    fault: "overlap",
    expectedUserState: "idempotent_noop",
    observability: {
      sanitized: true,
      requiredTags: ["job", "fault", "correlation_id"],
      forbiddenFields: ["cron_secret", "raw_headers", "org_id"],
    },
  },
  {
    id: "db-conflict",
    provider: "database",
    fault: "conflict",
    expectedUserState: "retryable_degraded",
    observability: {
      sanitized: true,
      requiredTags: ["table_family", "fault", "diagnostic_id"],
      forbiddenFields: ["sql", "record_id", "tenant_id"],
    },
  },
];

export const CACHE_CONSISTENCY_CASES: readonly {
  id: CacheConsistencyCaseId;
  routeFamily: string;
  guard: string;
  expectedOutcome: string;
}[] = [
  {
    id: "stale-reads",
    routeFamily: "reports",
    guard: "stale_read_model_detects_partial_and_repair_required",
    expectedOutcome: "stale data is labeled and repairable",
  },
  {
    id: "read-after-write-lag",
    routeFamily: "work",
    guard: "mutation_expected_version_prevents_laggy_overwrite",
    expectedOutcome: "client sees refresh-required conflict instead of silent overwrite",
  },
  {
    id: "revalidation-tags",
    routeFamily: "contracts",
    guard: "revalidatePath_or_tag_is_explicit_for_mutations",
    expectedOutcome: "write paths declare the pages they refresh",
  },
  {
    id: "cache-headers",
    routeFamily: "api",
    guard: "private_no_store_for_sensitive_responses",
    expectedOutcome: "sensitive responses are CDN-resistant",
  },
  {
    id: "stale-mutation-guards",
    routeFamily: "server-actions",
    guard: "expected_version_and_idempotency_contract",
    expectedOutcome: "stale mutation attempts return structured 409 outcomes",
  },
  {
    id: "cache-poisoning-inputs",
    routeFamily: "search",
    guard: "untrusted_query_never_controls_shared_cache_key",
    expectedOutcome: "query inputs are private and never public-cacheable",
  },
];

export const BUNDLE_RUNTIME_BUDGETS: readonly {
  id: BudgetContractId;
  guardCommand: string;
  ownerArea: "frontend-platform" | "api-platform" | "platform-runtime";
  ratchet: string;
}[] = [
  {
    id: "js-bundle",
    guardCommand: "check:bundle-budget",
    ownerArea: "frontend-platform",
    ratchet: "BUNDLE_BUDGET_CLIENT_KB and BUNDLE_BUDGET_FIRST_LOAD_KB require owner-reviewed changes",
  },
  {
    id: "server-build-output",
    guardCommand: "perf:autonomous:postbuild",
    ownerArea: "platform-runtime",
    ratchet: "autonomous perf artifacts capture server output and route budget drift",
  },
  {
    id: "route-runtime-class",
    guardCommand: "check:route-universe",
    ownerArea: "api-platform",
    ratchet: "route runtime class is inventoried in route-runtime-contract artifacts",
  },
  {
    id: "max-duration",
    guardCommand: "check:timeout-budget-guards",
    ownerArea: "platform-runtime",
    ratchet: "route maxDuration and timeout budgets fail static checks on drift",
  },
  {
    id: "expensive-dependency-imports",
    guardCommand: "check:performance-static:strict",
    ownerArea: "frontend-platform",
    ratchet: "server-only packages and heavy imports stay out of client components",
  },
];

export function isProductionLoadTarget(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  return SOAK_STRESS_GUARDRAILS.blockedProductionHosts.some((host) => host === parsed.hostname);
}

export function isSafeLoadTarget(rawUrl: string, env: Record<string, string | undefined> = process.env): boolean {
  if (!isProductionLoadTarget(rawUrl)) return true;
  return env[SOAK_STRESS_GUARDRAILS.explicitProductionOptInEnv] === "1";
}

export function validateOperationalPerformanceContracts() {
  const issues: string[] = [];
  for (const target of LOAD_SMOKE_TARGETS) {
    if (target.thresholds.p95Ms <= 0) issues.push(`${target.id}:p95_threshold_required`);
    if (target.thresholds.maxErrorRate < 0 || target.thresholds.maxErrorRate > 0.05) {
      issues.push(`${target.id}:error_rate_threshold_too_loose`);
    }
    if (target.resourceBudget.maxVus > SOAK_STRESS_GUARDRAILS.maxVusWithoutOverride) {
      issues.push(`${target.id}:vus_budget_exceeds_default_cap`);
    }
    if (target.resourceBudget.maxDurationSeconds > SOAK_STRESS_GUARDRAILS.maxDurationSecondsWithoutOverride) {
      issues.push(`${target.id}:duration_budget_exceeds_default_cap`);
    }
  }

  for (const fixture of CHAOS_FIXTURES) {
    if (!fixture.observability.sanitized) issues.push(`${fixture.id}:observability_not_sanitized`);
    if (fixture.observability.requiredTags.length < 2) issues.push(`${fixture.id}:tags_missing`);
    if (fixture.observability.forbiddenFields.length < 2) issues.push(`${fixture.id}:forbidden_fields_missing`);
  }

  for (const cacheCase of CACHE_CONSISTENCY_CASES) {
    if (!cacheCase.guard || !cacheCase.expectedOutcome) issues.push(`${cacheCase.id}:cache_contract_incomplete`);
  }

  for (const budget of BUNDLE_RUNTIME_BUDGETS) {
    if (!budget.guardCommand.startsWith("check:") && !budget.guardCommand.startsWith("perf:")) {
      issues.push(`${budget.id}:budget_guard_not_executable`);
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    loadSmokeTargetCount: LOAD_SMOKE_TARGETS.length,
    chaosFixtureCount: CHAOS_FIXTURES.length,
    cacheConsistencyCaseCount: CACHE_CONSISTENCY_CASES.length,
    budgetContractCount: BUNDLE_RUNTIME_BUDGETS.length,
  };
}
