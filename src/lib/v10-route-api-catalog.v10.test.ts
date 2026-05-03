import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  V10_ROUTE_API_CATALOG,
  V10_ROUTER_JOBS_REPORTS_BOUNDARY_CONTRACTS,
  buildV10RouteActionInventory,
  buildV10RouteApiInventory,
  getV10RouteRuntimeArtifact,
  getV10RouteTestArtifact,
  getV10RouteContractsForSurface,
  getV10RouteTemplateForHref,
  validateV10RouteActionInventory,
  validateV10RouteResponseContract,
  validateV10RouterJobsReportsBoundaryContracts,
  validateV10RouteApiInventory,
  validateV10RouteApiContract,
  v10RouteRequiresPrivateCache,
  resolveV10RoutePostContract,
} from "./v10-route-api-catalog";
import { buildV10MutationResponse, V10_REQUIRED_MUTATION_CONTRACTS } from "./v10-mutation-envelope";
import { canonicalizeV10MutationName } from "./v10-mutation-rollout";

function apiRouteFileForPath(path: string): string | null {
  if (!path.startsWith("/api/")) return null;
  const segments = path
    .replace(/^\//, "")
    .split("/")
    .map((segment) => (segment.startsWith("[") ? segment : segment));
  return join(process.cwd(), "src/app", ...segments, "route.ts");
}

function collectApiRouteFiles(dir = join(process.cwd(), "src/app/api")): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectApiRouteFiles(absolute));
    } else if (entry.name === "route.ts") {
      files.push(absolute);
    }
  }
  return files;
}

function routePathForApiRouteFile(filePath: string): string {
  return `/${filePath
    .replace(join(process.cwd(), "src/app/"), "")
    .replace(/\/route\.ts$/, "")}`;
}

describe("V10 route and API catalog", () => {
  it("maps V10 product surfaces to concrete routes", () => {
    const paths = V10_ROUTE_API_CATALOG.map((contract) => contract.path);

    expect(V10_ROUTE_API_CATALOG.map((contract) => contract.surface)).toEqual(
      expect.arrayContaining([
        "home",
        "contracts",
        "review",
        "work",
        "renewals",
        "approvals",
        "exceptions",
        "activation",
        "evidence",
        "reports",
        "exports",
        "settings",
        "advanced",
        "assurance",
      ])
    );
    expect(getV10RouteContractsForSurface("work")[0]?.path).toBe("/work");
    expect(getV10RouteContractsForSurface("contracts").map((contract) => contract.path)).toEqual(
      expect.arrayContaining(["/contracts", "/contracts/[id]"])
    );
    expect(paths).toEqual(
      expect.arrayContaining([
        "/api/command-palette/contracts",
        "/api/import/contracts",
        "/api/import/contracts/[jobId]",
        "/api/contracts/recompute-signals",
        "/contracts/tasks",
        "/contracts/obligations",
        "/contracts/evidence-studio",
        "/contracts/reports",
        "/api/approvals/[id]/[action]",
        "/api/exceptions/[id]/[action]",
        "/api/renewals/[id]/[action]",
        "/api/evidence/requests",
        "/api/evidence/[id]/[action]",
        "/api/cron/v4/evidence-followup",
        "/api/cron/v10/idempotency-cleanup",
        "/api/cron/v10/read-model-refresh",
        "/api/cron/v10/runtime-artifact-cleanup",
        "/reports",
        "/api/export/contracts",
        "/api/export/contracts/[jobId]",
        "/api/reports/send-summaries",
        "/settings/product",
      ])
    );
  });

  it("requires private cache for sensitive V10 routes", () => {
    expect(v10RouteRequiresPrivateCache("/api/command-palette/contracts")).toBe(true);
    expect(v10RouteRequiresPrivateCache("/api/export/contracts")).toBe(true);
    expect(v10RouteRequiresPrivateCache("/settings/health")).toBe(true);
  });

  it("ties router, jobs, reports, notifications, governance, support, provider, and billing boundaries to routes", () => {
    expect(validateV10RouterJobsReportsBoundaryContracts()).toEqual([]);
    expect(V10_ROUTER_JOBS_REPORTS_BOUNDARY_CONTRACTS.map((contract) => contract.domain)).toEqual([
      "command_search",
      "navigation",
      "reports",
      "exports",
      "jobs",
      "notifications",
      "settings_governance",
      "support_diagnostics",
      "provider_boundary",
      "billing_boundary",
    ]);
    expect(V10_ROUTER_JOBS_REPORTS_BOUNDARY_CONTRACTS.find((contract) => contract.domain === "reports")).toMatchObject({
      primaryRoute: "/api/report-packs",
      readModels: expect.arrayContaining(["report_run_visibility", "job_run_visibility"]),
      jobOrNotificationClasses: expect.arrayContaining(["report_generation", "report_delivery"]),
      recoveryDestination: "/settings/health#v10-jobs",
    });
    expect(V10_ROUTER_JOBS_REPORTS_BOUNDARY_CONTRACTS.find((contract) => contract.domain === "provider_boundary")).toMatchObject({
      primaryRoute: "/settings/health",
      recoveryDestination: "/settings/health#providers",
      supportSafe: true,
    });
    expect(
      validateV10RouterJobsReportsBoundaryContracts([
        {
          domain: "reports",
          primaryRoute: "/not-in-catalog",
          readModels: [],
          jobOrNotificationClasses: [],
          recoveryDestination: "settings",
          requiredProofs: [],
          privateCacheRequired: false,
          supportSafe: false,
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "reports:route_not_in_catalog",
        "reports:read_model_required",
        "reports:recovery_destination_required",
        "reports:proof_required",
        "reports:private_cache_required",
        "reports:support_safe_required",
        "reports:job_class_required",
        "boundary_missing:command_search",
      ])
    );
  });

  it("requires idempotency and audit only for V10 mutation-envelope API contracts", () => {
    const envelopeMutations = V10_ROUTE_API_CATALOG.filter(
      (contract) => resolveV10RoutePostContract(contract) === "v10_mutation_envelope" && contract.methods.some((m) => m !== "GET")
    );
    expect(envelopeMutations.length).toBeGreaterThan(0);
    for (const contract of envelopeMutations) {
      expect(contract.idempotencyRequired, contract.path).toBe(true);
      expect(contract.auditRequired, contract.path).toBe(true);
    }
    for (const contract of V10_ROUTE_API_CATALOG) {
      expect(validateV10RouteApiContract(contract), contract.path).toEqual([]);
    }
  });

  it("keeps required mutation runtime artifacts wired to V10 idempotency, audit, and refresh contracts", () => {
    const sources = new Map<string, string>();
    for (const mutation of V10_REQUIRED_MUTATION_CONTRACTS) {
      const source =
        sources.get(mutation.runtimeArtifact) ??
        readFileSync(join(process.cwd(), mutation.runtimeArtifact), "utf8");
      sources.set(mutation.runtimeArtifact, source);

      if (mutation.requiresIdempotency) {
        expect(source, `${mutation.key}:idempotency`).toMatch(/executeV10(?:Idempotent|Audited|IdempotentResponse)Mutation/);
      }
      if (mutation.requiresAudit) {
        expect(source, `${mutation.key}:audit`).toMatch(/recordV10AuditEvent|executeV10AuditedMutation/);
      }
      expect(source, `${mutation.key}:read-model-refresh`).toContain("refreshV10ReadModelsForOrganization");
    }
  });

  it("keeps route paths unique and fails closed for unsafe route metadata", () => {
    const routeKeys = V10_ROUTE_API_CATALOG.map((contract) => `${contract.path}:${contract.methods.join(",")}`);
    expect(new Set(routeKeys).size).toBe(routeKeys.length);
    expect(
      validateV10RouteApiContract({
        surface: "work",
        path: "work",
        methods: ["POST"],
        featureFamily: "work",
        minimumMode: "core",
        minimumRole: "viewer",
        minimumPlan: "trial",
        authRequired: true,
        idempotencyRequired: true,
        auditRequired: false,
        privateCacheRequired: false,
      })
    ).toEqual(
      expect.arrayContaining([
        "path_must_be_absolute",
        "private_cache_required",
        "idempotent_mutation_requires_audit",
        "v10_mutation_envelope_requires_idempotency_and_audit",
      ])
    );
    expect(
      validateV10RouteApiContract({
        surface: "reports",
        path: "/api/public-report",
        methods: ["GET"],
        featureFamily: "reports",
        minimumMode: "core",
        minimumRole: "viewer",
        minimumPlan: "core",
        authRequired: false,
        idempotencyRequired: false,
        auditRequired: false,
        privateCacheRequired: true,
      })
    ).toEqual(["unauthenticated_route_must_be_external_evidence"]);
  });

  it("keeps Advanced and Assurance gated by mode and plan", () => {
    expect(getV10RouteContractsForSurface("advanced")[0]).toMatchObject({
      minimumMode: "advanced",
      minimumPlan: "advanced",
    });
    expect(getV10RouteContractsForSurface("assurance")[0]).toMatchObject({
      minimumMode: "assurance",
      minimumPlan: "assurance",
    });
  });

  it("normalizes command-search hrefs to concrete V10 route templates", () => {
    expect(getV10RouteTemplateForHref("/accounts/acme")).toBe("/accounts/[key]");
    expect(getV10RouteTemplateForHref("/counterparties/acme?tab=relationships")).toBe("/counterparties/[key]");
    expect(getV10RouteTemplateForHref("/campaigns/compare?simulation=sim_1")).toBe("/campaigns/compare");
    expect(getV10RouteTemplateForHref("/assurance/findings/finding_1")).toBe("/assurance/findings/[id]");
    expect(getV10RouteTemplateForHref("/assurance/playbooks?run=run_1")).toBe("/assurance/playbooks");
    expect(getV10RouteTemplateForHref("https://example.test/contracts/1")).toBeNull();
  });

  it("keeps API catalog entries tied to route implementations and V10 mutation guards", () => {
    for (const contract of V10_ROUTE_API_CATALOG) {
      const runtimeArtifact = getV10RouteRuntimeArtifact(contract.path);
      const routeFile = contract.path.startsWith("/api/") ? join(process.cwd(), runtimeArtifact) : apiRouteFileForPath(contract.path);
      expect(existsSync(join(process.cwd(), runtimeArtifact)), contract.path).toBe(true);
      expect(getV10RouteTestArtifact(contract.path), contract.path).toMatch(/^(e2e\/v10-core-smoke\.spec\.ts|src\/app\/api\/.+\/route(\.v10)?\.test\.ts)$/);
      if (!routeFile) continue;
      expect(existsSync(routeFile), contract.path).toBe(true);
      const source = readFileSync(routeFile, "utf8");
      if (contract.privateCacheRequired) {
        expect(source, `${contract.path}:private-cache`).toContain("Cache-Control");
      }
      if (contract.path.includes("/api/cron/") || resolveV10RoutePostContract(contract) === "cron_secret_json") {
        expect(source, `${contract.path}:cron-auth`).toMatch(
          /ensureCronAuthorized|authorizeCronRequest|gateCronRequest/
        );
      }
      const resolved = resolveV10RoutePostContract(contract);
      if (contract.idempotencyRequired) {
        expect(source, `${contract.path}:${contract.methods.join(",")}:idempotency`).toMatch(
          /executeV10IdempotentMutation|executeV10AuditedMutation|getV10IdempotencyKeyFromRequest/
        );
      }
      if (contract.auditRequired) {
        expect(source, `${contract.path}:${contract.methods.join(",")}:audit`).toMatch(/recordV10AuditEvent|executeV10AuditedMutation/);
      }
      if (resolved === "session_json") {
        expect(source, `${contract.path}:session`).toMatch(
          /getApiAuthContext|getAuthContext|getDeterministicMembership|supabase\.auth\.getUser|requireV6Context|requireV5ApiFeature/
        );
      }
      if (resolved === "stripe_signed_webhook") {
        expect(source, `${contract.path}:stripe`).toMatch(/constructEvent|stripe-signature|STRIPE_WEBHOOK_SECRET/i);
      }
      if (resolved === "integration_inbound") {
        expect(source, `${contract.path}:inbound`).toMatch(/isInboundAutomationAuthorized/);
      }
      if (resolved === "opaque_token_json") {
        expect(source, `${contract.path}:token`).toMatch(/external_action_links|verifyExternal|external_action/i);
      }
      if (resolved === "worker_bearer_json") {
        expect(source, `${contract.path}:worker`).toMatch(/parseBearerToken|EXTRACTION_WORKER_SECRET|secureCompareUtf8/);
      }
    }
  });

  it("fails when V10 API mutation helpers drift outside the route catalog", () => {
    const catalogPaths = new Set(V10_ROUTE_API_CATALOG.map((contract) => contract.path));
    const v10MutationRouteFiles = collectApiRouteFiles().filter((filePath) => {
      const source = readFileSync(filePath, "utf8");
      return /executeV10(Idempotent|Audited)Mutation|getV10IdempotencyKeyFromRequest/.test(source);
    });

    expect(v10MutationRouteFiles.length).toBeGreaterThan(0);
    for (const filePath of v10MutationRouteFiles) {
      const routePath = routePathForApiRouteFile(filePath);
      expect(catalogPaths.has(routePath), routePath).toBe(true);
    }
  });

  it("keeps every V10 cron route in the route catalog", () => {
    const catalogPaths = new Set(V10_ROUTE_API_CATALOG.map((contract) => contract.path));
    const v10CronRouteFiles = collectApiRouteFiles(join(process.cwd(), "src/app/api/cron/v10"));

    expect(v10CronRouteFiles.length).toBeGreaterThanOrEqual(3);
    for (const filePath of v10CronRouteFiles) {
      const routePath = routePathForApiRouteFile(filePath);
      expect(catalogPaths.has(routePath), routePath).toBe(true);
    }
  });

  it("keeps concrete route mutation names joinable to the canonical V10 mutation catalog", () => {
    const routeMutationNames = [
      "create_contract_import",
      "retry_failed_job",
      "create_evidence_request",
      "evidence.submit",
      "evidence.accept",
      "evidence.reject",
      "approval.approve",
      "approval.reject",
      "approval.request-changes",
      "approval.delegate",
      "approval.escalate",
      "exception.assign",
      "exception.resolve",
      "exception.reopen",
      "renewal.complete",
      "renewal.reopen",
      "renewal.generate_decision_packet",
      "renewal.recommendation",
      "report_pack.create",
      "create_export_job",
    ];

    for (const name of routeMutationNames) {
      expect(canonicalizeV10MutationName(name), name).not.toBeNull();
    }
  });

  it("keeps required mutation artifacts concrete and API-backed where applicable", () => {
    const catalogPaths = new Set(V10_ROUTE_API_CATALOG.map((contract) => contract.path));

    for (const contract of V10_REQUIRED_MUTATION_CONTRACTS) {
      const artifactPath = join(process.cwd(), contract.runtimeArtifact);
      expect(existsSync(artifactPath), contract.key).toBe(true);

      if (contract.runtimeArtifact.startsWith("src/app/api/")) {
        const routePath = `/${contract.runtimeArtifact
          .replace(/^src\/app\//, "")
          .replace(/\/route\.ts$/, "")}`;
        expect(catalogPaths.has(routePath), contract.key).toBe(true);
      }
    }
  });

  it("keeps required mutations joined to route/action idempotency, audit, and response schema metadata", () => {
    const actionInventory = buildV10RouteActionInventory();
    const actionNames = actionInventory.map((row) => row.mutationName);

    expect(validateV10RouteActionInventory(actionInventory)).toEqual([]);
    expect(actionInventory).toHaveLength(V10_REQUIRED_MUTATION_CONTRACTS.length);
    expect(actionNames).toEqual(V10_REQUIRED_MUTATION_CONTRACTS.map((contract) => contract.key));
    expect(actionInventory.find((row) => row.mutationName === "create_contract_import")).toMatchObject({
      routePath: "/api/import/contracts",
      idempotencyRequired: true,
      auditRequired: true,
      responseSchema: "v10_mutation_envelope",
    });
    expect(
      validateV10RouteActionInventory([
        {
          mutationName: "unsafe",
          routePath: "/api/export/contracts/[missing]",
          runtimeArtifact: "",
          auditAction: "unsafe",
          minimumRole: "viewer",
          idempotencyRequired: false,
          auditRequired: false,
          responseSchema: "v10_mutation_envelope",
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "unsafe:runtime_artifact_required",
        "unsafe:audit_action_required",
        "unsafe:idempotency_required",
        "unsafe:audit_required",
        "unsafe:route_catalog_missing",
      ])
    );
  });

  it("generates route inventory metadata for auth, capabilities, caching, pagination, schemas, and recovery", () => {
    const inventory = buildV10RouteApiInventory();

    expect(validateV10RouteApiInventory(inventory)).toEqual([]);
    expect(inventory).toHaveLength(V10_ROUTE_API_CATALOG.length);
    expect(inventory.find((row) => row.path === "/api/cron/v4/evidence-followup")).toMatchObject({
      authType: "cron_secret",
      routeOwner: "operations",
      rateLimitPolicy: "cron",
      cachePolicy: "private_no_store",
      errorStatusCodes: expect.arrayContaining([401, 429, 500]),
    });
    expect(inventory.find((row) => row.path === "/api/cron/v10/runtime-artifact-cleanup")).toMatchObject({
      authType: "cron_secret",
      rateLimitPolicy: "cron",
      recoveryBehavior: "settings_health",
      diagnosticPrefix: "v10_cron_v10_runtime_artifact_cleanup",
    });
    expect(inventory.find((row) => row.path === "/api/evidence/submit")).toMatchObject({
      authType: "session",
      responseSchema: "v10_mutation_envelope",
      recoveryBehavior: "recoverable_state",
      errorStatusCodes: expect.arrayContaining([400, 401, 403, 404, 409, 424, 429, 500]),
    });
    expect(inventory.find((row) => row.path === "/work")).toMatchObject({
      paginationPolicy: "bounded_limit",
      recoveryBehavior: "recoverable_state",
      errorStatusCodes: expect.arrayContaining([401, 403, 404, 429, 500]),
    });
    for (const row of inventory) {
      expect(row.diagnosticPrefix, row.path).toMatch(/^v10_[a-z0-9_]+$/);
      expect(row.errorStatusCodes.length, row.path).toBeGreaterThan(0);
    }
  });

  it("validates concrete response headers, mutation envelopes, bounded lists, and retry diagnostics", () => {
    const inventory = buildV10RouteApiInventory();
    const mutationRow = inventory.find((row) => row.path === "/api/approvals/[id]/[action]")!;
    const workRow = inventory.find((row) => row.path === "/work")!;
    const exportJobRow = inventory.find((row) => row.path === "/api/export/contracts/[jobId]")!;

    expect(
      validateV10RouteResponseContract({
        inventoryRow: mutationRow,
        headers: {
          "Cache-Control": "private, no-store",
          "X-V10-Idempotent-Replay": "false",
        },
        body: buildV10MutationResponse({
          outcome: "success",
          message: "Approval delegated.",
          changedObjectType: "approval",
          changedObjectId: "approval_1",
          auditEventId: "audit_1",
        }),
      })
    ).toEqual([]);
    expect(
      validateV10RouteResponseContract({
        inventoryRow: mutationRow,
        headers: { "Cache-Control": "public, max-age=60" },
        body: { ok: true },
      })
    ).toEqual(expect.arrayContaining(["private_no_store_header_required", "mutation_outcome_required"]));
    expect(
      validateV10RouteResponseContract({
        inventoryRow: workRow,
        headers: { "Cache-Control": "private, no-store" },
        body: {},
        itemCount: 75,
        maxItems: 50,
      })
    ).toContain("bounded_limit_exceeded");
    expect(
      validateV10RouteResponseContract({
        inventoryRow: exportJobRow,
        headers: { "Cache-Control": "private, no-store" },
        body: { retry_action: "retry" },
      })
    ).toContain("retryable_job_diagnostic_required");
  });
});
