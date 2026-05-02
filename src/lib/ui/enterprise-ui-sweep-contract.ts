export type EnterpriseUiSweepTodoId =
  | "advanced-surfaces"
  | "copy-and-terminology"
  | "route-inventory"
  | "role-mode-coverage"
  | "forms-recoverability"
  | "accessibility-performance"
  | "acceptance-matrix"
  | "telemetry-docs-release"
  | "fixtures-visuals"
  | "privacy-security-ui"
  | "locale-theme-browser"
  | "rollout-monitoring";

export type EnterpriseUiRoutePattern =
  | "triage-first"
  | "queue-first"
  | "table-first"
  | "detail-first"
  | "configuration-first"
  | "diagnostics-first-when-abnormal"
  | "advanced-analysis-first";

export type EnterpriseUiStateCoverage =
  | "active-risk"
  | "all-clear"
  | "filtered-empty"
  | "partial-data"
  | "failed"
  | "forbidden"
  | "not-found"
  | "loading"
  | "mobile"
  | "keyboard";

export type EnterpriseUiRouteInventoryRow = {
  route: string;
  ownerArtifact: string;
  primaryPattern: EnterpriseUiRoutePattern;
  firstFoldAnswer: string;
  states: readonly EnterpriseUiStateCoverage[];
  roleModes: readonly string[];
  evidenceArtifacts: readonly string[];
};

export type EnterpriseUiComponentContractRow = {
  component: string;
  artifact: string;
  density: readonly ("hero" | "standard" | "compact" | "dense" | "disclosure")[];
  requiredBehaviors: readonly string[];
  telemetryOrA11yContract: string;
};

export type EnterpriseUiSweepLedgerRow = {
  id: EnterpriseUiSweepTodoId;
  status: "verified";
  artifacts: readonly string[];
  gates: readonly string[];
  acceptanceEvidence: readonly string[];
};

export const ENTERPRISE_UI_SWEEP_REMAINING_IDS: readonly EnterpriseUiSweepTodoId[] = [
  "advanced-surfaces",
  "copy-and-terminology",
  "route-inventory",
  "role-mode-coverage",
  "forms-recoverability",
  "accessibility-performance",
  "acceptance-matrix",
  "telemetry-docs-release",
  "fixtures-visuals",
  "privacy-security-ui",
  "locale-theme-browser",
  "rollout-monitoring",
] as const;

export const ENTERPRISE_UI_ROUTE_INVENTORY: readonly EnterpriseUiRouteInventoryRow[] = [
  {
    route: "/dashboard",
    ownerArtifact: "src/app/(dashboard)/dashboard/page.tsx",
    primaryPattern: "triage-first",
    firstFoldAnswer: "exceptions, decisions, failed automation, owner gaps, deadlines, then quiet all-clear",
    states: ["active-risk", "all-clear", "partial-data", "loading", "mobile", "keyboard"],
    roleModes: ["viewer", "manager", "admin", "core", "advanced", "assurance"],
    evidenceArtifacts: ["src/components/ui/operational-summary-card.tsx", "src/lib/ui/operational-priority.ts"],
  },
  {
    route: "/work",
    ownerArtifact: "src/app/(dashboard)/work/page.tsx",
    primaryPattern: "queue-first",
    firstFoldAnswer: "highest-priority work, owner, due state, blocker, and next action",
    states: ["active-risk", "all-clear", "filtered-empty", "partial-data", "loading", "mobile", "keyboard"],
    roleModes: ["viewer", "editor", "manager", "admin", "core", "advanced", "assurance"],
    evidenceArtifacts: ["src/lib/work-hub-lens.ts", "src/components/ui/queue-item-card.tsx"],
  },
  {
    route: "/contracts",
    ownerArtifact: "src/app/(dashboard)/contracts/page.tsx",
    primaryPattern: "table-first",
    firstFoldAnswer: "contract next action, deadline/risk, owner, status, and updated time",
    states: ["active-risk", "all-clear", "filtered-empty", "failed", "loading", "mobile", "keyboard"],
    roleModes: ["viewer", "editor", "legal_reviewer", "finance_reviewer", "manager", "admin"],
    evidenceArtifacts: ["src/components/contracts/contract-table.tsx", "src/components/contracts/contract-table.ui.test.tsx"],
  },
  {
    route: "/contracts/[id]",
    ownerArtifact: "src/app/(dashboard)/contracts/[id]/page.tsx",
    primaryPattern: "detail-first",
    firstFoldAnswer: "contract identity, immediate action, risk/deadline, owner, blockers, and grouped record navigation",
    states: ["active-risk", "all-clear", "partial-data", "not-found", "loading", "mobile", "keyboard"],
    roleModes: ["viewer", "editor", "legal_reviewer", "finance_reviewer", "manager", "admin"],
    evidenceArtifacts: ["src/app/(dashboard)/contracts/[id]/not-found.tsx"],
  },
  {
    route: "/contracts/tasks",
    ownerArtifact: "src/app/(dashboard)/contracts/tasks/page.tsx",
    primaryPattern: "queue-first",
    firstFoldAnswer: "blocked, overdue, due-soon, owner, contract, and next task action",
    states: ["active-risk", "all-clear", "filtered-empty", "loading", "mobile", "keyboard"],
    roleModes: ["viewer", "editor", "manager", "admin"],
    evidenceArtifacts: ["src/app/(dashboard)/contracts/tasks/page.tsx"],
  },
  {
    route: "/contracts/obligations",
    ownerArtifact: "src/app/(dashboard)/contracts/obligations/page.tsx",
    primaryPattern: "queue-first",
    firstFoldAnswer: "overdue, due soon, blocked, owner, obligation type, and completion path",
    states: ["active-risk", "all-clear", "filtered-empty", "loading", "mobile", "keyboard"],
    roleModes: ["viewer", "editor", "manager", "admin"],
    evidenceArtifacts: ["src/app/(dashboard)/contracts/obligations/page.tsx"],
  },
  {
    route: "/contracts/approvals",
    ownerArtifact: "src/app/(dashboard)/contracts/approvals/page.tsx",
    primaryPattern: "queue-first",
    firstFoldAnswer: "pending approvals, SLA pressure, delegation, blockers, and approve/reject path",
    states: ["active-risk", "all-clear", "filtered-empty", "loading", "mobile", "keyboard"],
    roleModes: ["viewer", "editor", "manager", "admin"],
    evidenceArtifacts: ["src/actions/approvals.ts", "src/app/api/approvals/[id]/[action]/route.ts"],
  },
  {
    route: "/contracts/exceptions",
    ownerArtifact: "src/app/(dashboard)/contracts/exceptions/page.tsx",
    primaryPattern: "queue-first",
    firstFoldAnswer: "critical/high severity, overdue, unassigned, blocker reason, and recovery action",
    states: ["active-risk", "all-clear", "filtered-empty", "forbidden", "loading", "mobile", "keyboard"],
    roleModes: ["viewer", "editor", "manager", "admin"],
    evidenceArtifacts: ["src/actions/exceptions.ts", "src/app/api/exceptions/[id]/[action]/route.ts"],
  },
  {
    route: "/contracts/renewals",
    ownerArtifact: "src/app/(dashboard)/contracts/renewals/page.tsx",
    primaryPattern: "queue-first",
    firstFoldAnswer: "notice deadline, renewal deadline, missing approved dates, blockers, and decision path",
    states: ["active-risk", "all-clear", "filtered-empty", "loading", "mobile", "keyboard"],
    roleModes: ["viewer", "editor", "manager", "admin"],
    evidenceArtifacts: ["src/actions/renewal-playbook.ts", "src/app/api/renewals/[id]/[action]/route.ts"],
  },
  {
    route: "/contracts/review",
    ownerArtifact: "src/app/(dashboard)/contracts/review/page.tsx",
    primaryPattern: "queue-first",
    firstFoldAnswer: "pending fields, date gaps, review continuity, and next contract action",
    states: ["active-risk", "all-clear", "filtered-empty", "loading", "mobile", "keyboard"],
    roleModes: ["legal_reviewer", "editor", "manager", "admin"],
    evidenceArtifacts: ["src/lib/v10-field-provenance.ts", "src/lib/contract-list-id-filters.ts"],
  },
  {
    route: "/settings/health",
    ownerArtifact: "src/app/(dashboard)/settings/health/page.tsx",
    primaryPattern: "diagnostics-first-when-abnormal",
    firstFoldAnswer: "user-visible trust issues before normal diagnostics",
    states: ["active-risk", "all-clear", "partial-data", "failed", "loading", "mobile", "keyboard"],
    roleModes: ["admin", "manager", "core", "advanced", "assurance"],
    evidenceArtifacts: ["src/lib/v10-read-model-refresh.ts", "src/lib/v10-release-evidence.ts"],
  },
  {
    route: "/reports",
    ownerArtifact: "src/app/(dashboard)/reports/page.tsx",
    primaryPattern: "diagnostics-first-when-abnormal",
    firstFoldAnswer: "failed, partial, running, or stale report outputs before browsing",
    states: ["active-risk", "all-clear", "partial-data", "loading", "mobile", "keyboard"],
    roleModes: ["viewer", "manager", "admin", "core", "advanced", "assurance"],
    evidenceArtifacts: ["src/lib/v10-report-export.ts", "src/components/reports/reports-v6-assurance-section.tsx"],
  },
  {
    route: "/decisions",
    ownerArtifact: "src/app/(dashboard)/decisions/page.tsx",
    primaryPattern: "queue-first",
    firstFoldAnswer: "open, overdue, blocked, review-required decisions before history",
    states: ["active-risk", "all-clear", "filtered-empty", "loading", "mobile", "keyboard"],
    roleModes: ["viewer", "editor", "manager", "admin"],
    evidenceArtifacts: ["src/app/(dashboard)/decisions/page.tsx"],
  },
  {
    route: "/campaigns",
    ownerArtifact: "src/app/(dashboard)/campaigns/page.tsx",
    primaryPattern: "queue-first",
    firstFoldAnswer: "blocked, waiting for approval, running, failed automation, then completed campaigns",
    states: ["active-risk", "all-clear", "filtered-empty", "loading", "mobile", "keyboard"],
    roleModes: ["viewer", "editor", "manager", "admin", "advanced", "assurance"],
    evidenceArtifacts: ["src/app/(dashboard)/campaigns/page.tsx"],
  },
  {
    route: "/accounts/[key]",
    ownerArtifact: "src/app/(dashboard)/accounts/[key]/page.tsx",
    primaryPattern: "detail-first",
    firstFoldAnswer: "relationship risk, contract exposure, owner context, and material activity before diagnostics",
    states: ["active-risk", "all-clear", "not-found", "loading", "mobile", "keyboard"],
    roleModes: ["viewer", "manager", "admin", "advanced", "assurance"],
    evidenceArtifacts: ["src/components/relationship/relationship-workspace-actions.tsx"],
  },
  {
    route: "/counterparties/[key]",
    ownerArtifact: "src/app/(dashboard)/counterparties/[key]/page.tsx",
    primaryPattern: "detail-first",
    firstFoldAnswer: "relationship risk, contract exposure, owner context, and material activity before diagnostics",
    states: ["active-risk", "all-clear", "not-found", "loading", "mobile", "keyboard"],
    roleModes: ["viewer", "manager", "admin", "advanced", "assurance"],
    evidenceArtifacts: ["src/components/relationship/relationship-workspace-actions.tsx"],
  },
  {
    route: "/assurance",
    ownerArtifact: "src/app/(dashboard)/assurance/page.tsx",
    primaryPattern: "advanced-analysis-first",
    firstFoldAnswer: "open findings, failed playbooks, policy health, and next assurance actions before diagnostics",
    states: ["active-risk", "all-clear", "partial-data", "loading", "mobile", "keyboard"],
    roleModes: ["admin", "manager", "assurance"],
    evidenceArtifacts: ["src/components/reports/reports-v6-assurance-section.tsx", "src/lib/v10-route-api-catalog.ts"],
  },
  {
    route: "/settings/product",
    ownerArtifact: "src/app/(dashboard)/settings/product/page.tsx",
    primaryPattern: "configuration-first",
    firstFoldAnswer: "product mode, route eligibility, feature changes, and admin action availability",
    states: ["active-risk", "all-clear", "forbidden", "failed", "loading", "mobile", "keyboard"],
    roleModes: ["admin", "core", "advanced", "assurance"],
    evidenceArtifacts: ["src/actions/product-surface-settings.ts", "src/lib/product-surface/api-workspace-guard.ts"],
  },
] as const;

export const ENTERPRISE_UI_COMPONENT_CONTRACTS: readonly EnterpriseUiComponentContractRow[] = [
  {
    component: "V10RecoverableState",
    artifact: "src/components/ui/v10-recoverable-state.tsx",
    density: ["standard", "compact"],
    requiredBehaviors: ["empty states are compact", "partial states explain trustworthy data", "failed states announce alerts"],
    telemetryOrA11yContract: "data-v10-state and aria-live remain stable",
  },
  {
    component: "OperationalTriagePanel",
    artifact: "src/components/ui/operational-summary-card.tsx",
    density: ["standard", "compact"],
    requiredBehaviors: ["active items render before all-clear", "zero sibling categories suppress", "diagnostics disclose"],
    telemetryOrA11yContract: "section heading plus link/action affordance remains keyboard reachable",
  },
  {
    component: "ContractTable",
    artifact: "src/components/contracts/contract-table.tsx",
    density: ["dense", "compact"],
    requiredBehaviors: ["next-action column present", "risk/deadline readable", "no-signal cells quiet", "bulk scope preserved"],
    telemetryOrA11yContract: "checkbox labels, sticky table header, and horizontal overflow remain accessible",
  },
  {
    component: "DiagnosticDisclosure",
    artifact: "src/components/ui/operational-summary-card.tsx",
    density: ["disclosure"],
    requiredBehaviors: ["implementation terms are hidden by default", "support detail remains discoverable"],
    telemetryOrA11yContract: "native details/summary keyboard semantics",
  },
  {
    component: "CommandPalette",
    artifact: "src/components/layout/command-palette.tsx",
    density: ["compact", "dense"],
    requiredBehaviors: ["actionable results outrank routine navigation", "object type and destination remain visible"],
    telemetryOrA11yContract: "dialog semantics and command-selection telemetry remain intact",
  },
] as const;

export const ENTERPRISE_UI_COPY_GUARD = {
  defaultSurfaceForbiddenTerms: [
    "read-model",
    "durable work index",
    "source object",
    "compatible action group",
    "runtime artifact",
    "Open queue",
    "Open summary JSON",
  ],
  allowedActionVerbs: [
    "assign",
    "approve",
    "reject",
    "retry",
    "resolve",
    "review",
    "request",
    "accept",
    "export",
    "import",
    "continue",
    "inspect",
    "configure",
    "browse",
    "refresh",
    "triage",
    "recover",
  ],
  diagnosticDisclosureComponent: "DiagnosticDisclosure",
} as const;

export const ENTERPRISE_UI_FIXTURE_STATES = [
  "all-clear workspace",
  "single critical exception",
  "many mixed-severity work items",
  "overdue task",
  "blocked obligation",
  "pending approval with delegation",
  "rejected evidence",
  "failed import",
  "failed export",
  "failed report",
  "stale data freshness",
  "forbidden user",
  "empty filtered contracts",
  "long-title unicode contract row",
  "mobile dense table",
  "core mode",
  "advanced mode",
  "assurance mode",
] as const;

export const ENTERPRISE_UI_ROLLOUT_MONITORING = [
  "route errors",
  "hydration errors",
  "command palette errors",
  "report/export failures",
  "mutation recoverability",
  "partial data states",
  "diagnostic disclosure usage",
  "all-clear impressions",
] as const;

export const ENTERPRISE_UI_SWEEP_LEDGER: readonly EnterpriseUiSweepLedgerRow[] = [
  {
    id: "advanced-surfaces",
    status: "verified",
    artifacts: [
      "src/app/(dashboard)/assurance/page.tsx",
      "src/app/(dashboard)/accounts/[key]/page.tsx",
      "src/app/(dashboard)/counterparties/[key]/page.tsx",
      "src/app/(dashboard)/contracts/analytics/page.tsx",
      "src/app/(dashboard)/contracts/maintenance/page.tsx",
    ],
    gates: ["src/lib/ui/enterprise-ui-sweep-contract.test.ts"],
    acceptanceEvidence: ["advanced surfaces use compact shell and review-oriented actions"],
  },
  {
    id: "copy-and-terminology",
    status: "verified",
    artifacts: ["src/lib/ui/operational-copy.ts", "src/lib/ui/enterprise-ui-sweep-contract.ts"],
    gates: ["src/lib/ui/operational-copy.test.ts", "src/lib/ui/enterprise-ui-sweep-contract.test.ts"],
    acceptanceEvidence: ["default forbidden implementation terms are centralized and guarded"],
  },
  {
    id: "route-inventory",
    status: "verified",
    artifacts: ["src/lib/ui/enterprise-ui-sweep-contract.ts", "src/lib/v10-route-api-catalog.ts"],
    gates: ["src/lib/ui/enterprise-ui-sweep-contract.test.ts", "src/lib/v10-route-api-catalog.v10.test.ts"],
    acceptanceEvidence: ["authenticated route inventory includes first-fold patterns and state coverage"],
  },
  {
    id: "role-mode-coverage",
    status: "verified",
    artifacts: ["src/lib/ui/enterprise-ui-sweep-contract.ts", "src/lib/product-surface/api-workspace-guard.ts"],
    gates: ["src/lib/ui/enterprise-ui-sweep-contract.test.ts", "src/lib/product-surface/api-workspace-guard.test.ts"],
    acceptanceEvidence: ["route rows carry role and product-mode coverage"],
  },
  {
    id: "forms-recoverability",
    status: "verified",
    artifacts: ["src/actions/tasks.ts", "src/actions/approvals.ts", "src/actions/exceptions.ts", "src/actions/obligations.ts"],
    gates: ["src/lib/v10-mutation-rollout.v10.test.ts", "src/lib/v10-route-api-catalog.v10.test.ts"],
    acceptanceEvidence: ["mutations remain idempotent/audited with operational recovery surfaces"],
  },
  {
    id: "accessibility-performance",
    status: "verified",
    artifacts: ["src/components/ui/v10-recoverable-state.tsx", "src/app/globals.css", "e2e/v10-core-smoke.spec.ts"],
    gates: ["src/components/ui/v10-recoverable-state.test.tsx", "npm run test:e2e:v10"],
    acceptanceEvidence: ["compact states preserve aria-live, keyboard disclosure, and server-rendered primitives"],
  },
  {
    id: "acceptance-matrix",
    status: "verified",
    artifacts: ["src/lib/ui/enterprise-ui-sweep-contract.ts", "src/lib/v10-acceptance-matrix.ts"],
    gates: ["src/lib/ui/enterprise-ui-sweep-contract.test.ts", "src/lib/v10-acceptance-matrix.v10.test.ts"],
    acceptanceEvidence: ["surface and component matrices are represented as static contracts"],
  },
  {
    id: "telemetry-docs-release",
    status: "verified",
    artifacts: ["docs/v10-ops-runbook.md", "docs/v10.md", "src/lib/product-telemetry.ts"],
    gates: ["src/lib/product-telemetry.v10.test.ts", "npm run check:v10-release-evidence"],
    acceptanceEvidence: ["release and runbook artifacts carry the new operating principle"],
  },
  {
    id: "fixtures-visuals",
    status: "verified",
    artifacts: ["src/lib/ui/enterprise-ui-sweep-contract.ts", "e2e/v10-core-smoke.spec.ts"],
    gates: ["src/lib/ui/enterprise-ui-sweep-contract.test.ts", "npm run test:e2e:v10"],
    acceptanceEvidence: ["fixture state manifest enumerates all-clear, active-risk, partial, failed, role, mode, and mobile states"],
  },
  {
    id: "privacy-security-ui",
    status: "verified",
    artifacts: ["src/lib/ui/enterprise-ui-sweep-contract.ts", "src/lib/v10-zero-exclusion-report.ts"],
    gates: ["src/lib/ui/enterprise-ui-sweep-contract.test.ts", "src/lib/v10-zero-exclusion-report.v10.test.ts"],
    acceptanceEvidence: ["diagnostic disclosure and release manifests keep support-sensitive details out of default UI"],
  },
  {
    id: "locale-theme-browser",
    status: "verified",
    artifacts: ["src/lib/ui/enterprise-ui-sweep-contract.ts", "src/components/contracts/contract-table.tsx", "src/app/globals.css"],
    gates: ["src/components/contracts/contract-table.ui.test.tsx", "src/lib/ui/enterprise-ui-sweep-contract.test.ts"],
    acceptanceEvidence: ["unicode/RTL table behavior, tokenized theme styling, and browser-sensitive overflow are covered"],
  },
  {
    id: "rollout-monitoring",
    status: "verified",
    artifacts: ["src/lib/ui/enterprise-ui-sweep-contract.ts", "docs/v10-ops-runbook.md"],
    gates: ["src/lib/ui/enterprise-ui-sweep-contract.test.ts", "npm run check:v10-suite"],
    acceptanceEvidence: ["rollout monitoring keys and compatibility shims are tracked outside the plan file"],
  },
] as const;

export function validateEnterpriseUiSweepContract() {
  const failures: string[] = [];
  const ledgerIds = new Set(ENTERPRISE_UI_SWEEP_LEDGER.map((row) => row.id));
  for (const id of ENTERPRISE_UI_SWEEP_REMAINING_IDS) {
    if (!ledgerIds.has(id)) failures.push(`missing_ledger:${id}`);
  }
  for (const row of ENTERPRISE_UI_SWEEP_LEDGER) {
    if (row.artifacts.length === 0) failures.push(`missing_artifact:${row.id}`);
    if (row.gates.length === 0) failures.push(`missing_gate:${row.id}`);
    if (row.acceptanceEvidence.length === 0) failures.push(`missing_evidence:${row.id}`);
  }
  const routeKeys = new Set<string>();
  for (const row of ENTERPRISE_UI_ROUTE_INVENTORY) {
    if (routeKeys.has(row.route)) failures.push(`duplicate_route:${row.route}`);
    routeKeys.add(row.route);
    if (row.states.length < 4) failures.push(`insufficient_state_coverage:${row.route}`);
    if (row.roleModes.length === 0) failures.push(`missing_role_mode:${row.route}`);
  }
  return failures;
}
