import { existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { V10Plan, V10Role, V10WorkspaceMode } from "./v10-release-contract";
import {
  isV10MutationOutcome,
  V10_REQUIRED_MUTATION_CONTRACTS,
  validateV10ApiResponseSchema,
  type V10MutationResponse,
} from "./v10-mutation-envelope";
import { V10_PERFORMANCE_BUDGETS } from "./v10-ui-state-contracts";

const V10_ROUTE_CATALOG_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function resolveV10RouteCatalogArtifact(artifactPath: string): string {
  return join(V10_ROUTE_CATALOG_ROOT, artifactPath);
}

function toV10RouteCatalogRepoPath(artifactPath: string): string {
  return relative(V10_ROUTE_CATALOG_ROOT, artifactPath).replace(/\\/g, "/");
}

export type V10HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";
export type V10RouteSurface =
  | "activation"
  | "home"
  | "contracts"
  | "review"
  | "work"
  | "renewals"
  | "evidence"
  | "approvals"
  | "exceptions"
  | "reports"
  | "exports"
  | "settings"
  | "advanced"
  | "assurance"
  | "command_search";

export type V10RoutePostContractKind =
  | "v10_mutation_envelope"
  | "session_json"
  | "opaque_token_json"
  | "stripe_signed_webhook"
  | "integration_inbound"
  | "cron_secret_json"
  | "worker_bearer_json";

export type V10RouteApiContract = {
  surface: V10RouteSurface;
  path: string;
  methods: readonly V10HttpMethod[];
  featureFamily: string;
  minimumMode: V10WorkspaceMode;
  minimumRole: V10Role;
  minimumPlan: V10Plan;
  authRequired: boolean;
  idempotencyRequired: boolean;
  auditRequired: boolean;
  privateCacheRequired: boolean;
  /** When set on a mutating route, relaxes V10 mutation-envelope inventory rules until the handler is migrated. */
  postContract?: V10RoutePostContractKind;
};

export type V10RoutePostContractResolved = V10RoutePostContractKind | "read_only";

export function resolveV10RoutePostContract(contract: V10RouteApiContract): V10RoutePostContractResolved {
  if (contract.methods.every((m) => m === "GET")) return "read_only";
  if (contract.postContract) return contract.postContract;
  return "v10_mutation_envelope";
}

function allowsUnauthenticatedApiRoute(contract: V10RouteApiContract, resolved: V10RoutePostContractResolved): boolean {
  if (
    resolved === "stripe_signed_webhook" ||
    resolved === "integration_inbound" ||
    resolved === "opaque_token_json" ||
    resolved === "worker_bearer_json"
  ) {
    return true;
  }
  return contract.path.includes("/api/evidence/");
}

function allowsOptionalPrivateCacheHeader(contract: V10RouteApiContract, resolved: V10RoutePostContractResolved): boolean {
  if (resolved === "read_only") return false;
  return resolved !== "v10_mutation_envelope";
}

export type V10RouteApiInventoryRow = V10RouteApiContract & {
  authType: "session" | "external_token" | "cron_secret";
  capability: string;
  routeOwner: "engineering" | "product" | "operations" | "security" | "release";
  diagnosticPrefix: `v10_${string}`;
  errorStatusCodes: readonly (400 | 401 | 403 | 404 | 409 | 410 | 424 | 429 | 500)[];
  rateLimitPolicy: "standard_user" | "mutation" | "cron" | "external_link";
  cachePolicy: "private_no_store";
  paginationPolicy: "not_applicable" | "cursor_required" | "bounded_limit";
  performanceBudgetKind: "not_applicable" | "dashboard" | "contract_list" | "command_palette" | "work_review_queue" | "report_export";
  pageSizeExpectation: number | null;
  virtualizationThresholdRows: number | null;
  debounceWindowMs: { min: number; max: number } | null;
  asyncHandoffThresholds: { rowCount: number; jsonBytes: number; estimatedExecutionMs: number } | null;
  queryPlanExpectation: "not_applicable" | "core_mode_excludes_advanced_assurance_tables";
  responseSchema: "page_html" | "v10_mutation_envelope" | "job_visibility" | "collection";
  recoveryBehavior: "recoverable_state" | "retryable_job" | "external_resubmission" | "settings_health";
};

export type V10RoutePerformanceSmokeContract = {
  budgetKind: Extract<
    V10RouteApiInventoryRow["performanceBudgetKind"],
    "dashboard" | "contract_list" | "command_palette" | "work_review_queue"
  >;
  route: string;
  proofArtifact: string;
  measurement: "integration_smoke" | "unit_integration" | "k6_optional";
  seededFixtureRequired: boolean;
  optionalLoadSmokeScript: string | null;
  loadSmokePaths: readonly string[];
};

export type V10RouteActionInventoryRow = {
  mutationName: string;
  routePath: string | null;
  runtimeArtifact: string;
  auditAction: string;
  minimumRole: V10Role;
  idempotencyRequired: boolean;
  auditRequired: boolean;
  responseSchema: "v10_mutation_envelope";
};

export type V10RouterJobsReportsBoundaryDomain =
  | "command_search"
  | "navigation"
  | "reports"
  | "exports"
  | "jobs"
  | "notifications"
  | "settings_governance"
  | "support_diagnostics"
  | "provider_boundary"
  | "billing_boundary";

function getV10RoutePerformanceMetadata(contract: V10RouteApiContract): Pick<
  V10RouteApiInventoryRow,
  | "performanceBudgetKind"
  | "pageSizeExpectation"
  | "virtualizationThresholdRows"
  | "debounceWindowMs"
  | "asyncHandoffThresholds"
  | "queryPlanExpectation"
> {
  if (contract.path === "/dashboard") {
    return {
      performanceBudgetKind: "dashboard",
      pageSizeExpectation: null,
      virtualizationThresholdRows: null,
      debounceWindowMs: null,
      asyncHandoffThresholds: null,
      queryPlanExpectation: "core_mode_excludes_advanced_assurance_tables",
    };
  }
  if (contract.path === "/contracts") {
    return {
      performanceBudgetKind: "contract_list",
      pageSizeExpectation: V10_PERFORMANCE_BUDGETS.contract_list_pagination_threshold_rows,
      virtualizationThresholdRows: V10_PERFORMANCE_BUDGETS.visible_row_virtualization_threshold_rows,
      debounceWindowMs: null,
      asyncHandoffThresholds: null,
      queryPlanExpectation: "not_applicable",
    };
  }
  if (contract.path === "/api/command-palette/contracts") {
    return {
      performanceBudgetKind: "command_palette",
      pageSizeExpectation: V10_PERFORMANCE_BUDGETS.contract_list_pagination_threshold_rows,
      virtualizationThresholdRows: null,
      debounceWindowMs: {
        min: V10_PERFORMANCE_BUDGETS.command_palette_debounce_min_ms,
        max: V10_PERFORMANCE_BUDGETS.command_palette_debounce_max_ms,
      },
      asyncHandoffThresholds: null,
      queryPlanExpectation: "not_applicable",
    };
  }
  if (["/work", "/contracts/tasks", "/contracts/review", "/contracts/obligations", "/contracts/approvals", "/contracts/exceptions"].includes(contract.path)) {
    return {
      performanceBudgetKind: "work_review_queue",
      pageSizeExpectation: V10_PERFORMANCE_BUDGETS.contract_list_pagination_threshold_rows,
      virtualizationThresholdRows: null,
      debounceWindowMs: null,
      asyncHandoffThresholds: null,
      queryPlanExpectation: "not_applicable",
    };
  }
  if (["/api/export/contracts", "/api/report-packs"].includes(contract.path)) {
    return {
      performanceBudgetKind: "report_export",
      pageSizeExpectation: null,
      virtualizationThresholdRows: null,
      debounceWindowMs: null,
      asyncHandoffThresholds: {
        rowCount: V10_PERFORMANCE_BUDGETS.report_export_async_row_threshold,
        jsonBytes: V10_PERFORMANCE_BUDGETS.report_export_async_json_bytes_threshold,
        estimatedExecutionMs: V10_PERFORMANCE_BUDGETS.report_export_async_execution_ms_threshold,
      },
      queryPlanExpectation: "not_applicable",
    };
  }
  return {
    performanceBudgetKind: "not_applicable",
    pageSizeExpectation: null,
    virtualizationThresholdRows: null,
    debounceWindowMs: null,
    asyncHandoffThresholds: null,
    queryPlanExpectation: "not_applicable",
  };
}

function getV10RoutePaginationPolicy(contract: V10RouteApiContract): V10RouteApiInventoryRow["paginationPolicy"] {
  if (
    contract.surface === "contracts" ||
    contract.surface === "work" ||
    contract.surface === "command_search" ||
    ["/contracts/review", "/contracts/approvals", "/contracts/exceptions"].includes(contract.path)
  ) {
    return "bounded_limit";
  }
  return "not_applicable";
}

export type V10RouterJobsReportsBoundaryContract = {
  domain: V10RouterJobsReportsBoundaryDomain;
  primaryRoute: string;
  readModels: readonly string[];
  jobOrNotificationClasses: readonly string[];
  recoveryDestination: string;
  requiredProofs: readonly string[];
  privateCacheRequired: boolean;
  supportSafe: boolean;
};

const V10_DASHBOARD_PAGE_ARTIFACTS: Record<string, string> = {
  "/dashboard": "src/app/(dashboard)/dashboard/page.tsx",
  "/work": "src/app/(dashboard)/work/page.tsx",
  "/contracts": "src/app/(dashboard)/contracts/page.tsx",
  "/contracts/[id]": "src/app/(dashboard)/contracts/[id]/page.tsx",
  "/contracts/review": "src/app/(dashboard)/contracts/review/page.tsx",
  "/contracts/tasks": "src/app/(dashboard)/contracts/tasks/page.tsx",
  "/contracts/obligations": "src/app/(dashboard)/contracts/obligations/page.tsx",
  "/contracts/renewals": "src/app/(dashboard)/contracts/renewals/page.tsx",
  "/contracts/approvals": "src/app/(dashboard)/contracts/approvals/page.tsx",
  "/contracts/exceptions": "src/app/(dashboard)/contracts/exceptions/page.tsx",
  "/contracts/evidence-studio": "src/app/(dashboard)/contracts/evidence-studio/page.tsx",
  "/contracts/reports": "src/app/(dashboard)/contracts/reports/page.tsx",
  "/reports": "src/app/(dashboard)/reports/page.tsx",
  "/settings": "src/app/(dashboard)/settings/page.tsx",
  "/settings/health": "src/app/(dashboard)/settings/health/page.tsx",
  "/settings/product": "src/app/(dashboard)/settings/product/page.tsx",
  "/decisions": "src/app/(dashboard)/decisions/page.tsx",
  "/decisions/[id]": "src/app/(dashboard)/decisions/[id]/page.tsx",
  "/accounts/[key]": "src/app/(dashboard)/accounts/[key]/page.tsx",
  "/counterparties/[key]": "src/app/(dashboard)/counterparties/[key]/page.tsx",
  "/campaigns/[id]": "src/app/(dashboard)/campaigns/[id]/page.tsx",
  "/campaigns/compare": "src/app/(dashboard)/campaigns/compare/page.tsx",
  "/assurance": "src/app/(dashboard)/assurance/page.tsx",
  "/assurance/findings/[id]": "src/app/(dashboard)/assurance/findings/[id]/page.tsx",
  "/assurance/control-policies/[id]": "src/app/(dashboard)/assurance/control-policies/[id]/page.tsx",
  "/assurance/playbooks": "src/app/(dashboard)/assurance/playbooks/page.tsx",
  "/assurance/scorecards": "src/app/(dashboard)/assurance/scorecards/page.tsx",
  "/assurance/review-boards": "src/app/(dashboard)/assurance/review-boards/page.tsx",
  "/assurance/health-graph": "src/app/(dashboard)/assurance/health-graph/page.tsx",
  "/assurance/autopilot": "src/app/(dashboard)/assurance/autopilot/page.tsx",
  "/assurance/control-policies": "src/app/(dashboard)/assurance/control-policies/page.tsx",
  "/assurance/findings": "src/app/(dashboard)/assurance/findings/page.tsx",
  "/assurance/program-evolution": "src/app/(dashboard)/assurance/program-evolution/page.tsx",
  "/assurance/segments": "src/app/(dashboard)/assurance/segments/page.tsx",
  "/campaigns": "src/app/(dashboard)/campaigns/page.tsx",
  "/contracts/analytics": "src/app/(dashboard)/contracts/analytics/page.tsx",
  "/contracts/approvals/sla-simulator": "src/app/(dashboard)/contracts/approvals/sla-simulator/page.tsx",
  "/contracts/approvals/workload": "src/app/(dashboard)/contracts/approvals/workload/page.tsx",
  "/contracts/bulk": "src/app/(dashboard)/contracts/bulk/page.tsx",
  "/contracts/collaboration": "src/app/(dashboard)/contracts/collaboration/page.tsx",
  "/contracts/data-quality": "src/app/(dashboard)/contracts/data-quality/page.tsx",
  "/contracts/execution-graph": "src/app/(dashboard)/contracts/execution-graph/page.tsx",
  "/contracts/intake": "src/app/(dashboard)/contracts/intake/page.tsx",
  "/contracts/maintenance": "src/app/(dashboard)/contracts/maintenance/page.tsx",
  "/contracts/new": "src/app/(dashboard)/contracts/new/page.tsx",
  "/contracts/programs": "src/app/(dashboard)/contracts/programs/page.tsx",
  "/contracts/review-cadence": "src/app/(dashboard)/contracts/review-cadence/page.tsx",
  "/contracts/watchlists": "src/app/(dashboard)/contracts/watchlists/page.tsx",
  "/dashboard/persona": "src/app/(dashboard)/dashboard/persona/page.tsx",
  "/decisions/compare": "src/app/(dashboard)/decisions/compare/page.tsx",
  "/decisions/review": "src/app/(dashboard)/decisions/review/page.tsx",
  "/more": "src/app/(dashboard)/more/page.tsx",
  "/onboarding/calibration": "src/app/(dashboard)/onboarding/calibration/page.tsx",
  "/relationship-workspaces": "src/app/(dashboard)/relationship-workspaces/page.tsx",
  "/settings/billing": "src/app/(dashboard)/settings/billing/page.tsx",
  "/settings/operations": "src/app/(dashboard)/settings/operations/page.tsx",
  "/settings/policy": "src/app/(dashboard)/settings/policy/page.tsx",
  "/settings/security": "src/app/(dashboard)/settings/security/page.tsx",
};

export const V10_ROUTE_API_CATALOG: readonly V10RouteApiContract[] = [
  {
    surface: "home",
    path: "/dashboard",
    methods: ["GET"],
    featureFamily: "settings",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "work",
    path: "/work",
    methods: ["GET"],
    featureFamily: "work",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "contracts",
    path: "/contracts",
    methods: ["GET"],
    featureFamily: "contracts",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "contracts",
    path: "/contracts/[id]",
    methods: ["GET"],
    featureFamily: "contracts",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "work",
    path: "/contracts/tasks",
    methods: ["GET"],
    featureFamily: "work",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "contracts",
    path: "/contracts/obligations",
    methods: ["GET"],
    featureFamily: "obligations",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "review",
    path: "/contracts/review",
    methods: ["GET"],
    featureFamily: "review",
    minimumMode: "core",
    minimumRole: "legal_reviewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "renewals",
    path: "/contracts/renewals",
    methods: ["GET"],
    featureFamily: "renewals",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "approvals",
    path: "/contracts/approvals",
    methods: ["GET"],
    featureFamily: "approvals",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "exceptions",
    path: "/contracts/exceptions",
    methods: ["GET"],
    featureFamily: "exceptions",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "approvals",
    path: "/api/approvals/[id]/[action]",
    methods: ["POST"],
    featureFamily: "approvals",
    minimumMode: "core",
    minimumRole: "editor",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: true,
    auditRequired: true,
    privateCacheRequired: true,
  },
  {
    surface: "exceptions",
    path: "/api/exceptions/[id]/[action]",
    methods: ["POST"],
    featureFamily: "exceptions",
    minimumMode: "core",
    minimumRole: "editor",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: true,
    auditRequired: true,
    privateCacheRequired: true,
  },
  {
    surface: "renewals",
    path: "/api/renewals/[id]/[action]",
    methods: ["POST"],
    featureFamily: "renewals",
    minimumMode: "core",
    minimumRole: "editor",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: true,
    auditRequired: true,
    privateCacheRequired: true,
  },
  {
    surface: "evidence",
    path: "/contracts/evidence-studio",
    methods: ["GET"],
    featureFamily: "evidence",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "command_search",
    path: "/api/command-palette/contracts",
    methods: ["GET"],
    featureFamily: "contracts",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "activation",
    path: "/api/import/contracts",
    methods: ["POST"],
    featureFamily: "intake",
    minimumMode: "core",
    minimumRole: "editor",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: true,
    auditRequired: true,
    privateCacheRequired: true,
  },
  {
    surface: "activation",
    path: "/api/import/contracts/[jobId]",
    methods: ["GET"],
    featureFamily: "intake",
    minimumMode: "core",
    minimumRole: "editor",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "activation",
    path: "/api/import/contracts/[jobId]",
    methods: ["POST"],
    featureFamily: "intake",
    minimumMode: "core",
    minimumRole: "editor",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: true,
    auditRequired: true,
    privateCacheRequired: true,
  },
  {
    surface: "evidence",
    path: "/api/evidence/submit",
    methods: ["POST"],
    featureFamily: "evidence",
    minimumMode: "core",
    minimumRole: "editor",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: true,
    auditRequired: true,
    privateCacheRequired: true,
  },
  {
    surface: "evidence",
    path: "/api/evidence/requests",
    methods: ["POST"],
    featureFamily: "evidence",
    minimumMode: "core",
    minimumRole: "editor",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: true,
    auditRequired: true,
    privateCacheRequired: true,
  },
  {
    surface: "evidence",
    path: "/api/evidence/[id]/[action]",
    methods: ["POST"],
    featureFamily: "evidence",
    minimumMode: "core",
    minimumRole: "legal_reviewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: true,
    auditRequired: true,
    privateCacheRequired: true,
  },
  {
    surface: "evidence",
    path: "/api/cron/v4/evidence-followup",
    methods: ["GET"],
    featureFamily: "evidence",
    minimumMode: "core",
    minimumRole: "admin",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: true,
    privateCacheRequired: true,
  },
  {
    surface: "exports",
    path: "/api/export/contracts",
    methods: ["GET"],
    featureFamily: "reports",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "core",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "exports",
    path: "/api/export/contracts",
    methods: ["POST"],
    featureFamily: "reports",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "core",
    authRequired: true,
    idempotencyRequired: true,
    auditRequired: true,
    privateCacheRequired: true,
  },
  {
    surface: "exports",
    path: "/api/export/contracts/[jobId]",
    methods: ["GET"],
    featureFamily: "reports",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "core",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "exports",
    path: "/api/export/contracts/[jobId]",
    methods: ["POST"],
    featureFamily: "reports",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "core",
    authRequired: true,
    idempotencyRequired: true,
    auditRequired: true,
    privateCacheRequired: true,
  },
  {
    surface: "reports",
    path: "/api/report-runs/[runId]/retry",
    methods: ["POST"],
    featureFamily: "reports",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "core",
    authRequired: true,
    idempotencyRequired: true,
    auditRequired: true,
    privateCacheRequired: true,
  },
  {
    surface: "reports",
    path: "/reports",
    methods: ["GET"],
    featureFamily: "reports",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "core",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "reports",
    path: "/contracts/reports",
    methods: ["GET"],
    featureFamily: "reports",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "core",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "reports",
    path: "/api/report-packs",
    methods: ["GET"],
    featureFamily: "reports",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "core",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "reports",
    path: "/api/report-packs",
    methods: ["POST"],
    featureFamily: "reports",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "core",
    authRequired: true,
    idempotencyRequired: true,
    auditRequired: true,
    privateCacheRequired: true,
  },
  {
    surface: "reports",
    path: "/api/reports/send-summaries",
    methods: ["GET"],
    featureFamily: "reports",
    minimumMode: "core",
    minimumRole: "admin",
    minimumPlan: "core",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: true,
    privateCacheRequired: true,
  },
  {
    surface: "contracts",
    path: "/api/contracts/recompute-signals",
    methods: ["GET"],
    featureFamily: "contracts",
    minimumMode: "core",
    minimumRole: "admin",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: true,
    privateCacheRequired: true,
  },
  {
    surface: "settings",
    path: "/api/cron/v10/idempotency-cleanup",
    methods: ["GET"],
    featureFamily: "settings",
    minimumMode: "core",
    minimumRole: "admin",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "settings",
    path: "/api/cron/v10/read-model-refresh",
    methods: ["GET"],
    featureFamily: "settings",
    minimumMode: "core",
    minimumRole: "admin",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: true,
    privateCacheRequired: true,
  },
  {
    surface: "settings",
    path: "/api/cron/v10/runtime-artifact-cleanup",
    methods: ["GET"],
    featureFamily: "settings",
    minimumMode: "core",
    minimumRole: "admin",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "settings",
    path: "/settings",
    methods: ["GET"],
    featureFamily: "settings",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "settings",
    path: "/settings/health",
    methods: ["GET"],
    featureFamily: "settings",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "settings",
    path: "/settings/product",
    methods: ["GET"],
    featureFamily: "settings",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "advanced",
    path: "/decisions",
    methods: ["GET"],
    featureFamily: "decisions",
    minimumMode: "advanced",
    minimumRole: "viewer",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "advanced",
    path: "/decisions/[id]",
    methods: ["GET"],
    featureFamily: "decisions",
    minimumMode: "advanced",
    minimumRole: "viewer",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "advanced",
    path: "/accounts/[key]",
    methods: ["GET"],
    featureFamily: "relationship_workspaces",
    minimumMode: "advanced",
    minimumRole: "viewer",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "advanced",
    path: "/counterparties/[key]",
    methods: ["GET"],
    featureFamily: "relationship_workspaces",
    minimumMode: "advanced",
    minimumRole: "viewer",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "advanced",
    path: "/campaigns/[id]",
    methods: ["GET"],
    featureFamily: "campaigns",
    minimumMode: "advanced",
    minimumRole: "viewer",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "advanced",
    path: "/campaigns/compare",
    methods: ["GET"],
    featureFamily: "simulations",
    minimumMode: "advanced",
    minimumRole: "viewer",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "assurance",
    path: "/assurance",
    methods: ["GET"],
    featureFamily: "findings",
    minimumMode: "assurance",
    minimumRole: "viewer",
    minimumPlan: "assurance",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "assurance",
    path: "/assurance/findings/[id]",
    methods: ["GET"],
    featureFamily: "findings",
    minimumMode: "assurance",
    minimumRole: "viewer",
    minimumPlan: "assurance",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "assurance",
    path: "/assurance/control-policies/[id]",
    methods: ["GET"],
    featureFamily: "control_policies",
    minimumMode: "assurance",
    minimumRole: "viewer",
    minimumPlan: "assurance",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "assurance",
    path: "/assurance/playbooks",
    methods: ["GET"],
    featureFamily: "playbooks",
    minimumMode: "assurance",
    minimumRole: "viewer",
    minimumPlan: "assurance",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "assurance",
    path: "/assurance/scorecards",
    methods: ["GET"],
    featureFamily: "scorecards",
    minimumMode: "assurance",
    minimumRole: "viewer",
    minimumPlan: "assurance",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "assurance",
    path: "/assurance/review-boards",
    methods: ["GET"],
    featureFamily: "review_boards",
    minimumMode: "assurance",
    minimumRole: "viewer",
    minimumPlan: "assurance",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "assurance",
    path: "/assurance/health-graph",
    methods: ["GET"],
    featureFamily: "health_graph",
    minimumMode: "assurance",
    minimumRole: "viewer",
    minimumPlan: "assurance",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "assurance",
    path: "/assurance/autopilot",
    methods: ["GET"],
    featureFamily: "autopilot",
    minimumMode: "assurance",
    minimumRole: "viewer",
    minimumPlan: "assurance",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "assurance",
    path: "/assurance/control-policies",
    methods: ["GET"],
    featureFamily: "control_policies",
    minimumMode: "assurance",
    minimumRole: "viewer",
    minimumPlan: "assurance",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "assurance",
    path: "/assurance/findings",
    methods: ["GET"],
    featureFamily: "findings",
    minimumMode: "assurance",
    minimumRole: "viewer",
    minimumPlan: "assurance",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "assurance",
    path: "/assurance/program-evolution",
    methods: ["GET"],
    featureFamily: "program_evolution",
    minimumMode: "assurance",
    minimumRole: "viewer",
    minimumPlan: "assurance",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "assurance",
    path: "/assurance/segments",
    methods: ["GET"],
    featureFamily: "segments",
    minimumMode: "assurance",
    minimumRole: "viewer",
    minimumPlan: "assurance",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "advanced",
    path: "/campaigns",
    methods: ["GET"],
    featureFamily: "campaigns",
    minimumMode: "advanced",
    minimumRole: "viewer",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "contracts",
    path: "/contracts/analytics",
    methods: ["GET"],
    featureFamily: "contracts",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "approvals",
    path: "/contracts/approvals/sla-simulator",
    methods: ["GET"],
    featureFamily: "approvals",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "approvals",
    path: "/contracts/approvals/workload",
    methods: ["GET"],
    featureFamily: "approvals",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "contracts",
    path: "/contracts/bulk",
    methods: ["GET"],
    featureFamily: "contracts",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "contracts",
    path: "/contracts/collaboration",
    methods: ["GET"],
    featureFamily: "contracts",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "contracts",
    path: "/contracts/data-quality",
    methods: ["GET"],
    featureFamily: "data_quality",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "contracts",
    path: "/contracts/execution-graph",
    methods: ["GET"],
    featureFamily: "contracts",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "activation",
    path: "/contracts/intake",
    methods: ["GET"],
    featureFamily: "intake",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "contracts",
    path: "/contracts/maintenance",
    methods: ["GET"],
    featureFamily: "contracts",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "contracts",
    path: "/contracts/new",
    methods: ["GET"],
    featureFamily: "contracts",
    minimumMode: "core",
    minimumRole: "editor",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "contracts",
    path: "/contracts/programs",
    methods: ["GET"],
    featureFamily: "programs",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "review",
    path: "/contracts/review-cadence",
    methods: ["GET"],
    featureFamily: "review",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "contracts",
    path: "/contracts/watchlists",
    methods: ["GET"],
    featureFamily: "contracts",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "home",
    path: "/dashboard/persona",
    methods: ["GET"],
    featureFamily: "settings",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "advanced",
    path: "/decisions/compare",
    methods: ["GET"],
    featureFamily: "decisions",
    minimumMode: "advanced",
    minimumRole: "viewer",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "advanced",
    path: "/decisions/review",
    methods: ["GET"],
    featureFamily: "decisions",
    minimumMode: "advanced",
    minimumRole: "viewer",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "home",
    path: "/more",
    methods: ["GET"],
    featureFamily: "settings",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "advanced",
    path: "/onboarding/calibration",
    methods: ["GET"],
    featureFamily: "onboarding",
    minimumMode: "advanced",
    minimumRole: "viewer",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "advanced",
    path: "/relationship-workspaces",
    methods: ["GET"],
    featureFamily: "relationship_workspaces",
    minimumMode: "advanced",
    minimumRole: "viewer",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "settings",
    path: "/settings/billing",
    methods: ["GET"],
    featureFamily: "settings",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "settings",
    path: "/settings/operations",
    methods: ["GET"],
    featureFamily: "settings",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "settings",
    path: "/settings/policy",
    methods: ["GET"],
    featureFamily: "settings",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "settings",
    path: "/settings/security",
    methods: ["GET"],
    featureFamily: "settings",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: true,
  },
  {
    surface: "settings",
    path: "/api/me/account",
    methods: ["DELETE"],
    featureFamily: "settings",
    minimumMode: "core",
    minimumRole: "admin",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "settings",
    path: "/api/settings/step-up",
    methods: ["POST"],
    featureFamily: "settings",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "assurance",
    path: "/api/assurance/checks/run",
    methods: ["POST"],
    featureFamily: "assurance",
    minimumMode: "assurance",
    minimumRole: "editor",
    minimumPlan: "assurance",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "assurance",
    path: "/api/assurance/external-links/[id]/response-pack",
    methods: ["POST"],
    featureFamily: "assurance",
    minimumMode: "assurance",
    minimumRole: "editor",
    minimumPlan: "assurance",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "assurance",
    path: "/api/assurance/findings/[id]/resolve",
    methods: ["POST"],
    featureFamily: "assurance",
    minimumMode: "assurance",
    minimumRole: "editor",
    minimumPlan: "assurance",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "assurance",
    path: "/api/assurance/workflows/run-all",
    methods: ["POST"],
    featureFamily: "assurance",
    minimumMode: "assurance",
    minimumRole: "editor",
    minimumPlan: "assurance",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "evidence",
    path: "/api/attestations/[id]/respond",
    methods: ["POST"],
    featureFamily: "attestations",
    minimumMode: "core",
    minimumRole: "editor",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/autopilot/rules/[id]/dry-run",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/autopilot/rules/[id]/enable",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/autopilot/rules/[id]",
    methods: ["DELETE"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/autopilot/rules/[id]",
    methods: ["PATCH"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/autopilot/rules",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/autopilot/run-logs/[id]/revert",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/campaigns/[id]/close",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/campaigns/[id]/contracts/[rowId]",
    methods: ["PATCH"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/campaigns/[id]/pause",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/campaigns/[id]/preview",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/campaigns/[id]/resume",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/campaigns/[id]/rollback",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/campaigns/[id]",
    methods: ["PATCH"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/campaigns/[id]/start",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/campaigns",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/capacity/reassignment-plan",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/command-centers/preferences",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/control-policies/[id]/assign",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/control-policies/[id]/publish",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/control-policies/[id]",
    methods: ["PATCH"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/control-policies/[id]/simulate",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/control-policies",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/decisions/[id]/approve",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/decisions/[id]/close",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/decisions/[id]/packet",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/decisions/[id]/recommend",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/decisions/[id]/review",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/decisions/[id]",
    methods: ["PATCH"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/decisions/[id]/stakeholders",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/decisions/packet-templates/[id]",
    methods: ["DELETE"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/decisions/packet-templates/[id]",
    methods: ["PATCH"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/decisions/packet-templates",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/decisions",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "exceptions",
    path: "/api/exceptions/run-detection",
    methods: ["POST"],
    featureFamily: "exceptions",
    minimumMode: "core",
    minimumRole: "editor",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "evidence",
    path: "/api/external-actions/[token]/participant/workflow-step",
    methods: ["POST"],
    featureFamily: "external_actions",
    minimumMode: "core",
    minimumRole: "editor",
    minimumPlan: "trial",
    authRequired: false,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "opaque_token_json",
  },
  {
    surface: "evidence",
    path: "/api/external-actions/[token]/submit",
    methods: ["POST"],
    featureFamily: "external_actions",
    minimumMode: "core",
    minimumRole: "editor",
    minimumPlan: "trial",
    authRequired: false,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "opaque_token_json",
  },
  {
    surface: "evidence",
    path: "/api/external-actions/[token]/workflow-step",
    methods: ["POST"],
    featureFamily: "external_actions",
    minimumMode: "core",
    minimumRole: "editor",
    minimumPlan: "trial",
    authRequired: false,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "opaque_token_json",
  },
  {
    surface: "evidence",
    path: "/api/external-actions/create-link",
    methods: ["POST"],
    featureFamily: "external_actions",
    minimumMode: "core",
    minimumRole: "editor",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "activation",
    path: "/api/extract",
    methods: ["POST"],
    featureFamily: "extraction",
    minimumMode: "core",
    minimumRole: "editor",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "activation",
    path: "/api/extract/run",
    methods: ["POST"],
    featureFamily: "extraction",
    minimumMode: "core",
    minimumRole: "editor",
    minimumPlan: "trial",
    authRequired: false,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "worker_bearer_json",
  },
  {
    surface: "advanced",
    path: "/api/integrations/actions/callback",
    methods: ["POST"],
    featureFamily: "integrations",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: false,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "integration_inbound",
  },
  {
    surface: "advanced",
    path: "/api/integrations/oauth/start",
    methods: ["POST"],
    featureFamily: "integrations",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/integrations/slack/renewal-summary",
    methods: ["POST"],
    featureFamily: "integrations",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/intelligence/recommendations/[id]",
    methods: ["PATCH"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/maintenance/campaigns/[id]/rollback",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/maintenance/campaigns/[id]/run",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/maintenance/campaigns",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/playbooks/[id]/preview",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/playbooks/[id]/run",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/playbooks",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/playbooks/runs/[id]/approve",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/policy/simulate",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "settings",
    path: "/api/product-telemetry/page-load",
    methods: ["POST"],
    featureFamily: "telemetry",
    minimumMode: "core",
    minimumRole: "viewer",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/program-evolution/experiments/[id]/advance-rollout",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/program-evolution/experiments/[id]/results",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/program-evolution/experiments/[id]/simulate",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/program-evolution/experiments",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/programs/[id]/[action]",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/programs",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/review-boards/[id]/generate-run",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/review-boards/[id]",
    methods: ["PATCH"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/review-boards",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/review-boards/runs/[id]",
    methods: ["PATCH"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/segments/[id]/recompute",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/segments",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/simulations/[id]/promote-to-campaign",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "advanced",
    path: "/api/simulations/run",
    methods: ["POST"],
    featureFamily: "advanced",
    minimumMode: "advanced",
    minimumRole: "editor",
    minimumPlan: "advanced",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "settings",
    path: "/api/stripe/checkout",
    methods: ["POST"],
    featureFamily: "billing",
    minimumMode: "core",
    minimumRole: "admin",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "settings",
    path: "/api/stripe/portal",
    methods: ["POST"],
    featureFamily: "billing",
    minimumMode: "core",
    minimumRole: "admin",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
  {
    surface: "settings",
    path: "/api/stripe/webhook",
    methods: ["POST"],
    featureFamily: "billing",
    minimumMode: "core",
    minimumRole: "editor",
    minimumPlan: "trial",
    authRequired: false,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "stripe_signed_webhook",
  },
  {
    surface: "work",
    path: "/api/tasks/from-email",
    methods: ["POST"],
    featureFamily: "work",
    minimumMode: "core",
    minimumRole: "editor",
    minimumPlan: "trial",
    authRequired: false,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "integration_inbound",
  },
  {
    surface: "work",
    path: "/api/tasks/from-slack",
    methods: ["POST"],
    featureFamily: "work",
    minimumMode: "core",
    minimumRole: "editor",
    minimumPlan: "trial",
    authRequired: false,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "integration_inbound",
  },
  {
    surface: "settings",
    path: "/api/webhooks/dispatch",
    methods: ["POST"],
    featureFamily: "webhooks",
    minimumMode: "core",
    minimumRole: "editor",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "cron_secret_json",
  },
  {
    surface: "settings",
    path: "/api/workspace/v6-settings",
    methods: ["PATCH"],
    featureFamily: "settings",
    minimumMode: "core",
    minimumRole: "editor",
    minimumPlan: "trial",
    authRequired: true,
    idempotencyRequired: false,
    auditRequired: false,
    privateCacheRequired: false,
    postContract: "session_json",
  },
] as const;

export const V10_ROUTER_JOBS_REPORTS_BOUNDARY_CONTRACTS: readonly V10RouterJobsReportsBoundaryContract[] = [
  {
    domain: "command_search",
    primaryRoute: "/api/command-palette/contracts",
    readModels: ["command_search_index"],
    jobOrNotificationClasses: [],
    recoveryDestination: "/settings/health#search",
    requiredProofs: ["src/app/api/command-palette/contracts/route.ts", "src/components/layout/command-palette.tsx"],
    privateCacheRequired: true,
    supportSafe: true,
  },
  {
    domain: "navigation",
    primaryRoute: "/dashboard",
    readModels: ["work_items", "contract_health_snapshots", "command_search_index"],
    jobOrNotificationClasses: [],
    recoveryDestination: "/dashboard",
    requiredProofs: ["src/components/layout/header.tsx", "src/components/layout/command-palette.tsx"],
    privateCacheRequired: true,
    supportSafe: true,
  },
  {
    domain: "reports",
    primaryRoute: "/api/report-packs",
    readModels: ["report_run_visibility", "job_run_visibility"],
    jobOrNotificationClasses: ["report_generation", "report_delivery"],
    recoveryDestination: "/settings/health#v10-jobs",
    requiredProofs: ["src/lib/v10-report-export.ts", "src/app/api/report-packs/route.ts"],
    privateCacheRequired: true,
    supportSafe: true,
  },
  {
    domain: "exports",
    primaryRoute: "/api/export/contracts",
    readModels: ["job_run_visibility", "runtime_artifacts"],
    jobOrNotificationClasses: ["export"],
    recoveryDestination: "/settings/health#artifacts",
    requiredProofs: ["src/lib/v10-report-export.ts", "src/app/api/export/contracts/route.ts"],
    privateCacheRequired: true,
    supportSafe: true,
  },
  {
    domain: "jobs",
    primaryRoute: "/settings/health",
    readModels: ["job_run_visibility", "work_items"],
    jobOrNotificationClasses: ["contract_import", "extraction", "export", "report_generation", "automation_execution", "billing_sync"],
    recoveryDestination: "/settings/health#v10-jobs",
    requiredProofs: ["src/lib/v10-job-visibility.ts", "src/app/(dashboard)/settings/health/page.tsx"],
    privateCacheRequired: true,
    supportSafe: true,
  },
  {
    domain: "notifications",
    primaryRoute: "/settings/product",
    readModels: ["notification_deliveries", "work_items"],
    jobOrNotificationClasses: ["due_work", "pending_approval", "evidence_request", "failed_export", "automation_approval_required"],
    recoveryDestination: "/settings/product#notifications",
    requiredProofs: ["src/lib/v10-job-visibility.ts", "src/actions/product-surface-settings.ts"],
    privateCacheRequired: true,
    supportSafe: true,
  },
  {
    domain: "settings_governance",
    primaryRoute: "/settings/product",
    readModels: ["activation_state", "job_run_visibility", "command_search_index"],
    jobOrNotificationClasses: [],
    recoveryDestination: "/settings/product",
    requiredProofs: ["src/lib/v10-governance.ts", "src/actions/product-surface-settings.ts"],
    privateCacheRequired: true,
    supportSafe: true,
  },
  {
    domain: "support_diagnostics",
    primaryRoute: "/settings/health",
    readModels: ["job_run_visibility", "report_run_visibility", "audit_events"],
    jobOrNotificationClasses: ["contract_import", "report_generation", "notification_delivery"],
    recoveryDestination: "/settings/health#support",
    requiredProofs: ["src/lib/v10-operational-contracts.ts", "src/app/(dashboard)/settings/health/page.tsx"],
    privateCacheRequired: true,
    supportSafe: true,
  },
  {
    domain: "provider_boundary",
    primaryRoute: "/settings/health",
    readModels: ["job_run_visibility", "runtime_artifacts"],
    jobOrNotificationClasses: ["notification_delivery", "extraction", "billing_sync"],
    recoveryDestination: "/settings/health#providers",
    requiredProofs: ["src/lib/v10-operational-contracts.ts", "src/lib/v10-release-evidence.ts"],
    privateCacheRequired: true,
    supportSafe: true,
  },
  {
    domain: "billing_boundary",
    primaryRoute: "/settings/product",
    readModels: ["activation_state", "job_run_visibility"],
    jobOrNotificationClasses: ["billing_sync"],
    recoveryDestination: "/settings/product#billing",
    requiredProofs: ["src/lib/v10-governance.ts", "src/actions/product-surface-settings.ts"],
    privateCacheRequired: true,
    supportSafe: true,
  },
] as const;

export const V10_ROUTE_PERFORMANCE_SMOKE_CONTRACTS: readonly V10RoutePerformanceSmokeContract[] = [
  {
    budgetKind: "dashboard",
    route: "/dashboard",
    proofArtifact: "e2e/v10-core-smoke.spec.ts",
    measurement: "integration_smoke",
    seededFixtureRequired: true,
    optionalLoadSmokeScript: "k6/smoke.js",
    loadSmokePaths: ["/dashboard"],
  },
  {
    budgetKind: "contract_list",
    route: "/contracts",
    proofArtifact: "e2e/v10-core-smoke.spec.ts",
    measurement: "integration_smoke",
    seededFixtureRequired: true,
    optionalLoadSmokeScript: "k6/smoke.js",
    loadSmokePaths: ["/contracts"],
  },
  {
    budgetKind: "command_palette",
    route: "/api/command-palette/contracts",
    proofArtifact: "src/components/layout/command-palette.ui.test.tsx",
    measurement: "unit_integration",
    seededFixtureRequired: false,
    optionalLoadSmokeScript: null,
    loadSmokePaths: [],
  },
  {
    budgetKind: "work_review_queue",
    route: "/work",
    proofArtifact: "e2e/v10-core-smoke.spec.ts",
    measurement: "integration_smoke",
    seededFixtureRequired: true,
    optionalLoadSmokeScript: "k6/smoke.js",
    loadSmokePaths: ["/work"],
  },
] as const;

export function getV10RouteContractsForSurface(surface: V10RouteSurface): V10RouteApiContract[] {
  return V10_ROUTE_API_CATALOG.filter((contract) => contract.surface === surface);
}

export function v10RouteRequiresPrivateCache(path: string): boolean {
  return V10_ROUTE_API_CATALOG.some((contract) => contract.path === path && contract.privateCacheRequired);
}

export function validateV10RouterJobsReportsBoundaryContracts(
  contracts: readonly V10RouterJobsReportsBoundaryContract[] = V10_ROUTER_JOBS_REPORTS_BOUNDARY_CONTRACTS
): string[] {
  const failures: string[] = [];
  const catalogPaths = new Set(V10_ROUTE_API_CATALOG.map((route) => route.path));
  const seen = new Set<V10RouterJobsReportsBoundaryDomain>();
  for (const contract of contracts) {
    if (seen.has(contract.domain)) failures.push(`duplicate_boundary:${contract.domain}`);
    seen.add(contract.domain);
    if (!catalogPaths.has(contract.primaryRoute)) failures.push(`${contract.domain}:route_not_in_catalog`);
    if (contract.readModels.length === 0) failures.push(`${contract.domain}:read_model_required`);
    if (!contract.recoveryDestination.startsWith("/")) failures.push(`${contract.domain}:recovery_destination_required`);
    if (contract.requiredProofs.length === 0) failures.push(`${contract.domain}:proof_required`);
    if (!contract.privateCacheRequired) failures.push(`${contract.domain}:private_cache_required`);
    if (!contract.supportSafe) failures.push(`${contract.domain}:support_safe_required`);
    if ((contract.domain === "jobs" || contract.domain === "reports" || contract.domain === "exports") && contract.jobOrNotificationClasses.length === 0) {
      failures.push(`${contract.domain}:job_class_required`);
    }
  }
  for (const domain of [
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
  ] as const) {
    if (!seen.has(domain)) failures.push(`boundary_missing:${domain}`);
  }
  return failures;
}

function routePathMatchesHref(routePath: string, hrefPath: string): boolean {
  const routeSegments = routePath.split("/").filter(Boolean);
  const hrefSegments = hrefPath.split("/").filter(Boolean);
  if (routeSegments.length !== hrefSegments.length) return false;
  return routeSegments.every((segment, index) => segment.startsWith("[") || segment === hrefSegments[index]);
}

export function getV10RouteTemplateForHref(href: string): string | null {
  if (!href.startsWith("/") || href.startsWith("//")) return null;
  const hrefPath = href.split(/[?#]/)[0] || "/";
  const sortedRoutes = [...V10_ROUTE_API_CATALOG].sort((a, b) => {
    const aDynamicCount = a.path.split("/").filter((segment) => segment.startsWith("[")).length;
    const bDynamicCount = b.path.split("/").filter((segment) => segment.startsWith("[")).length;
    return aDynamicCount - bDynamicCount || b.path.length - a.path.length;
  });
  return sortedRoutes.find((contract) => routePathMatchesHref(contract.path, hrefPath))?.path ?? null;
}

export function getV10RouteRuntimeArtifact(path: string): string {
  if (path.startsWith("/api/")) {
    return `src/app/${path.slice(1)}/route.ts`;
  }
  return V10_DASHBOARD_PAGE_ARTIFACTS[path] ?? `src/app/(dashboard)${path}/page.tsx`;
}

export function getV10RouteTestArtifact(path: string): string {
  const runtimeArtifact = getV10RouteRuntimeArtifact(path);
  if (runtimeArtifact.endsWith("/page.tsx")) {
    return "e2e/v10-core-smoke.spec.ts";
  }
  if (path === "/api/command-palette/contracts") {
    return "src/app/api/command-palette/contracts/route.v10.test.ts";
  }
  const routeTs = resolveV10RouteCatalogArtifact(runtimeArtifact);
  const dir = join(routeTs, "..");
  const plain = join(dir, "route.test.ts");
  if (existsSync(plain)) {
    return toV10RouteCatalogRepoPath(plain);
  }
  const v10 = join(dir, "route.v10.test.ts");
  if (existsSync(v10)) {
    return toV10RouteCatalogRepoPath(v10);
  }
  return "e2e/v10-core-smoke.spec.ts";
}

export function validateV10RouteApiContract(contract: V10RouteApiContract): string[] {
  const failures: string[] = [];
  const resolved = resolveV10RoutePostContract(contract);
  if (!contract.path.startsWith("/")) failures.push("path_must_be_absolute");
  if (contract.methods.length === 0) failures.push("method_required");
  if (contract.postContract && resolved === "read_only") {
    failures.push("post_contract_must_not_apply_to_get_only_routes");
  }
  if (!contract.privateCacheRequired && !allowsOptionalPrivateCacheHeader(contract, resolved)) {
    failures.push("private_cache_required");
  }
  if (resolved === "v10_mutation_envelope") {
    if (contract.idempotencyRequired && !contract.auditRequired) failures.push("idempotent_mutation_requires_audit");
    if (contract.methods.some((m) => m !== "GET")) {
      if (!contract.idempotencyRequired || !contract.auditRequired) {
        failures.push("v10_mutation_envelope_requires_idempotency_and_audit");
      }
    }
  } else if (resolved !== "read_only") {
    if (contract.idempotencyRequired || contract.auditRequired) {
      failures.push("catalog_legacy_post_must_not_require_idempotency_or_audit");
    }
  }
  if (!contract.authRequired && !allowsUnauthenticatedApiRoute(contract, resolved)) {
    failures.push("unauthenticated_route_must_be_external_evidence");
  }
  if (!contract.minimumMode || !contract.minimumRole || !contract.minimumPlan) failures.push("eligibility_metadata_required");
  return failures;
}

export function buildV10RouteApiInventory(
  catalog: readonly V10RouteApiContract[] = V10_ROUTE_API_CATALOG
): V10RouteApiInventoryRow[] {
  return catalog.map((contract) => {
    const resolved = resolveV10RoutePostContract(contract);
    const mutating = resolved !== "read_only";
    const cron =
      contract.path.includes("/cron/") ||
      contract.path.includes("/recompute-signals") ||
      resolved === "cron_secret_json";
    const workerBearer = resolved === "worker_bearer_json";
    const external =
      !contract.authRequired &&
      (contract.path.includes("/api/evidence/") ||
        contract.path.includes("/api/external-actions/") ||
        resolved === "opaque_token_json" ||
        workerBearer);
    const stateChanging = mutating;
    const mutationEnvelope = resolved === "v10_mutation_envelope" && stateChanging;
    const performanceMetadata = getV10RoutePerformanceMetadata(contract);
    const diagnosticStem = contract.path
      .replace(/^\/api\//, "")
      .replace(/^\//, "")
      .replace(/\[[^\]]+\]/g, "param")
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase();
    return {
      ...contract,
      authType: cron ? "cron_secret" : external ? "external_token" : "session",
      capability: `${contract.featureFamily}:${stateChanging ? "mutate" : "read"}`,
      routeOwner: cron ? "operations" : contract.surface === "settings" ? "security" : contract.surface === "reports" || contract.surface === "exports" ? "release" : "engineering",
      diagnosticPrefix: `v10_${diagnosticStem || "route"}` as `v10_${string}`,
      errorStatusCodes: cron
        ? ([401, 429, 500] as const)
        : stateChanging
          ? external
            ? ([400, 401, 403, 404, 409, 410, 424, 429, 500] as const)
            : ([400, 401, 403, 404, 409, 424, 429, 500] as const)
          : external
            ? ([400, 404, 410, 429, 500] as const)
            : ([401, 403, 404, 429, 500] as const),
      rateLimitPolicy: cron ? "cron" : external ? "external_link" : stateChanging ? "mutation" : "standard_user",
      cachePolicy: "private_no_store",
      paginationPolicy: getV10RoutePaginationPolicy(contract),
      ...performanceMetadata,
      responseSchema: contract.path.startsWith("/api/")
        ? stateChanging
          ? mutationEnvelope
            ? "v10_mutation_envelope"
            : "collection"
          : contract.path.includes("jobId")
            ? "job_visibility"
            : "collection"
        : "page_html",
      recoveryBehavior:
        contract.surface === "activation" || contract.surface === "exports" || contract.surface === "reports"
          ? "retryable_job"
          : external
            ? "external_resubmission"
            : contract.surface === "settings"
              ? "settings_health"
              : "recoverable_state",
    };
  });
}

export function validateV10RouteApiInventory(rows: readonly V10RouteApiInventoryRow[] = buildV10RouteApiInventory()): string[] {
  const failures = rows.flatMap((row) => validateV10RouteApiContract(row).map((failure) => `${row.path}:${failure}`));
  for (const row of rows) {
    if (!row.capability.includes(":")) failures.push(`${row.path}:capability_required`);
    if (!row.diagnosticPrefix.startsWith("v10_")) failures.push(`${row.path}:diagnostic_prefix_required`);
    if (row.errorStatusCodes.length === 0) failures.push(`${row.path}:error_status_codes_required`);
    if (row.authRequired && !row.errorStatusCodes.includes(401)) failures.push(`${row.path}:auth_error_schema_required`);
    if (row.idempotencyRequired && !row.errorStatusCodes.includes(409)) failures.push(`${row.path}:idempotency_conflict_schema_required`);
    if (row.recoveryBehavior === "external_resubmission" && !row.errorStatusCodes.includes(410)) {
      failures.push(`${row.path}:external_link_gone_schema_required`);
    }
    if (row.cachePolicy !== "private_no_store") failures.push(`${row.path}:private_no_store_required`);
    if (row.authType === "cron_secret" && row.rateLimitPolicy !== "cron") failures.push(`${row.path}:cron_rate_limit_required`);
    if (row.idempotencyRequired && row.responseSchema !== "v10_mutation_envelope") {
      failures.push(`${row.path}:mutation_envelope_schema_required`);
    }
    if (row.paginationPolicy === "bounded_limit" && row.recoveryBehavior !== "recoverable_state") {
      failures.push(`${row.path}:bounded_lists_need_recoverable_state`);
    }
    if (row.performanceBudgetKind === "contract_list") {
      if (row.pageSizeExpectation !== V10_PERFORMANCE_BUDGETS.contract_list_pagination_threshold_rows) {
        failures.push(`${row.path}:contract_list_page_size_required`);
      }
      if (row.virtualizationThresholdRows !== V10_PERFORMANCE_BUDGETS.visible_row_virtualization_threshold_rows) {
        failures.push(`${row.path}:contract_list_virtualization_threshold_required`);
      }
      if (row.paginationPolicy !== "bounded_limit") failures.push(`${row.path}:contract_list_bounded_limit_required`);
    }
    if (row.performanceBudgetKind === "command_palette") {
      if (row.debounceWindowMs?.min !== V10_PERFORMANCE_BUDGETS.command_palette_debounce_min_ms) {
        failures.push(`${row.path}:command_palette_debounce_min_required`);
      }
      if (row.debounceWindowMs?.max !== V10_PERFORMANCE_BUDGETS.command_palette_debounce_max_ms) {
        failures.push(`${row.path}:command_palette_debounce_max_required`);
      }
      if (row.paginationPolicy !== "bounded_limit") failures.push(`${row.path}:command_palette_bounded_limit_required`);
    }
    if (row.performanceBudgetKind === "work_review_queue" && row.paginationPolicy !== "bounded_limit") {
      failures.push(`${row.path}:work_review_queue_bounded_limit_required`);
    }
    if (row.performanceBudgetKind === "report_export") {
      if (row.asyncHandoffThresholds?.rowCount !== V10_PERFORMANCE_BUDGETS.report_export_async_row_threshold) {
        failures.push(`${row.path}:report_export_async_row_threshold_required`);
      }
      if (row.asyncHandoffThresholds?.jsonBytes !== V10_PERFORMANCE_BUDGETS.report_export_async_json_bytes_threshold) {
        failures.push(`${row.path}:report_export_async_json_threshold_required`);
      }
      if (row.asyncHandoffThresholds?.estimatedExecutionMs !== V10_PERFORMANCE_BUDGETS.report_export_async_execution_ms_threshold) {
        failures.push(`${row.path}:report_export_async_execution_threshold_required`);
      }
    }
    if (row.path === "/dashboard" && row.queryPlanExpectation !== "core_mode_excludes_advanced_assurance_tables") {
      failures.push(`${row.path}:core_mode_query_plan_expectation_required`);
    }
  }
  return failures;
}

export function validateV10RoutePerformanceSmokeContracts(
  contracts: readonly V10RoutePerformanceSmokeContract[] = V10_ROUTE_PERFORMANCE_SMOKE_CONTRACTS,
  inventory: readonly V10RouteApiInventoryRow[] = buildV10RouteApiInventory()
): string[] {
  const failures: string[] = [];
  const inventoryByPath = new Map(inventory.map((row) => [row.path, row]));
  const seen = new Set<V10RoutePerformanceSmokeContract["budgetKind"]>();
  for (const contract of contracts) {
    if (seen.has(contract.budgetKind)) failures.push(`duplicate_performance_smoke:${contract.budgetKind}`);
    seen.add(contract.budgetKind);
    const routeInventory = inventoryByPath.get(contract.route);
    if (!routeInventory) failures.push(`${contract.budgetKind}:route_not_in_inventory`);
    if (routeInventory && routeInventory.performanceBudgetKind !== contract.budgetKind) {
      failures.push(`${contract.budgetKind}:budget_kind_mismatch`);
    }
    if (!contract.proofArtifact.trim() || !existsSync(resolveV10RouteCatalogArtifact(contract.proofArtifact))) {
      failures.push(`${contract.budgetKind}:proof_artifact_required`);
    }
    if (contract.optionalLoadSmokeScript && !existsSync(resolveV10RouteCatalogArtifact(contract.optionalLoadSmokeScript))) {
      failures.push(`${contract.budgetKind}:load_smoke_script_required`);
    }
    if ((contract.measurement === "integration_smoke" || contract.measurement === "k6_optional") && contract.loadSmokePaths.length === 0) {
      failures.push(`${contract.budgetKind}:load_smoke_path_required`);
    }
  }
  for (const required of ["dashboard", "contract_list", "command_palette", "work_review_queue"] as const) {
    if (!seen.has(required)) failures.push(`performance_smoke_missing:${required}`);
  }
  return failures;
}

export function buildV10RouteActionInventory(): V10RouteActionInventoryRow[] {
  return V10_REQUIRED_MUTATION_CONTRACTS.map((contract) => ({
    mutationName: contract.key,
    routePath: contract.runtimeArtifact.startsWith("src/app/api/")
      ? `/${contract.runtimeArtifact.replace(/^src\/app\//, "").replace(/\/route\.ts$/, "")}`
      : null,
    runtimeArtifact: contract.runtimeArtifact,
    auditAction: contract.auditAction,
    minimumRole: contract.minimumRole as V10Role,
    idempotencyRequired: true,
    auditRequired: true,
    responseSchema: "v10_mutation_envelope",
  }));
}

export function validateV10RouteActionInventory(rows: readonly V10RouteActionInventoryRow[] = buildV10RouteActionInventory()): string[] {
  const failures: string[] = [];
  const catalogByPath = new Map(V10_ROUTE_API_CATALOG.map((contract) => [contract.path, contract]));
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.mutationName)) failures.push(`duplicate_mutation:${row.mutationName}`);
    seen.add(row.mutationName);
    if (!row.runtimeArtifact) failures.push(`${row.mutationName}:runtime_artifact_required`);
    if (!row.auditAction?.includes(".")) failures.push(`${row.mutationName}:audit_action_required`);
    if (!row.idempotencyRequired) failures.push(`${row.mutationName}:idempotency_required`);
    if (!row.auditRequired) failures.push(`${row.mutationName}:audit_required`);
    if (row.responseSchema !== "v10_mutation_envelope") failures.push(`${row.mutationName}:mutation_envelope_required`);
    if (row.routePath) {
      const route = catalogByPath.get(row.routePath);
      if (!route) {
        failures.push(`${row.mutationName}:route_catalog_missing`);
      } else {
        if (!route.idempotencyRequired) failures.push(`${row.mutationName}:route_idempotency_missing`);
        if (!route.auditRequired) failures.push(`${row.mutationName}:route_audit_missing`);
        if (!route.methods.includes("POST")) failures.push(`${row.mutationName}:state_change_post_required`);
      }
    }
  }
  return failures;
}

export function validateV10RouteResponseContract(input: {
  inventoryRow: V10RouteApiInventoryRow;
  headers: Record<string, string | null | undefined>;
  body: unknown;
  replayed?: boolean;
  itemCount?: number | null;
  maxItems?: number;
}): string[] {
  const failures: string[] = [];
  const cacheControl = input.headers["cache-control"] ?? input.headers["Cache-Control"];
  if (input.inventoryRow.cachePolicy === "private_no_store" && cacheControl !== "private, no-store") {
    failures.push("private_no_store_header_required");
  }
  if (input.inventoryRow.paginationPolicy === "bounded_limit") {
    const maxItems = input.maxItems ?? 50;
    if ((input.itemCount ?? 0) > maxItems) failures.push("bounded_limit_exceeded");
  }
  if (input.inventoryRow.responseSchema === "v10_mutation_envelope") {
    const body = input.body as Partial<V10MutationResponse> | null;
    if (!body || typeof body !== "object" || !isV10MutationOutcome(String(body.outcome))) {
      failures.push("mutation_outcome_required");
      return failures;
    }
    failures.push(...validateV10ApiResponseSchema(body as V10MutationResponse, { replayed: input.replayed }));
    if (!input.headers["x-v10-idempotent-replay"] && !input.headers["X-V10-Idempotent-Replay"]) {
      failures.push("idempotent_replay_header_required");
    }
  }
  if (input.inventoryRow.recoveryBehavior === "retryable_job") {
    const body = input.body as {
      retry_action?: unknown;
      diagnostic_id?: unknown;
      v10_job_visibility?: { retry_action?: unknown; diagnostic_id?: unknown } | null;
      v10_report_visibility?: { retry_action?: unknown; diagnostic_id?: unknown } | null;
    } | null;
    const retryAction =
      body?.retry_action ?? body?.v10_job_visibility?.retry_action ?? body?.v10_report_visibility?.retry_action;
    const diagnosticId =
      body?.diagnostic_id ?? body?.v10_job_visibility?.diagnostic_id ?? body?.v10_report_visibility?.diagnostic_id;
    if (retryAction && !diagnosticId) failures.push("retryable_job_diagnostic_required");
  }
  return failures;
}
