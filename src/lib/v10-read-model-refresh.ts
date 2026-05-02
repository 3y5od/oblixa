import type { createAdminClient } from "@/lib/supabase/server";
import {
  V10_CORE_REPORT_FAMILIES,
  V10_NOTIFICATION_CLASSES,
  type V10FieldState,
  type V10NotificationClass,
  type V10Priority,
  type V10Severity,
  type V10WorkItemStatus,
  type V10WorkItemType,
} from "./v10-release-contract";
import { V10_REQUIRED_READ_MODEL_KEYS } from "./v10-read-models";
import {
  calculateV10ContractHealth,
  getV10ContractNextAction,
} from "./v10-contract-health";
import { V10_SOURCE_OBJECT_INVENTORY } from "./v10-source-object-inventory";
import { sanitizeV10InternalHref } from "./v10-hardening-contracts";
import {
  getV10CompatibleActionGroup,
  getV10DueState,
  getV10OwnerState,
} from "./v10-work-semantics";
import {
  deriveV10ActivationState,
  getV10ActivationBlockedReason,
} from "./v10-activation-state";
import {
  deriveV10RenewalPosture,
  getV10ReminderEligibility,
  getV10RenewalHorizon,
} from "./v10-renewal-posture";
import { getV10EvidenceFollowUpSchedule } from "./v10-evidence-collaboration";
import { normalizeV10JobStatus, isV10JobRetryable } from "./v10-job-visibility";
import { getV10ReportFamilyForRun } from "./v10-report-export";
import { V10_RUNTIME_COVERAGE_LEDGER } from "./v10-traceability-ledger";

type Admin = Awaited<ReturnType<typeof createAdminClient>>;
type Row = Record<string, unknown>;
export type V10ReadModelFreshnessState = "fresh" | "stale" | "partial" | "failed" | "missing";
export type V10ReadModelKey = (typeof V10_REQUIRED_READ_MODEL_KEYS)[number];
export type V10ReadModelRefreshScope = "full" | "full_org" | "incremental" | "repair" | "dry_run" | "one_org" | "one_contract" | "one_model";
export type V10ReadModelRepairRecommendation = "none" | "incremental_repair" | "full_backfill" | "investigate_sources";

export type V10ReadModelRefreshOptions = {
  refreshJobId?: string;
  reason?: string;
  refreshScope?: V10ReadModelRefreshScope;
  now?: Date;
  contractId?: string;
  modelKeys?: readonly V10ReadModelKey[];
  changedSince?: Date;
};

export type V10ReadModelRefreshEvent = {
  organizationId: string;
  sourceTable: string;
  sourceId: string;
  contractId?: string | null;
  mutationKey?: string | null;
  changedAt?: Date;
  reason?: string;
};

export type V10ReadModelRefreshEventPlan = {
  refreshOptions: V10ReadModelRefreshOptions;
  targetModels: readonly V10ReadModelKey[];
  lineageRequired: boolean;
  refreshReason: string;
};

export type V10ReadModelBackfillPlan = {
  refreshScope: V10ReadModelRefreshScope;
  expectedSourceTables: readonly string[];
  missingSourceTables: readonly string[];
  expectedTargetModels: readonly string[];
  missingTargetModels: readonly string[];
  staleSourceTables: readonly string[];
  freshnessState: V10ReadModelFreshnessState;
  sourceObjectCoverageCount: number;
  repairRecommendation: V10ReadModelRepairRecommendation;
  diagnosticId: string | null;
};

export type V10ReadModelRefreshResult = {
  ok: boolean;
  failures: string[];
  counts: Record<string, number>;
  sourceCounts: Record<string, number>;
  targetCounts: Record<string, number>;
  diagnostics: {
    refresh_job_id: string;
    refresh_reason: string;
    refresh_scope: V10ReadModelRefreshScope;
    refreshed_at: string;
    dry_run: boolean;
    scoped_contract_id: string | null;
    changed_since: string | null;
    selected_model_keys: readonly V10ReadModelKey[];
    archived_before_upsert_tables: string[];
    failed_source_tables: string[];
    stale_source_tables: string[];
    expected_source_table_count: number;
    missing_source_tables: string[];
    missing_target_models: string[];
    repair_recommendation: V10ReadModelRepairRecommendation;
    partial_failure_count: number;
    write_failure_count: number;
    refresh_failure_count: number;
    model_freshness_state: V10ReadModelFreshnessState;
    source_count_total: number;
    target_count_total: number;
    lineage_count: number;
    artifact_count: number;
    coverage_count: number;
  };
};

const REQUIRED_FIELDS = [
  "title",
  "counterparty",
  "contract_type",
  "lifecycle_status",
  "effective_date",
  "end_date",
  "renewal_date",
  "notice_deadline",
  "governing_law",
  "contract_value_and_currency",
] as const;

export const V10_READ_MODEL_REFRESH_SOURCE_TABLES = [
  "contracts",
  "extracted_fields",
  "contract_tasks",
  "contract_obligations",
  "contract_approvals",
  "exceptions",
  "evidence_requirements",
  "contract_renewal_checkpoints",
  "evidence_submissions",
  "notification_deliveries",
  "v10_audit_events",
  "account_workspaces",
  "counterparty_workspaces",
  "decision_workspaces",
  "portfolio_campaigns",
  "assurance_findings",
  "control_policies",
  "adaptive_playbook_runs",
  "change_simulations",
  "assurance_scorecards",
  "review_boards",
  "portfolio_health_graph_edges",
  "contract_import_jobs",
  "contract_export_jobs",
  "report_runs",
  "saved_views",
] as const;

export const V10_READ_MODEL_REFRESH_TARGET_MODELS = [
  ...V10_REQUIRED_READ_MODEL_KEYS,
  "read_model_rows",
  "read_model_lineage",
  "runtime_artifacts",
  "runtime_coverage_ledger",
] as const;

export const V10_READ_MODEL_REFRESH_INDIRECT_SOURCE_TABLES = [
  "contract_files",
  "reminders",
  "organization_workflow_settings",
  "notification_destinations",
  "portfolio_programs",
  "v10_read_model_refresh_jobs",
  "v10_runtime_artifacts",
] as const;

export const V10_READ_MODEL_REFRESH_DEFERRED_SOURCE_TABLES = V10_SOURCE_OBJECT_INVENTORY
  .filter((row) => row.autonomousStatus === "typed_contract" || row.autonomousStatus === "external_evidence")
  .map((row) => row.sourceTable) as readonly string[];

export const V10_READ_MODEL_REFRESH_EVENT_TARGETS: Record<string, readonly V10ReadModelKey[]> = {
  contracts: ["activation_state", "contract_health_snapshots", "contract_activity_events", "command_search_index"],
  extracted_fields: ["field_provenance_records", "contract_health_snapshots", "work_items", "command_search_index"],
  contract_tasks: ["work_items", "contract_activity_events", "command_search_index"],
  contract_obligations: ["obligation_records", "work_items", "contract_health_snapshots", "command_search_index"],
  contract_approvals: ["approval_records", "work_items", "contract_activity_events", "command_search_index"],
  exceptions: ["exception_records", "work_items", "contract_health_snapshots", "command_search_index"],
  evidence_requirements: ["evidence_request_statuses", "obligation_records", "work_items", "contract_activity_events"],
  evidence_submissions: ["external_evidence_submissions", "evidence_request_statuses", "contract_activity_events"],
  contract_renewal_checkpoints: ["renewal_checkpoint_records", "renewal_posture_snapshots", "work_items"],
  notification_deliveries: ["notification_deliveries"],
  contract_import_jobs: ["job_run_visibility", "activation_state", "work_items"],
  contract_export_jobs: ["job_run_visibility", "report_run_visibility"],
  report_runs: ["report_run_visibility", "job_run_visibility"],
  saved_views: ["command_search_index"],
  v10_audit_events: ["audit_events", "contract_activity_events"],
  account_workspaces: ["advanced_assurance_linked_records", "command_search_index"],
  counterparty_workspaces: ["advanced_assurance_linked_records", "command_search_index"],
  decision_workspaces: ["advanced_assurance_linked_records", "command_search_index"],
  portfolio_campaigns: ["advanced_assurance_linked_records", "command_search_index"],
  assurance_findings: ["advanced_assurance_linked_records", "command_search_index"],
  control_policies: ["advanced_assurance_linked_records", "command_search_index"],
  adaptive_playbook_runs: ["advanced_assurance_linked_records", "job_run_visibility"],
  change_simulations: ["advanced_assurance_linked_records", "job_run_visibility"],
  assurance_scorecards: ["advanced_assurance_linked_records", "command_search_index"],
  review_boards: ["advanced_assurance_linked_records", "command_search_index"],
  portfolio_health_graph_edges: ["advanced_assurance_linked_records"],
};

export function buildV10ReadModelRefreshEventPlan(event: V10ReadModelRefreshEvent): V10ReadModelRefreshEventPlan {
  const targetModels = V10_READ_MODEL_REFRESH_EVENT_TARGETS[event.sourceTable] ?? V10_REQUIRED_READ_MODEL_KEYS;
  const contractScoped = Boolean(event.contractId);
  const refreshReason = event.reason ?? `event:${event.sourceTable}:${event.mutationKey ?? "source_changed"}`;
  return {
    targetModels,
    lineageRequired: true,
    refreshReason,
    refreshOptions: {
      reason: refreshReason,
      refreshScope: contractScoped ? "one_contract" : "incremental",
      contractId: event.contractId ?? undefined,
      modelKeys: targetModels,
      changedSince: event.changedAt,
    },
  };
}

export function validateV10ReadModelRefreshCoverage(
  inventory = V10_SOURCE_OBJECT_INVENTORY
): string[] {
  const failures: string[] = [];
  const directSources = new Set<string>(V10_READ_MODEL_REFRESH_SOURCE_TABLES);
  const indirectSources = new Set<string>(V10_READ_MODEL_REFRESH_INDIRECT_SOURCE_TABLES);
  const deferredSources = new Set<string>(V10_READ_MODEL_REFRESH_DEFERRED_SOURCE_TABLES);
  const inventorySourceTables = new Set(inventory.map((row) => row.sourceTable));

  for (const row of inventory) {
    if (directSources.has(row.sourceTable) || indirectSources.has(row.sourceTable) || deferredSources.has(row.sourceTable)) {
      continue;
    }
    failures.push(`source_inventory_table_uncovered:${row.sourceObjectType}:${row.sourceTable}`);
  }
  for (const sourceTable of directSources) {
    if (!inventorySourceTables.has(sourceTable)) failures.push(`refresh_source_missing_inventory:${sourceTable}`);
  }
  for (const sourceTable of indirectSources) {
    if (!inventorySourceTables.has(sourceTable)) failures.push(`indirect_source_missing_inventory:${sourceTable}`);
  }
  return failures;
}

export function buildV10ReadModelBackfillPlan(input: {
  sourceCounts: Record<string, number>;
  targetCounts: Record<string, number>;
  freshnessState: V10ReadModelFreshnessState;
  refreshScope?: V10ReadModelRefreshScope;
}): V10ReadModelBackfillPlan {
  const expectedSourceTables = [...V10_READ_MODEL_REFRESH_SOURCE_TABLES];
  const expectedTargetModels = [...V10_READ_MODEL_REFRESH_TARGET_MODELS];
  const missingSourceTables = expectedSourceTables.filter((table) => !(table in input.sourceCounts));
  const missingTargetModels = expectedTargetModels.filter((model) => !(model in input.targetCounts));
  const staleSourceTables =
    input.freshnessState === "stale"
      ? expectedSourceTables.filter((table) => (input.sourceCounts[table] ?? 0) > 0)
      : [];
  const repairRecommendation: V10ReadModelRepairRecommendation =
    input.freshnessState === "failed" || missingTargetModels.length > 0
      ? "full_backfill"
      : input.freshnessState === "partial" || input.freshnessState === "missing"
        ? "incremental_repair"
        : missingSourceTables.length > 0
          ? "investigate_sources"
          : "none";
  const diagnosticId =
    repairRecommendation === "none" ? null : `v10_refresh_${repairRecommendation}_${input.freshnessState}`;

  return {
    refreshScope: input.refreshScope ?? (repairRecommendation === "full_backfill" ? "repair" : "full"),
    expectedSourceTables,
    missingSourceTables,
    expectedTargetModels,
    missingTargetModels,
    staleSourceTables,
    freshnessState: input.freshnessState,
    sourceObjectCoverageCount: new Set(V10_SOURCE_OBJECT_INVENTORY.map((row) => row.sourceTable)).size,
    repairRecommendation,
    diagnosticId,
  };
}

export function validateV10ReadModelRefreshDiagnostics(
  diagnostics: V10ReadModelRefreshResult["diagnostics"]
): string[] {
  const failures: string[] = [];
  if (!diagnostics.refresh_job_id.trim()) failures.push("refresh_job_id_required");
  if (!diagnostics.refresh_reason.trim()) failures.push("refresh_reason_required");
  if (!["full", "full_org", "incremental", "repair", "dry_run", "one_org", "one_contract", "one_model"].includes(diagnostics.refresh_scope)) {
    failures.push("refresh_scope_invalid");
  }
  for (const modelKey of diagnostics.selected_model_keys) {
    if (!(V10_REQUIRED_READ_MODEL_KEYS as readonly string[]).includes(modelKey)) failures.push(`selected_model_unknown:${modelKey}`);
  }
  if (diagnostics.expected_source_table_count !== V10_READ_MODEL_REFRESH_SOURCE_TABLES.length) {
    failures.push("expected_source_table_count_mismatch");
  }
  if (diagnostics.partial_failure_count !== diagnostics.failed_source_tables.length + diagnostics.write_failure_count) {
    failures.push("partial_failure_count_mismatch");
  }
  if (diagnostics.refresh_failure_count !== diagnostics.partial_failure_count) {
    failures.push("refresh_failure_count_mismatch");
  }
  if (diagnostics.model_freshness_state === "fresh" && diagnostics.partial_failure_count > 0) {
    failures.push("fresh_model_cannot_have_failures");
  }
  if (diagnostics.model_freshness_state === "fresh" && diagnostics.repair_recommendation !== "none") {
    failures.push("fresh_model_cannot_require_repair");
  }
  if (diagnostics.model_freshness_state !== "fresh" && diagnostics.repair_recommendation === "none") {
    failures.push("non_fresh_model_requires_repair_recommendation");
  }
  if (diagnostics.model_freshness_state === "stale" && diagnostics.stale_source_tables.length === 0) {
    failures.push("stale_model_requires_stale_source_tables");
  }
  for (const [key, value] of Object.entries({
    source_count_total: diagnostics.source_count_total,
    target_count_total: diagnostics.target_count_total,
    lineage_count: diagnostics.lineage_count,
    artifact_count: diagnostics.artifact_count,
    coverage_count: diagnostics.coverage_count,
    partial_failure_count: diagnostics.partial_failure_count,
    write_failure_count: diagnostics.write_failure_count,
    refresh_failure_count: diagnostics.refresh_failure_count,
  })) {
    if (!Number.isFinite(value) || value < 0) failures.push(`${key}_invalid`);
  }
  return failures;
}

function asRows(data: unknown): Row[] {
  return Array.isArray(data) ? (data as Row[]) : [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : Number(value ?? 0) || 0;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

function asBoolean(value: unknown): boolean {
  return value === true || value === "true";
}

function normalizeV10ReadModelRefreshScope(scope: V10ReadModelRefreshScope): V10ReadModelRefreshScope {
  return scope === "full_org" || scope === "one_org" ? "full" : scope;
}

function normalizeV10SelectedModelKeys(modelKeys?: readonly V10ReadModelKey[]): readonly V10ReadModelKey[] {
  if (!modelKeys || modelKeys.length === 0) return V10_REQUIRED_READ_MODEL_KEYS;
  const requested = new Set(modelKeys);
  return V10_REQUIRED_READ_MODEL_KEYS.filter((modelKey) => requested.has(modelKey));
}

function rowMatchesV10ContractScope(row: Row, contractId: string | null): boolean {
  if (!contractId) return true;
  return (
    asString(row.contract_id) === contractId ||
    asString(row.source_id) === contractId ||
    asString(row.id) === contractId ||
    asString(row.source_id)?.startsWith(`${contractId}:`) === true ||
    asString(row.fields && asObject(row.fields).contract_id) === contractId
  );
}

function scopeV10Rows(rows: readonly Row[], contractId: string | null): Row[] {
  return contractId ? rows.filter((row) => rowMatchesV10ContractScope(row, contractId)) : [...rows];
}

function rowChangedSince(row: Row, changedSinceMs: number | null): boolean {
  if (changedSinceMs == null) return true;
  const latest = getLatestTimestamp([row]);
  return latest === 0 || latest >= changedSinceMs;
}

function safeValueHash(value: unknown): string | null {
  const text = asString(value);
  if (!text) return null;
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16)}`;
}

function mapStatus(value: unknown): V10WorkItemStatus {
  const raw = String(value ?? "open");
  if (raw === "done" || raw === "completed" || raw === "approved" || raw === "resolved" || raw === "waived") return "done";
  if (raw === "canceled" || raw === "cancelled") return "canceled";
  if (raw === "blocked" || raw === "rejected" || raw === "overdue") return "blocked";
  if (raw === "in_progress" || raw === "running" || raw === "submitted") return "in_progress";
  if (raw === "waiting" || raw === "pending") return "waiting";
  return "open";
}

function mapPriority(value: unknown): V10Priority {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "urgent") return "urgent";
  if (raw === "high") return "high";
  if (raw === "low") return "low";
  if (raw === "none") return "none";
  return "normal";
}

function mapSeverity(value: unknown): V10Severity {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "critical") return "critical";
  if (raw === "high") return "high";
  if (raw === "medium") return "medium";
  if (raw === "low") return "low";
  return "none";
}

function mapFieldState(value: unknown): V10FieldState {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "approved") return "approved";
  if (raw === "rejected") return "rejected";
  if (raw === "missing") return "missing";
  if (raw === "ambiguous") return "ambiguous";
  if (raw === "user_supplied" || raw === "manual") return "user_supplied";
  if (raw === "stale_source") return "stale_source";
  return "extracted";
}

function mapNotificationClass(value: unknown): V10NotificationClass {
  const raw = String(value ?? "").toLowerCase();
  return (V10_NOTIFICATION_CLASSES as readonly string[]).includes(raw)
    ? (raw as V10NotificationClass)
    : "due_work";
}

function sharedReadModelRow(input: {
  organizationId: string;
  featureFamily: string;
  sourceTable: string;
  sourceId: string;
  createdAt?: string | null;
  updatedAt?: string | null;
}) {
  const timestamp = input.updatedAt ?? input.createdAt ?? new Date().toISOString();
  return {
    organization_id: input.organizationId,
    workspace_mode: "core",
    required_role_minimum: "viewer",
    feature_family: input.featureFamily,
    source_table: input.sourceTable,
    source_id: input.sourceId,
    visibility_state: "visible",
    created_at: input.createdAt ?? timestamp,
    updated_at: timestamp,
    deleted_at: null,
    archived_at: null,
  };
}

function hrefFor(item: { type: V10WorkItemType; contractId: string | null; sourceId: string }): string {
  if (item.contractId) {
    if (item.type === "approval") return `/contracts/${item.contractId}?tab=overview#renewal-approvals`;
    if (item.type === "obligation") return `/contracts/${item.contractId}?tab=obligations`;
    if (item.type === "evidence_request") return `/contracts/${item.contractId}?tab=overview#contract-evidence`;
    if (item.type === "exception") return `/contracts/exceptions?status=open&contract=${item.contractId}`;
    return `/contracts/${item.contractId}`;
  }
  if (item.type === "report_failure") return "/reports";
  if (item.type === "export_failure") return "/settings/health#exports";
  if (item.type === "import_failure") return `/settings/health#jobs`;
  return "/work";
}

function buildWorkItem(input: {
  organizationId: string;
  sourceTable: string;
  sourceId: string;
  type: V10WorkItemType;
  title: string;
  status: unknown;
  contractId?: string | null;
  ownerUserId?: string | null;
  dueAt?: string | null;
  priority?: unknown;
  severity?: unknown;
  blockedReason?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
  primaryAction?: string;
  sourceType?: string;
}) {
  const status = mapStatus(input.status);
  const dueState = getV10DueState(input.dueAt, { dateOnly: input.dueAt?.length === 10 });
  const ownerState = getV10OwnerState({ ownerUserId: input.ownerUserId ?? null });
  const semantic = {
    id: input.sourceId,
    type: input.type,
    status,
    ownerUserId: input.ownerUserId,
    dueAt: input.dueAt,
    dateOnlyDue: input.dueAt?.length === 10,
    blockedReason: input.blockedReason,
    priority: mapPriority(input.priority),
    severity: mapSeverity(input.severity),
  };
  return {
    organization_id: input.organizationId,
    workspace_mode: "core",
    required_role_minimum: "viewer",
    feature_family: "work",
    source_table: input.sourceTable,
    source_id: input.sourceId,
    type: input.type,
    status,
    title: input.title,
    contract_id: input.contractId ?? null,
    source_type: input.sourceType ?? (input.type === "contract_task" ? "contract" : input.type),
    owner_user_id: input.ownerUserId ?? null,
    owner_state: ownerState,
    due_at: input.dueAt ?? null,
    due_state: dueState,
    priority: semantic.priority,
    severity: semantic.severity,
    blocked_reason: input.blockedReason ?? null,
    primary_action: input.primaryAction ?? "open_source_object",
    secondary_actions: ["open_source_object"],
    compatible_action_group: getV10CompatibleActionGroup(semantic),
    last_state_change_at: input.updatedAt ?? input.createdAt ?? new Date().toISOString(),
    last_state_change_actor_id: null,
    audit_event_id: null,
    visibility_state: "visible",
    created_at: input.createdAt ?? new Date().toISOString(),
    updated_at: input.updatedAt ?? new Date().toISOString(),
  };
}

async function queryRows(admin: Admin, table: string, select: string, organizationId: string, pageSize = 500): Promise<Row[]> {
  const rows: Row[] = [];
  for (let page = 0; ; page += 1) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await admin
      .from(table)
      .select(select)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true, nullsFirst: false })
      .range(from, to);
    if (error) {
      throw new Error(`[v10-refresh] query ${table} failed: ${error.message}`);
    }
    const pageRows = asRows(data);
    rows.push(...pageRows);
    if (pageRows.length < pageSize) break;
  }
  return rows;
}

async function replaceRows(
  admin: Admin,
  table: string,
  organizationId: string,
  rows: Row[],
  refreshedAt: string
): Promise<string | null> {
  const onConflict = getV10ReadModelUpsertConflict(table);
  const rpcAdmin = admin as Admin & {
    rpc?: (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message?: string } | null }>;
  };
  if (typeof rpcAdmin.rpc === "function") {
    const { error } = await rpcAdmin.rpc("replace_v10_read_model_rows", {
      p_table_name: table,
      p_organization_id: organizationId,
      p_rows: rows,
      p_identity_columns: onConflict.split(",").map((column) => column.trim()),
      p_archived_at: refreshedAt,
    });
    if (error) {
      const message = `[v10-refresh] replace ${table} failed: ${error.message ?? "unknown error"}`;
      console.error(message);
      return message;
    }
    return null;
  }

  if (rows.length > 0) {
    const { error } = await admin.from(table).upsert(rows, { onConflict });
    if (error) {
      const message = `[v10-refresh] upsert ${table} failed: ${error.message}`;
      console.error(message);
      return message;
    }
  }
  return null;
}

function getV10ReadModelUpsertConflict(table: string): string {
  if (table === "v10_read_model_rows") return "organization_id,model_key,source_table,source_id";
  if (table === "v10_work_items") return "organization_id,source_table,source_id,type";
  if (table === "v10_read_model_lineage") {
    return "organization_id,refresh_job_id,model_key,read_model_source_table,read_model_source_id,source_table,source_id";
  }
  if (table === "v10_runtime_artifacts") return "organization_id,artifact_key";
  if (table === "v10_runtime_coverage_ledger") return "organization_id,coverage_kind,coverage_key";
  return "organization_id,source_table,source_id";
}

function normalizeV10CoverageReleaseEvidenceKey(input: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 96);
  return `v10-release:runtime-coverage:${normalized || "unknown"}`;
}

function getV10CoverageTestStatus(testProof: string): "unit" | "api" | "ui" | "e2e" | "release_check" | "missing" {
  if (testProof.includes("e2e/")) return "e2e";
  if (testProof.includes("/api/") || testProof.includes("route-api")) return "api";
  if (testProof.includes(".ui.test.") || testProof.includes("ui-state")) return "ui";
  if (testProof.includes(".test.") || testProof.includes(".v10.test.")) return "unit";
  if (testProof.includes("npm run") || testProof.includes("scripts/")) return "release_check";
  return "missing";
}

function buildV10RuntimeCoverageLedgerRows(input: {
  organizationId: string;
  refreshedAt: string;
  freshnessState: V10ReadModelFreshnessState;
}): Row[] {
  return V10_RUNTIME_COVERAGE_LEDGER.map((row) => ({
    organization_id: input.organizationId,
    coverage_key: row.coverageKey,
    coverage_kind: row.coverageKind,
    priority: row.priority,
    owner: row.owner,
    source_artifact: row.sourceArtifact,
    route_path: row.coverageKind === "route" && row.coverageKey.startsWith("/") ? row.coverageKey : null,
    mutation_name: row.coverageKind === "mutation" ? row.coverageKey : null,
    read_model_key: row.coverageKind === "read_model" ? row.coverageKey : null,
    telemetry_action: row.coverageKind === "telemetry_event" ? row.coverageKey : null,
    audit_action: row.coverageKind === "audit_action" ? row.coverageKey : null,
    fixture_key: row.coverageKind === "fixture" ? row.coverageKey : null,
    runtime_status: row.runtimeStatus,
    test_status: getV10CoverageTestStatus(row.testProof),
    release_evidence_key: normalizeV10CoverageReleaseEvidenceKey(row.coverageKey),
    blocker_key: row.runtimeStatus === "external_blocker" ? row.coverageKey : null,
    rollback_path: row.rollbackPath,
    residual_risk: row.residualRisk === "none_known" ? null : row.residualRisk,
    freshness_state: row.runtimeStatus === "runtime_backed" ? input.freshnessState : row.freshness,
    updated_at: input.refreshedAt,
    created_at: input.refreshedAt,
  }));
}

async function insertV10RefreshJob(
  admin: Admin,
  input: {
    organizationId: string;
    refreshJobId: string;
    refreshReason: string;
    refreshScope: V10ReadModelRefreshScope;
    expectedSourceTables: readonly string[];
    modelKeys: readonly string[];
    refreshedAt: string;
  }
): Promise<string | null> {
  const { error } = await admin.from("v10_read_model_refresh_jobs").insert([
    {
      organization_id: input.organizationId,
      refresh_job_id: input.refreshJobId,
      refresh_reason: input.refreshReason,
      refresh_scope: input.refreshScope,
      repair_mode: input.refreshScope === "dry_run" ? "dry_run" : "replace_visible",
      status: "running",
      model_keys: [...input.modelKeys],
      expected_source_tables: [...input.expectedSourceTables],
      source_counts: {},
      target_counts: {},
      failure_count: 0,
      failed_source_tables: [],
      diagnostic_id: null,
      started_at: input.refreshedAt,
      updated_at: input.refreshedAt,
    },
  ]);
  if (error) {
    const message = `[v10-refresh] create refresh job failed: ${error.message}`;
    console.error(message);
    return message;
  }
  return null;
}

async function completeV10RefreshJob(
  admin: Admin,
  input: {
    organizationId: string;
    refreshJobId: string;
    refreshedAt: string;
    ok: boolean;
    sourceCounts: Record<string, number>;
    targetCounts: Record<string, number>;
    failures: readonly string[];
    failedSourceTables: readonly string[];
    staleSourceTables: readonly string[];
    driftState: V10ReadModelFreshnessState;
  }
): Promise<string | null> {
  const status = input.ok ? "succeeded" : input.failedSourceTables.length > 0 ? "partial" : "failed_retryable";
  const { error } = await admin
    .from("v10_read_model_refresh_jobs")
    .update({
      status,
      source_counts: input.sourceCounts,
      target_counts: input.targetCounts,
      failure_count: input.failures.length,
      failed_source_tables: [...input.failedSourceTables],
      stale_source_tables: [...input.staleSourceTables],
      drift_state: input.driftState,
      diagnostic_id: input.ok ? null : `v10_read_model_refresh_${input.driftState}`,
      completed_at: input.refreshedAt,
      updated_at: input.refreshedAt,
    })
    .eq("organization_id", input.organizationId)
    .eq("refresh_job_id", input.refreshJobId);
  if (error) {
    const message = `[v10-refresh] complete refresh job failed: ${error.message}`;
    console.error(message);
    return message;
  }
  return null;
}

function getLatestTimestamp(rows: readonly Row[]): number {
  let latest = 0;
  for (const row of rows) {
    for (const key of ["updated_at", "completed_at", "finished_at", "started_at", "created_at"]) {
      const raw = asString(row[key]);
      if (!raw) continue;
      const value = Date.parse(raw);
      if (Number.isFinite(value) && value > latest) latest = value;
    }
  }
  return latest;
}

function getEarliestTimestamp(rows: readonly Row[]): number {
  let earliest = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    for (const key of ["started_at", "created_at", "updated_at", "completed_at", "finished_at"]) {
      const raw = asString(row[key]);
      if (!raw) continue;
      const value = Date.parse(raw);
      if (Number.isFinite(value) && value < earliest) earliest = value;
    }
  }
  return Number.isFinite(earliest) ? earliest : 0;
}

function daysUntil(raw: string | null | undefined, now: Date): number | null {
  if (!raw) return null;
  const value = new Date(raw).getTime();
  if (!Number.isFinite(value)) return null;
  return Math.ceil((value - now.getTime()) / 86_400_000);
}

function getV10FreshnessState(input: {
  sourceFailures: readonly string[];
  writeFailures: readonly string[];
  sourceCounts: Record<string, number>;
  targetCounts: Record<string, number>;
  refreshedAtMs: number;
  latestSourceUpdatedAtMs: number;
}): V10ReadModelFreshnessState {
  if (input.writeFailures.length > 0) return "failed";
  if (input.sourceFailures.length > 0) return "partial";
  if (Object.values(input.targetCounts).every((count) => count === 0) && Object.values(input.sourceCounts).some((count) => count > 0)) {
    return "missing";
  }
  if (input.latestSourceUpdatedAtMs > input.refreshedAtMs) return "stale";
  return "fresh";
}

export async function refreshV10ReadModelsForOrganization(
  admin: Admin,
  organizationId: string,
  options: V10ReadModelRefreshOptions = {}
): Promise<V10ReadModelRefreshResult> {
  const now = options.now ?? new Date();
  const refreshedAt = now.toISOString();
  const refreshJobId = options.refreshJobId ?? `v10_refresh_${organizationId}_${now.getTime()}`;
  const refreshReason = options.reason ?? "manual_refresh";
  const refreshScope = normalizeV10ReadModelRefreshScope(options.refreshScope ?? "full");
  const scopedContractId = refreshScope === "one_contract" ? (options.contractId?.trim() || null) : null;
  const selectedModelKeys = normalizeV10SelectedModelKeys(options.modelKeys);
  const changedSinceMs = refreshScope === "incremental" && options.changedSince ? options.changedSince.getTime() : null;
  const sourceFailures: string[] = [];
  const refreshJobFailures: string[] = [];
  if (refreshScope === "one_contract" && !scopedContractId) {
    sourceFailures.push("[v10-refresh] one_contract scope requires contractId");
  }
  const refreshJobCreateFailure = await insertV10RefreshJob(admin, {
    organizationId,
    refreshJobId,
    refreshReason,
    refreshScope,
    expectedSourceTables: V10_READ_MODEL_REFRESH_SOURCE_TABLES,
    modelKeys: selectedModelKeys,
    refreshedAt,
  });
  if (refreshJobCreateFailure) refreshJobFailures.push(refreshJobCreateFailure);
  const q = async (table: string, select: string, pageSize?: number) => {
    try {
      return await queryRows(admin, table, select, organizationId, pageSize);
    } catch (error) {
      const message = error instanceof Error ? error.message : `[v10-refresh] query ${table} failed`;
      sourceFailures.push(message);
      return [];
    }
  };
  const [
    contracts,
    fields,
    tasks,
    obligations,
    approvals,
    exceptions,
    evidence,
    renewalCheckpoints,
    evidenceSubmissions,
    notificationDeliveries,
    auditEvents,
    accountWorkspaces,
    counterpartyWorkspaces,
    decisions,
    campaigns,
    findings,
    controls,
    playbookRuns,
    simulations,
    scorecards,
    reviewBoards,
    healthGraphEdges,
    importJobs,
    exportJobs,
    reportRuns,
    savedViews,
  ] = await Promise.all([
    q("contracts", "id,title,counterparty,contract_type,status,owner_id,annual_value,required_next_step,created_at,updated_at", 1000),
    q("extracted_fields", "id,contract_id,field_name,field_value,status,source,confidence,reviewed_by,reviewed_at,created_at,updated_at", 5000),
    q("contract_tasks", "id,contract_id,title,status,priority,assignee_id,due_date,blocked_reason,created_at,updated_at", 2000),
    q("contract_obligations", "id,contract_id,title,status,owner_id,due_date,evidence_notes,evidence_url,created_at,updated_at", 2000),
    q("contract_approvals", "id,contract_id,approval_type,status,requested_by,approver_id,delegated_to_id,due_at,notes,resolved_at,created_at,updated_at", 2000),
    q("exceptions", "id,contract_id,title,severity,status,owner_id,root_cause,due_date,linked_entity_type,linked_entity_id,resolution_note,resolved_at,created_at,updated_at", 2000),
    q("evidence_requirements", "id,contract_id,work_item_id,title,status,reviewer_id,due_at,required,config_json,created_at,updated_at", 2000),
    q("contract_renewal_checkpoints", "id,contract_id,task_key,label,status,due_date,renewal_state,workspace_json,created_at,updated_at", 2000),
    q("evidence_submissions", "id,requirement_id,submitted_by,submitted_at,status,payload_json,reviewer_id,reviewed_at,rejection_reason,created_at", 2000),
    q("notification_deliveries", "id,channel,notification_type,status,next_attempt_at,delivered_at,last_error,metadata,created_at,updated_at", 1000),
    q("v10_audit_events", "audit_event_id,actor_user_id,actor_type,action,target_type,target_id,contract_id,outcome,safe_metadata,diagnostic_id,created_at", 2000),
    q("account_workspaces", "id,account_key,display_name,owner_user_id,summary_json,health_signal_json,created_at,updated_at", 500),
    q("counterparty_workspaces", "id,counterparty_key,display_name,owner_user_id,summary_json,health_signal_json,created_at,updated_at", 500),
    q("decision_workspaces", "id,decision_type,status,title,linked_contract_ids,linked_account_key,linked_counterparty_key,owner_user_id,created_at,updated_at", 500),
    q("portfolio_campaigns", "id,campaign_type,status,name,owner_user_id,progress_summary_json,rollback_safe,created_at,updated_at", 500),
    q("assurance_findings", "id,finding_type,title,severity,status,scope_json,linked_entities_json,created_at,updated_at", 500),
    q("control_policies", "id,name,status,enforcement_mode,severity_model_json,created_at,updated_at", 500),
    q("adaptive_playbook_runs", "id,status,source_finding_id,run_by,created_at,updated_at", 500),
    q("change_simulations", "id,name,simulation_type,status,owner_user_id,input_json,result_json,created_at,updated_at", 500),
    q("assurance_scorecards", "id,name,status,owner_user_id,overall_score,created_at,updated_at", 500),
    q("review_boards", "id,name,status,owner_user_id,created_at,updated_at", 500),
    q("portfolio_health_graph_edges", "id,source_node_id,target_node_id,edge_type,created_at,updated_at", 500),
    q("contract_import_jobs", "id,status,total_rows,inserted_rows,error_rows,failure_reason,created_by,created_at,updated_at,completed_at", 500),
    q("contract_export_jobs", "id,status,selected_contract_count,exported_rows,truncated,error_message,created_by,started_at,completed_at,created_at,updated_at", 500),
    q("report_runs", "id,report_mode,status,started_at,finished_at,triggered_by,subscription_id,metrics_json,error_summary,created_at", 500),
    q("saved_views", "id,name,view_type,query_json,pinned,created_at,updated_at", 500),
  ]);

  const sourceCounts: Record<string, number> = {
    contracts: contracts.length,
    extracted_fields: fields.length,
    contract_tasks: tasks.length,
    contract_obligations: obligations.length,
    contract_approvals: approvals.length,
    exceptions: exceptions.length,
    evidence_requirements: evidence.length,
    contract_renewal_checkpoints: renewalCheckpoints.length,
    evidence_submissions: evidenceSubmissions.length,
    notification_deliveries: notificationDeliveries.length,
    v10_audit_events: auditEvents.length,
    account_workspaces: accountWorkspaces.length,
    counterparty_workspaces: counterpartyWorkspaces.length,
    decision_workspaces: decisions.length,
    portfolio_campaigns: campaigns.length,
    assurance_findings: findings.length,
    control_policies: controls.length,
    adaptive_playbook_runs: playbookRuns.length,
    change_simulations: simulations.length,
    assurance_scorecards: scorecards.length,
    review_boards: reviewBoards.length,
    portfolio_health_graph_edges: healthGraphEdges.length,
    contract_import_jobs: importJobs.length,
    contract_export_jobs: exportJobs.length,
    report_runs: reportRuns.length,
    saved_views: savedViews.length,
  };
  const latestSourceUpdatedAtMs = Math.max(
    0,
    ...[
      contracts,
      fields,
      tasks,
      obligations,
      approvals,
      exceptions,
      evidence,
      renewalCheckpoints,
      evidenceSubmissions,
      notificationDeliveries,
      auditEvents,
      accountWorkspaces,
      counterpartyWorkspaces,
      decisions,
      campaigns,
      findings,
      controls,
      playbookRuns,
      simulations,
      scorecards,
      reviewBoards,
      healthGraphEdges,
      importJobs,
      exportJobs,
      reportRuns,
      savedViews,
    ].map((rows) => getLatestTimestamp(rows))
  );

  const fieldsByContract = new Map<string, Row[]>();
  for (const field of fields) {
    const contractId = asString(field.contract_id);
    if (!contractId) continue;
    fieldsByContract.set(contractId, [...(fieldsByContract.get(contractId) ?? []), field]);
  }

  const evidenceById = new Map(evidence.map((row) => [String(row.id), row]));
  const evidenceSubmissionsByRequirement = new Map<string, Row[]>();
  for (const submission of evidenceSubmissions) {
    const requirementId = asString(submission.requirement_id);
    if (!requirementId) continue;
    evidenceSubmissionsByRequirement.set(requirementId, [
      ...(evidenceSubmissionsByRequirement.get(requirementId) ?? []),
      submission,
    ]);
  }

  const auditIdsByTarget = new Map<string, string[]>();
  for (const auditEvent of auditEvents) {
    const targetType = asString(auditEvent.target_type);
    const targetId = asString(auditEvent.target_id);
    const auditEventId = asString(auditEvent.audit_event_id);
    if (!targetType || !targetId || !auditEventId) continue;
    auditIdsByTarget.set(`${targetType}:${targetId}`, [
      ...(auditIdsByTarget.get(`${targetType}:${targetId}`) ?? []),
      auditEventId,
    ]);
  }

  const getAuditIds = (targetType: string, targetId: unknown) =>
    auditIdsByTarget.get(`${targetType}:${String(targetId)}`) ?? [];

  const workItems = [
    ...fields
      .filter((row) => !["approved", "user_supplied"].includes(mapFieldState(row.status)))
      .map((row) =>
        buildWorkItem({
          organizationId,
          sourceTable: "extracted_fields",
          sourceId: String(row.id),
          type: "field_review",
          title: `Review ${String(row.field_name ?? "field").replace(/_/g, " ")}`,
          status: mapFieldState(row.status) === "rejected" ? "blocked" : "open",
          contractId: asString(row.contract_id),
          ownerUserId: asString(row.reviewed_by),
          priority: (REQUIRED_FIELDS as readonly string[]).includes(String(row.field_name)) ? "high" : "normal",
          severity: mapFieldState(row.status) === "missing" ? "medium" : "none",
          blockedReason: mapFieldState(row.status) === "rejected" ? "field_rejected" : null,
          createdAt: asString(row.created_at),
          updatedAt: asString(row.updated_at),
          primaryAction: "review_field",
          sourceType: "field",
        })
      ),
    ...tasks.map((row) =>
      buildWorkItem({
        organizationId,
        sourceTable: "contract_tasks",
        sourceId: String(row.id),
        type: "contract_task",
        title: String(row.title ?? "Contract task"),
        status: row.status,
        contractId: asString(row.contract_id),
        ownerUserId: asString(row.assignee_id),
        dueAt: asString(row.due_date),
        priority: row.priority,
        blockedReason: asString(row.blocked_reason),
        createdAt: asString(row.created_at),
        updatedAt: asString(row.updated_at),
        primaryAction: mapStatus(row.status) === "done" ? "open_source_object" : "mark_done",
      })
    ),
    ...obligations.map((row) =>
      buildWorkItem({
        organizationId,
        sourceTable: "contract_obligations",
        sourceId: String(row.id),
        type: "obligation",
        title: String(row.title ?? "Contract obligation"),
        status: row.status,
        contractId: asString(row.contract_id),
        ownerUserId: asString(row.owner_id),
        dueAt: asString(row.due_date),
        createdAt: asString(row.created_at),
        updatedAt: asString(row.updated_at),
        primaryAction: "mark_done",
      })
    ),
    ...approvals.map((row) =>
      buildWorkItem({
        organizationId,
        sourceTable: "contract_approvals",
        sourceId: String(row.id),
        type: "approval",
        title: String(row.approval_type ?? "Approval request").replace(/_/g, " "),
        status: row.status,
        contractId: asString(row.contract_id),
        ownerUserId: asString(row.approver_id),
        dueAt: asString(row.due_at),
        severity: getV10DueState(asString(row.due_at)) === "overdue" ? "high" : "none",
        createdAt: asString(row.created_at),
        updatedAt: asString(row.updated_at),
        primaryAction: "approve_approval",
      })
    ),
    ...exceptions.map((row) =>
      buildWorkItem({
        organizationId,
        sourceTable: "exceptions",
        sourceId: String(row.id),
        type: "exception",
        title: String(row.title ?? "Exception"),
        status: row.status,
        contractId: asString(row.contract_id),
        ownerUserId: asString(row.owner_id),
        dueAt: asString(row.due_date),
        severity: row.severity,
        createdAt: asString(row.created_at),
        updatedAt: asString(row.updated_at),
        primaryAction: "resolve_exception",
      })
    ),
    ...evidence.map((row) => {
      const dueAt = asString(row.due_at);
      const schedule = dueAt ? getV10EvidenceFollowUpSchedule(dueAt, now) : null;
      return buildWorkItem({
        organizationId,
        sourceTable: "evidence_requirements",
        sourceId: String(row.id),
        type: "evidence_request",
        title: String(row.title ?? "Evidence request"),
        status: schedule?.overdue ? "blocked" : row.status,
        contractId: asString(row.contract_id),
        ownerUserId: asString(row.reviewer_id),
        dueAt,
        blockedReason: schedule?.overdue ? "evidence_overdue" : null,
        severity: schedule?.overdue ? "high" : "none",
        createdAt: asString(row.created_at),
        updatedAt: asString(row.updated_at),
        primaryAction: "accept_evidence",
      });
    }),
    ...renewalCheckpoints
      .filter((row) => mapStatus(row.status) !== "done")
      .map((row) => {
        const workspace = asObject(row.workspace_json);
        return buildWorkItem({
          organizationId,
          sourceTable: "contract_renewal_checkpoints",
          sourceId: String(row.id),
          type: "renewal_checkpoint",
          title: String(row.label ?? row.task_key ?? "Renewal checkpoint"),
          status: row.status,
          contractId: asString(row.contract_id),
          ownerUserId: asString(workspace.owner_user_id),
          dueAt: asString(row.due_date),
          priority: getV10DueState(asString(row.due_date), { dateOnly: true }) === "overdue" ? "high" : "normal",
          severity: getV10DueState(asString(row.due_date), { dateOnly: true }) === "overdue" ? "medium" : "none",
          blockedReason: asString(workspace.blocked_reason),
          createdAt: asString(row.created_at),
          updatedAt: asString(row.updated_at),
          primaryAction: "complete_renewal_checkpoint",
          sourceType: "renewal_checkpoint",
        });
      }),
    ...contracts
      .filter((row) => !asString(row.owner_id))
      .map((row) =>
        buildWorkItem({
          organizationId,
          sourceTable: "contracts",
          sourceId: `${String(row.id)}:owner`,
          type: "unassigned_work",
          title: "Assign a contract owner",
          status: "open",
          contractId: String(row.id),
          ownerUserId: null,
          priority: "high",
          severity: "medium",
          blockedReason: "missing_owner",
          createdAt: asString(row.created_at),
          updatedAt: asString(row.updated_at),
          primaryAction: "assign_owner",
          sourceType: "contract",
        })
      ),
    ...importJobs
      .filter((row) => ["failed", "failed_retryable", "partial"].includes(String(row.status)) || asNumber(row.error_rows) > 0)
      .map((row) =>
        buildWorkItem({
          organizationId,
          sourceTable: "contract_import_jobs",
          sourceId: String(row.id),
          type: "import_failure",
          title: "Import needs recovery",
          status: "blocked",
          ownerUserId: asString(row.created_by),
          severity: "high",
          blockedReason: asString(row.failure_reason) ?? "import_failed",
          createdAt: asString(row.created_at),
          updatedAt: asString(row.updated_at),
          primaryAction: "retry_failed_job",
        })
      ),
    ...exportJobs
      .filter((row) => ["failed", "failed_retryable", "partial"].includes(String(row.status)) || row.truncated === true)
      .map((row) =>
        buildWorkItem({
          organizationId,
          sourceTable: "contract_export_jobs",
          sourceId: String(row.id),
          type: "export_failure",
          title: row.truncated === true ? "Export was truncated" : "Export needs recovery",
          status: "blocked",
          ownerUserId: asString(row.created_by),
          severity: row.truncated === true ? "medium" : "high",
          blockedReason: asString(row.error_message) ?? (row.truncated === true ? "export_truncated" : "export_failed"),
          createdAt: asString(row.created_at),
          updatedAt: asString(row.updated_at),
          primaryAction: "retry_failed_job",
        })
      ),
    ...reportRuns
      .filter((row) => ["failed", "failed_retryable", "partial"].includes(String(row.status)))
      .map((row) =>
        buildWorkItem({
          organizationId,
          sourceTable: "report_runs",
          sourceId: String(row.id),
          type: "report_failure",
          title: `${String(row.report_mode ?? "report").replace(/_/g, " ")} report needs recovery`,
          status: "blocked",
          ownerUserId: asString(row.triggered_by),
          severity: "high",
          blockedReason: asString(row.error_summary) ?? "report_failed",
          createdAt: asString(row.created_at),
          updatedAt: asString(row.finished_at) ?? asString(row.started_at),
          primaryAction: "retry_failed_job",
        })
      ),
    ...playbookRuns
      .filter((row) => String(row.status) === "awaiting_approval")
      .map((row) =>
        buildWorkItem({
          organizationId,
          sourceTable: "adaptive_playbook_runs",
          sourceId: String(row.id),
          type: "automation_approval",
          title: "Automation approval required",
          status: "waiting",
          ownerUserId: asString(row.run_by),
          severity: "high",
          createdAt: asString(row.created_at),
          updatedAt: asString(row.updated_at),
          primaryAction: "approve_approval",
        })
      ),
  ];

  const workByContract = new Map<string, ReturnType<typeof buildWorkItem>[]>();
  for (const item of workItems) {
    if (item.contract_id) workByContract.set(item.contract_id, [...(workByContract.get(item.contract_id) ?? []), item]);
  }

  const healthRows = contracts.map((contract) => {
    const contractId = String(contract.id);
    const contractFields = fieldsByContract.get(contractId) ?? [];
    const approvedFieldNames = new Set(
      contractFields.filter((field) => field.status === "approved").map((field) => String(field.field_name))
    );
    const approvedValue = (fieldName: string) =>
      asString(contractFields.find((field) => field.status === "approved" && field.field_name === fieldName)?.field_value);
    const approvedEndDate = approvedValue("end_date");
    const approvedRenewalDate = approvedValue("renewal_date");
    const approvedNoticeDeadline = approvedValue("notice_deadline") ?? approvedValue("notice_window");
    const missingRequiredFieldCount = REQUIRED_FIELDS.filter((field) => !approvedFieldNames.has(field)).length;
    const missingCriticalDateCount = [approvedEndDate, approvedRenewalDate, approvedNoticeDeadline].filter((value) => !value).length;
    const linkedWork = workByContract.get(contractId) ?? [];
    const overdueLinkedWorkCount = linkedWork.filter((item) => item.due_state === "overdue").length;
    const openHighOrCriticalExceptionCount = exceptions.filter(
      (row) => row.contract_id === contractId && ["high", "critical"].includes(String(row.severity)) && mapStatus(row.status) !== "done"
    ).length;
    const outstandingEvidenceCount = evidence.filter((row) => row.contract_id === contractId && mapStatus(row.status) !== "done").length;
    const renewalInput = {
      approvedRenewalDate,
      approvedNoticeDeadline,
      approvedEndDate,
      now,
    };
    const renewalPosture = deriveV10RenewalPosture(renewalInput);
    const renewalPostureTerminal = renewalPosture === "completed";
    const noticeDays = daysUntil(approvedNoticeDeadline, now);
    const renewalDays = daysUntil(approvedRenewalDate ?? approvedEndDate, now);
    const health = calculateV10ContractHealth({
      missingRequiredFieldCount,
      missingCriticalDateCount,
      overdueLinkedWorkCount,
      openHighOrCriticalExceptionCount,
      outstandingEvidenceCount,
      outstandingEvidenceOverdueCount: evidence.filter((row) => row.contract_id === contractId && getV10DueState(asString(row.due_at)) === "overdue").length,
      renewalNoticeDeadlineInside30Days: noticeDays != null && noticeDays >= 0 && noticeDays <= 30,
      renewalPostureTerminal,
      ownerMissingOrStale: !asString(contract.owner_id),
      failedOrPartialRetryableJobCount: linkedWork.filter((item) => item.type.endsWith("_failure")).length,
      missingRecommendedFieldCount: contractFields.length === 0 ? 1 : 0,
    });
    const nextAction = getV10ContractNextAction({
      missingRequiredActivationField: missingRequiredFieldCount > 0,
      pendingRequiredFieldReview: contractFields.some((field) => field.status === "pending"),
      overdueApproval: approvals.some((row) => row.contract_id === contractId && getV10DueState(asString(row.due_at)) === "overdue"),
      overdueObligation: obligations.some((row) => row.contract_id === contractId && getV10DueState(asString(row.due_date), { dateOnly: true }) === "overdue"),
      overdueEvidenceRequest: evidence.some((row) => row.contract_id === contractId && getV10DueState(asString(row.due_at)) === "overdue"),
      openCriticalException: openHighOrCriticalExceptionCount > 0,
      renewalNoticeDeadlineInside30Days: noticeDays != null && noticeDays >= 0 && noticeDays <= 30,
      renewalDateInside90Days: renewalDays != null && renewalDays >= 0 && renewalDays <= 90,
      unassignedOwner: !asString(contract.owner_id),
      missingRecommendedField: contractFields.length === 0,
    });
    return {
      organization_id: organizationId,
      workspace_mode: "core",
      required_role_minimum: "viewer",
      feature_family: "contracts",
      source_table: "contracts",
      source_id: contractId,
      contract_id: contractId,
      score: health.score,
      band: health.band,
      deductions: health.deductions,
      next_action: nextAction,
      computed_at: now.toISOString(),
      stale_owner: !asString(contract.owner_id),
      missing_required_field_count: missingRequiredFieldCount,
      missing_critical_date_count: missingCriticalDateCount,
      overdue_work_count: overdueLinkedWorkCount,
      open_high_or_critical_exception_count: openHighOrCriticalExceptionCount,
      outstanding_evidence_count: outstandingEvidenceCount,
      failed_or_partial_job_count: linkedWork.filter((item) => item.type.endsWith("_failure")).length,
      visibility_state: "visible",
    };
  });

  const activationRows = contracts.map((contract) => {
    const contractId = String(contract.id);
    const contractFields = fieldsByContract.get(contractId) ?? [];
    const approved = contractFields.filter((field) => field.status === "approved").length;
    const firstWorkItem = (workByContract.get(contractId) ?? [])[0];
    const extractionStartedAtMs = getEarliestTimestamp(contractFields);
    const extractionCompletedAtMs = getLatestTimestamp(contractFields);
    const extractionStartedAt = extractionStartedAtMs > 0 ? new Date(extractionStartedAtMs).toISOString() : null;
    const extractionCompletedAt = extractionCompletedAtMs > 0 ? new Date(extractionCompletedAtMs).toISOString() : null;
    const contractStatus = String(contract.status ?? "").toLowerCase();
    const requiredNextStep = String(contract.required_next_step ?? "").toLowerCase();
    const extractionFailed = contractStatus.includes("extraction_failed") || requiredNextStep.includes("extraction_failed");
    const extractionPartial = contractFields.length > 0 && approved < REQUIRED_FIELDS.length;
    const input = {
      acceptedAt: asString(contract.created_at),
      durableJobId: contractId,
      extractionStartedAt,
      extractionCompletedAt,
      extractionFailed,
      extractionPartial,
      requiredFieldsTotal: REQUIRED_FIELDS.length,
      requiredFieldsApproved: approved,
      ownerState: getV10OwnerState({ ownerUserId: asString(contract.owner_id) }),
      firstGeneratedWorkItemId: firstWorkItem?.source_id ?? null,
      firstGeneratedWorkItemAt: firstWorkItem?.created_at ?? null,
      dashboardUpdatedAt: firstWorkItem ? (asString(contract.updated_at) ?? now.toISOString()) : null,
    };
    return {
      organization_id: organizationId,
      source_id: contractId,
      user_id: null,
      contract_id: contractId,
      state: deriveV10ActivationState(input),
      accepted_upload_at: asString(contract.created_at),
      extraction_started_at: extractionStartedAt,
      extraction_completed_at: extractionCompletedAt,
      required_fields_total: REQUIRED_FIELDS.length,
      required_fields_approved: approved,
      owner_state: input.ownerState,
      first_generated_work_item_id: input.firstGeneratedWorkItemId,
      first_generated_work_item_at: input.firstGeneratedWorkItemAt,
      blocked_reason: getV10ActivationBlockedReason(input),
      next_action: input.firstGeneratedWorkItemId ? "open_first_work_item" : "complete_activation",
      visibility_state: "visible",
    };
  });

  const fieldProvenanceRows = fields.map((field) => {
    const fieldValue = asString(field.field_value);
    return {
      ...sharedReadModelRow({
        organizationId,
        featureFamily: "review",
        sourceTable: "extracted_fields",
        sourceId: String(field.id),
        createdAt: asString(field.created_at),
        updatedAt: asString(field.updated_at),
      }),
      contract_id: asString(field.contract_id),
      field_key: String(field.field_name ?? "unknown_field"),
      current_value_display: mapFieldState(field.status) === "missing" ? "Missing" : fieldValue ?? "Available for review",
      value_hash: safeValueHash(field.field_value),
      state: mapFieldState(field.status),
      source_label: String(field.source ?? "extracted"),
      source_file_id: null,
      confidence_state: asNumber(field.confidence) >= 0.8 ? "high" : asNumber(field.confidence) >= 0.5 ? "medium" : "low",
      reviewer_user_id: asString(field.reviewed_by),
      reviewed_at: asString(field.reviewed_at),
      rejection_reason: null,
      last_modified_actor_id: asString(field.reviewed_by),
      last_modified_at: asString(field.updated_at) ?? asString(field.created_at) ?? now.toISOString(),
    };
  });

  const renewalPostureRows = contracts.map((contract) => {
    const contractId = String(contract.id);
    const contractFields = fieldsByContract.get(contractId) ?? [];
    const approvedValue = (fieldName: string) =>
      asString(contractFields.find((field) => field.status === "approved" && field.field_name === fieldName)?.field_value);
    const approvedEndDate = approvedValue("end_date");
    const approvedRenewalDate = approvedValue("renewal_date");
    const approvedNoticeDeadline = approvedValue("notice_deadline") ?? approvedValue("notice_window");
    const renewalInput = {
      approvedEndDate,
      approvedRenewalDate,
      approvedNoticeDeadline,
      now,
    };
    const posture = deriveV10RenewalPosture(renewalInput);
    const horizon = getV10RenewalHorizon(renewalInput);
    const eligibility = getV10ReminderEligibility(renewalInput);
    return {
      ...sharedReadModelRow({
        organizationId,
        featureFamily: "renewals",
        sourceTable: "contracts",
        sourceId: contractId,
        createdAt: asString(contract.created_at),
        updatedAt: asString(contract.updated_at),
      }),
      contract_id: contractId,
      posture,
      horizon: horizon === "none" || posture === "blocked_missing_approved_dates" ? null : horizon,
      approved_end_date: approvedEndDate,
      approved_renewal_date: approvedRenewalDate,
      approved_notice_deadline: approvedNoticeDeadline,
      reminder_eligible: eligibility.reminderEligible && posture !== "blocked_missing_approved_dates",
      blocked_reason: eligibility.blockedReason,
      next_checkpoint_work_item_id:
        asString(renewalCheckpoints.find((checkpoint) => checkpoint.contract_id === contractId && mapStatus(checkpoint.status) !== "done")?.id) ?? null,
      computed_at: now.toISOString(),
    };
  });

  const evidenceStatusRows = evidence.map((row) => {
    const submissions = evidenceSubmissionsByRequirement.get(String(row.id)) ?? [];
    const latestSubmission = submissions
      .slice()
      .sort((a, b) => String(b.submitted_at ?? "").localeCompare(String(a.submitted_at ?? "")))[0];
    const config = asObject(row.config_json);
    return {
      ...sharedReadModelRow({
        organizationId,
        featureFamily: "evidence",
        sourceTable: "evidence_requirements",
        sourceId: String(row.id),
        createdAt: asString(row.created_at),
        updatedAt: asString(row.updated_at),
      }),
      evidence_request_id: String(row.id),
      contract_id: asString(row.contract_id),
      requester_user_id: asString(config.requester_user_id) ?? asString(row.reviewer_id),
      external_responder_state: config.external_responder_email ? "provided" : "not_provided",
      due_at: asString(row.due_at),
      status: String(row.status ?? "required"),
      submission_count: submissions.length,
      latest_submission_at: asString(latestSubmission?.submitted_at),
      reviewer_user_id: asString(row.reviewer_id),
      reviewed_at: asString(latestSubmission?.reviewed_at),
      rejection_reason: asString(latestSubmission?.rejection_reason),
      resubmission_allowed: String(row.status) === "rejected",
      external_link_state: asBoolean(config.external_link_revoked)
        ? "revoked"
        : asString(config.external_token_expires_at) && new Date(String(config.external_token_expires_at)) < now
          ? "expired"
          : config.external_token_hash
            ? "active"
            : "not_created",
      audit_event_ids: getAuditIds("evidence_request", row.id),
    };
  });

  const obligationRows = obligations.map((row) => ({
    ...sharedReadModelRow({
      organizationId,
      featureFamily: "obligations",
      sourceTable: "contract_obligations",
      sourceId: String(row.id),
      createdAt: asString(row.created_at),
      updatedAt: asString(row.updated_at),
    }),
    obligation_id: String(row.id),
    contract_id: asString(row.contract_id),
    title: String(row.title ?? "Contract obligation"),
    owner_user_id: asString(row.owner_id),
    owner_state: getV10OwnerState({ ownerUserId: asString(row.owner_id) }),
    status: mapStatus(row.status),
    due_at: asString(row.due_date),
    due_state: getV10DueState(asString(row.due_date), { dateOnly: true }),
    source_field_key: null,
    source_clause_hash: null,
    evidence_required: Boolean(row.evidence_notes || row.evidence_url),
    evidence_request_ids: evidence.filter((item) => item.work_item_id === row.id).map((item) => String(item.id)),
    linked_exception_ids: exceptions
      .filter((item) => {
        const linkedType = asString(item.linked_entity_type);
        return (
          asString(item.linked_entity_id) === String(row.id) &&
          (!linkedType || linkedType === "obligation" || linkedType === "contract_obligation")
        );
      })
      .map((item) => String(item.id)),
    last_activity_at: asString(row.updated_at) ?? asString(row.created_at),
    audit_event_ids: getAuditIds("obligation", row.id),
  }));

  const approvalRows = approvals.map((row) => ({
    ...sharedReadModelRow({
      organizationId,
      featureFamily: "approvals",
      sourceTable: "contract_approvals",
      sourceId: String(row.id),
      createdAt: asString(row.created_at),
      updatedAt: asString(row.updated_at),
    }),
    approval_id: String(row.id),
    contract_id: asString(row.contract_id),
    approval_type: String(row.approval_type ?? "approval"),
    requester_user_id: asString(row.requested_by),
    approver_user_id: asString(row.approver_id),
    delegated_approver_user_id: asString(row.delegated_to_id),
    status: String(row.status ?? "pending"),
    due_at: asString(row.due_at),
    due_state: getV10DueState(asString(row.due_at)),
    sla_state: getV10DueState(asString(row.due_at)) === "overdue" ? "breached" : "within_sla",
    decision_note_state: row.notes ? "provided" : "not_provided",
    decided_at: asString(row.resolved_at),
    linked_decision_id: null,
    audit_event_ids: getAuditIds("approval", row.id),
  }));

  const exceptionRows = exceptions.map((row) => ({
    ...sharedReadModelRow({
      organizationId,
      featureFamily: "exceptions",
      sourceTable: "exceptions",
      sourceId: String(row.id),
      createdAt: asString(row.created_at),
      updatedAt: asString(row.updated_at),
    }),
    exception_id: String(row.id),
    contract_id: asString(row.contract_id),
    title: String(row.title ?? "Exception"),
    severity: mapSeverity(row.severity),
    owner_user_id: asString(row.owner_id),
    owner_state: getV10OwnerState({ ownerUserId: asString(row.owner_id) }),
    status: String(row.status ?? "open"),
    root_cause: asString(row.root_cause),
    due_at: asString(row.due_date),
    due_state: getV10DueState(asString(row.due_date), { dateOnly: true }),
    source_type: "exception",
    linked_source_id: String(row.id),
    resolution_action: asString(row.resolution_note),
    resolved_at: asString(row.resolved_at),
    reopened_at: null,
    linked_task_ids: [] as string[],
    linked_evidence_request_ids: evidence.filter((item) => item.work_item_id === row.id).map((item) => String(item.id)),
    linked_approval_id: null,
    linked_decision_id: null,
    audit_event_ids: getAuditIds("exception", row.id),
  }));

  const renewalCheckpointRows = renewalCheckpoints.map((row) => {
    const workspace = asObject(row.workspace_json);
    return {
      ...sharedReadModelRow({
        organizationId,
        featureFamily: "renewals",
        sourceTable: "contract_renewal_checkpoints",
        sourceId: String(row.id),
        createdAt: asString(row.created_at),
        updatedAt: asString(row.updated_at),
      }),
      renewal_checkpoint_id: String(row.id),
      contract_id: asString(row.contract_id),
      checkpoint_type: String(row.task_key ?? row.label ?? "renewal_checkpoint"),
      owner_user_id: asString(workspace.owner_user_id),
      owner_state: getV10OwnerState({ ownerUserId: asString(workspace.owner_user_id) }),
      status: String(row.status ?? "open"),
      due_at: asString(row.due_date),
      due_state: getV10DueState(asString(row.due_date), { dateOnly: true }),
      approved_notice_deadline: asString(workspace.approved_notice_deadline),
      approved_renewal_date: asString(workspace.approved_renewal_date),
      posture_before: asString(workspace.posture_before),
      posture_after: asString(row.renewal_state) ?? asString(workspace.posture_after),
      reminder_eligible: Boolean(workspace.reminder_eligible),
      blocked_reason: asString(workspace.blocked_reason),
      audit_event_ids: getAuditIds("renewal_checkpoint", row.id),
    };
  });

  const notificationRows = notificationDeliveries.map((row) => {
    const metadata = asObject(row.metadata);
    return {
      ...sharedReadModelRow({
        organizationId,
        featureFamily: "notifications",
        sourceTable: "notification_deliveries",
        sourceId: String(row.id),
        createdAt: asString(row.created_at),
        updatedAt: asString(row.updated_at),
      }),
      notification_id: String(row.id),
      notification_class: mapNotificationClass(row.notification_type),
      recipient_user_id: asString(metadata.user_id),
      recipient_channel: String(row.channel ?? "email"),
      source_type: String(metadata.source_type ?? "notification_delivery"),
      linked_source_id: String(metadata.source_id ?? row.id),
      contract_id: asString(metadata.contract_id),
      eligibility_state: String(metadata.eligibility_state ?? "eligible"),
      preference_state: String(metadata.preference_state ?? "enabled"),
      scheduled_at: asString(row.next_attempt_at) ?? asString(row.created_at),
      sent_at: asString(row.delivered_at),
      delivery_status: String(row.status ?? "pending"),
      failure_category: row.last_error ? "delivery_failed" : null,
      diagnostic_id: row.last_error ? `notification_${row.id}` : null,
      deep_link_href: asString(metadata.deep_link_href),
      audit_event_id: null,
    };
  });

  const externalSubmissionRows = evidenceSubmissions.map((row) => {
    const requirement = evidenceById.get(String(row.requirement_id));
    const payload = asObject(row.payload_json);
    const files = asStringArray(payload.files);
    return {
      ...sharedReadModelRow({
        organizationId,
        featureFamily: "evidence",
        sourceTable: "evidence_submissions",
        sourceId: String(row.id),
        createdAt: asString(row.created_at),
        updatedAt: asString(row.reviewed_at) ?? asString(row.submitted_at) ?? asString(row.created_at),
      }),
      submission_id: String(row.id),
      evidence_request_id: String(row.requirement_id ?? ""),
      contract_id: asString(requirement?.contract_id),
      external_link_id: asString(payload.external_link_id),
      submitter_name_state: payload.submitter_name ? "provided" : "not_provided",
      submitter_email_state: payload.submitter_email ? "redacted" : "not_provided",
      submitted_at: asString(row.submitted_at),
      file_count: files.length,
      file_type_summary: files.length > 0 ? "files_provided" : "none",
      note_state: payload.note ? "redacted" : "not_provided",
      upload_status: "succeeded",
      review_status: String(row.status ?? "submitted"),
      reviewer_user_id: asString(row.reviewer_id),
      reviewed_at: asString(row.reviewed_at),
      rejection_reason: asString(row.rejection_reason),
      audit_event_ids: getAuditIds("evidence_request", row.requirement_id),
    };
  });

  const contractActivityRows = auditEvents
    .filter((row) => asString(row.contract_id))
    .map((row) => ({
      ...sharedReadModelRow({
        organizationId,
        featureFamily: "audit",
        sourceTable: "v10_audit_events",
        sourceId: String(row.audit_event_id),
        createdAt: asString(row.created_at),
        updatedAt: asString(row.created_at),
      }),
      contract_id: asString(row.contract_id),
      actor_user_id: asString(row.actor_user_id),
      actor_display: String(row.actor_type ?? "system"),
      action: String(row.action ?? "unknown"),
      target_type: String(row.target_type ?? "contract"),
      target_id: String(row.target_id ?? row.contract_id),
      outcome: String(row.outcome ?? "success"),
      safe_summary: String(row.action ?? "Audit event").replace(/_/g, " "),
      metadata_safe: asObject(row.safe_metadata) as Record<string, string | number | boolean | null>,
      occurred_at: asString(row.created_at) ?? now.toISOString(),
    }));

  const jobRows = [
    ...importJobs.map((row) => {
      const status = normalizeV10JobStatus(String(row.status), { failed: asNumber(row.error_rows), retryable: asNumber(row.error_rows) });
      return {
        organization_id: organizationId,
        source_table: "contract_import_jobs",
        source_id: String(row.id),
        job_id: String(row.id),
        job_class: "contract_import",
        status,
        cancellation_state: "not_cancelable",
        source_type: "import_job",
        contract_id: null,
        started_at: asString(row.created_at),
        completed_at: asString(row.completed_at),
        completed_count: asNumber(row.inserted_rows),
        failed_count: asNumber(row.error_rows),
        skipped_count: Math.max(0, asNumber(row.total_rows) - asNumber(row.inserted_rows) - asNumber(row.error_rows)),
        retryable_count: asNumber(row.error_rows),
        diagnostic_id: status === "succeeded" ? null : `import_${row.id}`,
        failure_category: status === "succeeded" ? null : "import_processing",
        user_visible_detail: asString(row.failure_reason) ?? "Import status is available.",
        retry_action: isV10JobRetryable(status, asNumber(row.error_rows)) ? "retry" : null,
        visibility_state: "visible",
      };
    }),
    ...exportJobs.map((row) => {
      const status = normalizeV10JobStatus(String(row.status), { failed: row.truncated === true ? 1 : 0, retryable: row.truncated === true ? 1 : 0 });
      return {
        organization_id: organizationId,
        source_table: "contract_export_jobs",
        source_id: String(row.id),
        job_id: String(row.id),
        job_class: "export",
        status,
        cancellation_state: "not_cancelable",
        source_type: "export_job",
        contract_id: null,
        started_at: asString(row.started_at) ?? asString(row.created_at),
        completed_at: asString(row.completed_at),
        completed_count: asNumber(row.exported_rows),
        failed_count: status === "succeeded" ? 0 : 1,
        skipped_count: row.truncated === true ? Math.max(0, asNumber(row.selected_contract_count) - asNumber(row.exported_rows)) : 0,
        retryable_count: status === "succeeded" ? 0 : 1,
        diagnostic_id: status === "succeeded" ? null : `export_${row.id}`,
        failure_category: status === "succeeded" ? null : row.truncated === true ? "truncated" : "export_processing",
        user_visible_detail: asString(row.error_message) ?? "Export status is available.",
        retry_action: isV10JobRetryable(status, status === "succeeded" ? 0 : 1) ? "retry" : null,
        visibility_state: "visible",
      };
    }),
  ];

  const reportRows = reportRuns.map((row) => {
    const status = normalizeV10JobStatus(String(row.status));
    const metrics = asObject(row.metrics_json);
    return {
      organization_id: organizationId,
      source_id: String(row.id),
      report_run_id: String(row.id),
      report_family: getV10ReportFamilyForRun(asString(row.report_mode)),
      source_filters_safe: { report_mode: String(row.report_mode ?? "management") },
      initiated_by_user_id: asString(row.triggered_by),
      schedule_id: asString(row.subscription_id),
      status,
      started_at: asString(row.started_at),
      completed_at: asString(row.finished_at),
      selected_row_count: asNumber(metrics.selected_row_count ?? metrics.selected_count ?? metrics.total_rows) || null,
      generated_row_count: asNumber(metrics.generated_row_count ?? metrics.generated_count ?? metrics.delivered_rows) || null,
      artifact_url: asString(metrics.artifact_url ?? metrics.artifact_href ?? metrics.artifact_path),
      delivery_destination_state: "workspace",
      failure_category: status === "succeeded" ? null : "report_generation",
      diagnostic_id: status === "succeeded" ? null : `report_${row.id}`,
      retry_action: isV10JobRetryable(status, status === "succeeded" ? 0 : 1) ? "retry" : null,
      visibility_state: "visible",
    };
  });

  const coreSourceCommandRows = [
    ...obligationRows.map((row) => ({
      organization_id: organizationId,
      workspace_mode: "core",
      required_role_minimum: "viewer",
      feature_family: "obligations",
      source_table: row.source_table,
      source_id: row.source_id,
      record_type: "obligation",
      record_id: row.obligation_id,
      label: row.title,
      description_safe: `Obligation · ${String(row.status).replace(/_/g, " ")}`,
      href: `/contracts/${row.contract_id}?tab=obligations`,
      rank_terms_safe: [row.title, row.status, "obligation"],
      workspace_mode_minimum: "core",
      module_key: "obligations",
      plan_minimum: "core",
      visibility_state: row.visibility_state,
    })),
    ...approvalRows.map((row) => ({
      organization_id: organizationId,
      workspace_mode: "core",
      required_role_minimum: "viewer",
      feature_family: "approvals",
      source_table: row.source_table,
      source_id: row.source_id,
      record_type: "approval",
      record_id: row.approval_id,
      label: `${String(row.approval_type).replace(/_/g, " ")} approval`,
      description_safe: `Approval · ${String(row.status).replace(/_/g, " ")}`,
      href: `/contracts/${row.contract_id}?tab=overview#renewal-approvals`,
      rank_terms_safe: [row.approval_type, row.status, "approval"],
      workspace_mode_minimum: "core",
      module_key: "approvals",
      plan_minimum: "core",
      visibility_state: row.visibility_state,
    })),
    ...renewalCheckpointRows.map((row) => ({
      organization_id: organizationId,
      workspace_mode: "core",
      required_role_minimum: "viewer",
      feature_family: "renewals",
      source_table: row.source_table,
      source_id: row.source_id,
      record_type: "renewal_checkpoint",
      record_id: row.renewal_checkpoint_id,
      label: `${String(row.checkpoint_type).replace(/_/g, " ")} renewal checkpoint`,
      description_safe: `Renewal · ${String(row.status).replace(/_/g, " ")}`,
      href: `/contracts/${row.contract_id}?tab=dates`,
      rank_terms_safe: [row.checkpoint_type, row.status, "renewal", "checkpoint"],
      workspace_mode_minimum: "core",
      module_key: "renewals",
      plan_minimum: "core",
      visibility_state: row.visibility_state,
    })),
    ...exceptionRows.map((row) => ({
      organization_id: organizationId,
      workspace_mode: "core",
      required_role_minimum: "viewer",
      feature_family: "exceptions",
      source_table: row.source_table,
      source_id: row.source_id,
      record_type: "exception",
      record_id: row.exception_id,
      label: row.title,
      description_safe: `Exception · ${String(row.severity)} · ${String(row.status).replace(/_/g, " ")}`,
      href: `/contracts/exceptions?status=open&contract=${row.contract_id}`,
      rank_terms_safe: [row.title, row.severity, row.status, "exception"],
      workspace_mode_minimum: "core",
      module_key: "exceptions",
      plan_minimum: "core",
      visibility_state: row.visibility_state,
    })),
    ...evidenceStatusRows.map((row) => ({
      organization_id: organizationId,
      workspace_mode: "core",
      required_role_minimum: "viewer",
      feature_family: "evidence",
      source_table: row.source_table,
      source_id: row.source_id,
      record_type: "evidence_request",
      record_id: row.evidence_request_id,
      label: "Evidence request",
      description_safe: `Evidence · ${String(row.status).replace(/_/g, " ")} · ${String(row.external_link_state).replace(/_/g, " ")}`,
      href: `/contracts/${row.contract_id}?tab=overview#contract-evidence`,
      rank_terms_safe: [row.status, row.external_link_state, "evidence", "request"],
      workspace_mode_minimum: "core",
      module_key: "evidence",
      plan_minimum: "core",
      visibility_state: row.visibility_state,
    })),
    ...reportRows.map((row) => ({
      organization_id: organizationId,
      workspace_mode: "core",
      required_role_minimum: "viewer",
      feature_family: "reports",
      source_table: "report_runs",
      source_id: row.report_run_id,
      record_type: "report_run",
      record_id: row.report_run_id,
      label: `${String(row.report_family).replace(/_/g, " ")} run`,
      description_safe: `Report run · ${String(row.status).replace(/_/g, " ")}`,
      href: `/reports?run=${row.report_run_id}`,
      rank_terms_safe: [row.report_family, row.status, "report", "run"],
      workspace_mode_minimum: "core",
      module_key: "reports",
      plan_minimum: "core",
      visibility_state: row.visibility_state,
    })),
    ...jobRows
      .filter((row) => row.job_class === "contract_import" || row.job_class === "export")
      .map((row) => ({
        organization_id: organizationId,
        workspace_mode: "core",
        required_role_minimum: "viewer",
        feature_family: row.job_class === "export" ? "exports" : "imports",
        source_table: row.source_table,
        source_id: row.source_id,
        record_type: row.job_class === "export" ? "export_job" : "import_job",
        record_id: row.job_id,
        label: row.job_class === "export" ? "Export job" : "Import job",
        description_safe: `${String(row.job_class).replace(/_/g, " ")} · ${String(row.status).replace(/_/g, " ")}`,
        href: row.job_class === "export" ? "/settings/health#exports" : "/settings/health#jobs",
        rank_terms_safe: [row.job_class, row.status, row.failure_category, "job"].filter(Boolean).map(String),
        workspace_mode_minimum: "core",
        module_key: row.job_class === "export" ? "exports" : "imports",
        plan_minimum: "core",
        visibility_state: row.visibility_state,
      })),
  ];

  const rawCommandRows = [
    ...contracts.map((contract) => ({
      organization_id: organizationId,
      workspace_mode: "core",
      required_role_minimum: "viewer",
      feature_family: "contracts",
      source_table: "contracts",
      source_id: String(contract.id),
      record_type: "contract",
      record_id: String(contract.id),
      label: String(contract.title ?? "Untitled contract"),
      description_safe: [contract.counterparty, contract.contract_type, contract.status].filter(Boolean).join(" · "),
      href: `/contracts/${contract.id}`,
      rank_terms_safe: [contract.title, contract.counterparty, contract.contract_type].map(String).filter(Boolean),
      workspace_mode_minimum: "core",
      module_key: "contracts",
      plan_minimum: "core",
      visibility_state: "visible",
    })),
    ...workItems.map((item) => ({
      organization_id: organizationId,
      workspace_mode: "core",
      required_role_minimum: "viewer",
      feature_family: "work",
      source_table: item.source_table,
      source_id: item.source_id,
      record_type: "work_item",
      record_id: item.source_id,
      label: item.title,
      description_safe: `${String(item.type).replace(/_/g, " ")} · ${String(item.status).replace(/_/g, " ")}`,
      href: hrefFor({ type: item.type as V10WorkItemType, contractId: item.contract_id, sourceId: item.source_id }),
      rank_terms_safe: [item.title, item.type, item.status],
      workspace_mode_minimum: "core",
      module_key: "work",
      plan_minimum: "core",
      visibility_state: "visible",
    })),
    ...coreSourceCommandRows,
    ...V10_CORE_REPORT_FAMILIES.map((family) => ({
      organization_id: organizationId,
      workspace_mode: "core",
      required_role_minimum: "viewer",
      feature_family: "reports",
      source_table: "v10_report_family",
      source_id: family,
      record_type: "report_family",
      record_id: family,
      label: family.replace(/_/g, " "),
      description_safe: "Core V10 report family",
      href: `/reports?family=${family}`,
      rank_terms_safe: [family, family.replace(/_/g, " "), "report"],
      workspace_mode_minimum: "core",
      module_key: "reports",
      plan_minimum: "core",
      visibility_state: "visible",
    })),
    ...savedViews.map((row) => ({
      organization_id: organizationId,
      workspace_mode: "core",
      required_role_minimum: "viewer",
      feature_family: "reports",
      source_table: "saved_views",
      source_id: String(row.id),
      record_type: "saved_view",
      record_id: String(row.id),
      label: String(row.name ?? "Saved view"),
      description_safe: `${String(row.view_type ?? "contracts").replace(/_/g, " ")} saved view`,
      href: `/contracts?view=${row.id}`,
      rank_terms_safe: [row.name, row.view_type, "saved view", asBoolean(row.pinned) ? "pinned" : null].filter(Boolean).map(String),
      workspace_mode_minimum: "core",
      module_key: "reports",
      plan_minimum: "core",
      visibility_state: "visible",
    })),
    ...accountWorkspaces.map((row) => ({
      organization_id: organizationId,
      workspace_mode: "advanced",
      required_role_minimum: "viewer",
      feature_family: "relationship_workspaces",
      source_table: "account_workspaces",
      source_id: String(row.id),
      record_type: "account",
      record_id: String(row.account_key ?? row.id),
      label: String(row.display_name ?? row.account_key ?? "Account workspace"),
      description_safe: "Account operational summary",
      href: `/accounts/${encodeURIComponent(String(row.account_key ?? row.id))}`,
      rank_terms_safe: [row.display_name, row.account_key, "account", "relationship"].map(String).filter(Boolean),
      workspace_mode_minimum: "advanced",
      module_key: "relationship_workspaces",
      plan_minimum: "advanced",
      visibility_state: "visible",
    })),
    ...counterpartyWorkspaces.map((row) => ({
      organization_id: organizationId,
      workspace_mode: "advanced",
      required_role_minimum: "viewer",
      feature_family: "relationship_workspaces",
      source_table: "counterparty_workspaces",
      source_id: String(row.id),
      record_type: "counterparty",
      record_id: String(row.counterparty_key ?? row.id),
      label: String(row.display_name ?? row.counterparty_key ?? "Counterparty workspace"),
      description_safe: "Counterparty operational summary",
      href: `/counterparties/${encodeURIComponent(String(row.counterparty_key ?? row.id))}`,
      rank_terms_safe: [row.display_name, row.counterparty_key, "counterparty", "relationship"].map(String).filter(Boolean),
      workspace_mode_minimum: "advanced",
      module_key: "relationship_workspaces",
      plan_minimum: "advanced",
      visibility_state: "visible",
    })),
    ...counterpartyWorkspaces.map((row) => ({
      organization_id: organizationId,
      workspace_mode: "advanced",
      required_role_minimum: "viewer",
      feature_family: "relationship_workspaces",
      source_table: "counterparty_workspaces",
      source_id: `${String(row.id)}:relationship`,
      record_type: "relationship",
      record_id: String(row.counterparty_key ?? row.id),
      label: `${String(row.display_name ?? row.counterparty_key ?? "Counterparty")} relationship`,
      description_safe: "Relationship timeline and operating summary",
      href: `/counterparties/${encodeURIComponent(String(row.counterparty_key ?? row.id))}?tab=relationships`,
      rank_terms_safe: [row.display_name, row.counterparty_key, "relationship", "timeline", "account"].map(String).filter(Boolean),
      workspace_mode_minimum: "advanced",
      module_key: "relationship_workspaces",
      plan_minimum: "advanced",
      visibility_state: "visible",
    })),
    ...decisions.map((row) => ({
      organization_id: organizationId,
      workspace_mode: "advanced",
      required_role_minimum: "viewer",
      feature_family: "decisions",
      source_table: "decision_workspaces",
      source_id: String(row.id),
      record_type: "decision",
      record_id: String(row.id),
      label: String(row.title ?? "Decision workspace"),
      description_safe: `${String(row.decision_type ?? "decision").replace(/_/g, " ")} · ${String(row.status ?? "open").replace(/_/g, " ")}`,
      href: `/decisions/${row.id}`,
      rank_terms_safe: [row.title, row.decision_type, row.status, "decision"].map(String).filter(Boolean),
      workspace_mode_minimum: "advanced",
      module_key: "decisions",
      plan_minimum: "advanced",
      visibility_state: "visible",
    })),
    ...campaigns.map((row) => ({
      organization_id: organizationId,
      workspace_mode: "advanced",
      required_role_minimum: "viewer",
      feature_family: "campaigns",
      source_table: "portfolio_campaigns",
      source_id: String(row.id),
      record_type: "campaign",
      record_id: String(row.id),
      label: String(row.name ?? "Portfolio campaign"),
      description_safe: `${String(row.campaign_type ?? "campaign").replace(/_/g, " ")} · ${String(row.status ?? "draft").replace(/_/g, " ")}`,
      href: `/campaigns/${row.id}`,
      rank_terms_safe: [row.name, row.campaign_type, row.status, "campaign"].map(String).filter(Boolean),
      workspace_mode_minimum: "advanced",
      module_key: "campaigns",
      plan_minimum: "advanced",
      visibility_state: "visible",
    })),
    ...findings.map((row) => ({
      organization_id: organizationId,
      workspace_mode: "assurance",
      required_role_minimum: "viewer",
      feature_family: "findings",
      source_table: "assurance_findings",
      source_id: String(row.id),
      record_type: "finding",
      record_id: String(row.id),
      label: String(row.title ?? "Assurance finding"),
      description_safe: `${String(row.severity ?? "medium")} · ${String(row.status ?? "open").replace(/_/g, " ")}`,
      href: `/assurance/findings/${row.id}`,
      rank_terms_safe: [row.title, row.finding_type, row.severity, row.status, "finding"].map(String).filter(Boolean),
      workspace_mode_minimum: "assurance",
      module_key: "findings",
      plan_minimum: "assurance",
      visibility_state: "visible",
    })),
    ...controls.map((row) => ({
      organization_id: organizationId,
      workspace_mode: "assurance",
      required_role_minimum: "viewer",
      feature_family: "control_policies",
      source_table: "control_policies",
      source_id: String(row.id),
      record_type: "control",
      record_id: String(row.id),
      label: String(row.name ?? "Control policy"),
      description_safe: `${String(row.enforcement_mode ?? "observe_only").replace(/_/g, " ")} · ${String(row.status ?? "draft").replace(/_/g, " ")}`,
      href: `/assurance/control-policies/${row.id}`,
      rank_terms_safe: [row.name, row.enforcement_mode, row.status, "control"].map(String).filter(Boolean),
      workspace_mode_minimum: "assurance",
      module_key: "control_policies",
      plan_minimum: "assurance",
      visibility_state: "visible",
    })),
    ...playbookRuns.map((row) => ({
      organization_id: organizationId,
      workspace_mode: "assurance",
      required_role_minimum: "viewer",
      feature_family: "playbooks",
      source_table: "adaptive_playbook_runs",
      source_id: String(row.id),
      record_type: "playbook",
      record_id: String(row.id),
      label: "Adaptive playbook run",
      description_safe: String(row.status ?? "queued").replace(/_/g, " "),
      href: `/assurance/playbooks?run=${encodeURIComponent(String(row.id))}`,
      rank_terms_safe: [row.status, "playbook", "adaptive playbook", "assurance"].map(String).filter(Boolean),
      workspace_mode_minimum: "assurance",
      module_key: "playbooks",
      plan_minimum: "assurance",
      visibility_state: "visible",
    })),
    ...playbookRuns.map((row) => ({
      organization_id: organizationId,
      workspace_mode: "assurance",
      required_role_minimum: "viewer",
      feature_family: "playbooks",
      source_table: "adaptive_playbook_runs",
      source_id: `${String(row.id)}:automation`,
      record_type: "automation_run",
      record_id: String(row.id),
      label: "Automation run",
      description_safe: String(row.status ?? "queued").replace(/_/g, " "),
      href: `/assurance/playbooks?run=${encodeURIComponent(String(row.id))}`,
      rank_terms_safe: [row.status, "automation", "automation approval", "playbook"].map(String).filter(Boolean),
      workspace_mode_minimum: "assurance",
      module_key: "playbooks",
      plan_minimum: "assurance",
      visibility_state: "visible",
    })),
    ...simulations.map((row) => ({
      organization_id: organizationId,
      workspace_mode: "advanced",
      required_role_minimum: "viewer",
      feature_family: "simulations",
      source_table: "change_simulations",
      source_id: String(row.id),
      record_type: "simulation",
      record_id: String(row.id),
      label: String(row.name ?? "Change simulation"),
      description_safe: `${String(row.simulation_type ?? "simulation").replace(/_/g, " ")} · ${String(row.status ?? "completed").replace(/_/g, " ")}`,
      href: `/campaigns/compare?simulation=${encodeURIComponent(String(row.id))}`,
      rank_terms_safe: [row.name, row.simulation_type, row.status, "simulation"].map(String).filter(Boolean),
      workspace_mode_minimum: "advanced",
      module_key: "simulations",
      plan_minimum: "advanced",
      visibility_state: "visible",
    })),
    ...scorecards.map((row) => ({
      organization_id: organizationId,
      workspace_mode: "assurance",
      required_role_minimum: "viewer",
      feature_family: "scorecards",
      source_table: "assurance_scorecards",
      source_id: String(row.id),
      record_type: "scorecard",
      record_id: String(row.id),
      label: String(row.name ?? "Assurance scorecard"),
      description_safe: `Score ${String(row.overall_score ?? "not available")} · ${String(row.status ?? "active").replace(/_/g, " ")}`,
      href: `/assurance/scorecards?scorecard=${encodeURIComponent(String(row.id))}`,
      rank_terms_safe: [row.name, row.status, "scorecard", "assurance"].map(String).filter(Boolean),
      workspace_mode_minimum: "assurance",
      module_key: "scorecards",
      plan_minimum: "assurance",
      visibility_state: "visible",
    })),
    ...reviewBoards.map((row) => ({
      organization_id: organizationId,
      workspace_mode: "assurance",
      required_role_minimum: "viewer",
      feature_family: "review_boards",
      source_table: "review_boards",
      source_id: String(row.id),
      record_type: "review_board",
      record_id: String(row.id),
      label: String(row.name ?? "Review board"),
      description_safe: String(row.status ?? "active").replace(/_/g, " "),
      href: `/assurance/review-boards`,
      rank_terms_safe: [row.name, row.status, "review board", "assurance"].map(String).filter(Boolean),
      workspace_mode_minimum: "assurance",
      module_key: "review_boards",
      plan_minimum: "assurance",
      visibility_state: "visible",
    })),
    ...healthGraphEdges.map((row) => ({
      organization_id: organizationId,
      workspace_mode: "assurance",
      required_role_minimum: "viewer",
      feature_family: "health_graph",
      source_table: "portfolio_health_graph_edges",
      source_id: String(row.id),
      record_type: "health_graph",
      record_id: String(row.id),
      label: "Portfolio health graph",
      description_safe: String(row.edge_type ?? "health relationship").replace(/_/g, " "),
      href: "/assurance/health-graph",
      rank_terms_safe: [row.edge_type, "health graph", "assurance"].map(String).filter(Boolean),
      workspace_mode_minimum: "assurance",
      module_key: "health_graph",
      plan_minimum: "assurance",
      visibility_state: "visible",
    })),
    ...["/settings", "/settings/product", "/settings/health"].map((href) => ({
      organization_id: organizationId,
      workspace_mode: "core",
      required_role_minimum: "viewer",
      feature_family: "settings",
      source_table: "v10_settings_destination",
      source_id: href,
      record_type: "settings_destination",
      record_id: href,
      label: href === "/settings/product" ? "Product experience settings" : href === "/settings/health" ? "Workspace health settings" : "Settings",
      description_safe: "V10 settings destination",
      href,
      rank_terms_safe: [href, "settings", "workspace health", "product experience"],
      workspace_mode_minimum: "core",
      module_key: "settings",
      plan_minimum: "core",
      visibility_state: "visible",
    })),
  ];
  const commandRows = rawCommandRows.map((row) => ({
    ...row,
    href: sanitizeV10InternalHref(row.href),
    updated_at: refreshedAt,
  }));

  const auditReadModelRows = auditEvents.map((row) => ({
    ...sharedReadModelRow({
      organizationId,
      featureFamily: "audit",
      sourceTable: "v10_audit_events",
      sourceId: String(row.audit_event_id),
      createdAt: asString(row.created_at),
      updatedAt: asString(row.created_at),
    }),
    audit_event_id: String(row.audit_event_id),
    actor_user_id: asString(row.actor_user_id),
    actor_type: String(row.actor_type ?? "system"),
    action: String(row.action ?? "unknown"),
    target_type: String(row.target_type ?? "contract"),
    target_id: String(row.target_id ?? ""),
    contract_id: asString(row.contract_id),
    outcome: String(row.outcome ?? "success"),
    before_state_hash: null,
    after_state_hash: null,
    safe_metadata: asObject(row.safe_metadata),
    created_at: asString(row.created_at) ?? now.toISOString(),
    diagnostic_id: asString(row.diagnostic_id),
  }));

  const advancedLinkedRows = [
    ...accountWorkspaces.map((row) => ({
      ...sharedReadModelRow({
        organizationId,
        featureFamily: "relationship_workspaces",
        sourceTable: "account_workspaces",
        sourceId: String(row.id),
        createdAt: asString(row.created_at),
        updatedAt: asString(row.updated_at),
      }),
      workspace_mode: "advanced",
      record_type: "account",
      record_id: String(row.account_key ?? row.id),
      workspace_mode_minimum: "advanced",
      status: String(asObject(row.health_signal_json).status ?? "visible"),
      owner_user_id: asString(row.owner_user_id),
      source_contract_ids: asStringArray(asObject(row.summary_json).contract_ids),
      generated_work_item_ids: [],
      command_search_record_id: String(row.account_key ?? row.id),
      audit_event_ids: getAuditIds("account", row.id),
    })),
    ...counterpartyWorkspaces.map((row) => ({
      ...sharedReadModelRow({
        organizationId,
        featureFamily: "relationship_workspaces",
        sourceTable: "counterparty_workspaces",
        sourceId: String(row.id),
        createdAt: asString(row.created_at),
        updatedAt: asString(row.updated_at),
      }),
      workspace_mode: "advanced",
      record_type: "counterparty",
      record_id: String(row.counterparty_key ?? row.id),
      workspace_mode_minimum: "advanced",
      status: String(asObject(row.health_signal_json).status ?? "visible"),
      owner_user_id: asString(row.owner_user_id),
      source_contract_ids: asStringArray(asObject(row.summary_json).contract_ids),
      generated_work_item_ids: [],
      command_search_record_id: String(row.counterparty_key ?? row.id),
      audit_event_ids: getAuditIds("counterparty", row.id),
    })),
    ...counterpartyWorkspaces.map((row) => ({
      ...sharedReadModelRow({
        organizationId,
        featureFamily: "relationship_workspaces",
        sourceTable: "counterparty_workspaces",
        sourceId: `${String(row.id)}:relationship`,
        createdAt: asString(row.created_at),
        updatedAt: asString(row.updated_at),
      }),
      workspace_mode: "advanced",
      record_type: "relationship",
      record_id: String(row.counterparty_key ?? row.id),
      workspace_mode_minimum: "advanced",
      status: String(asObject(row.health_signal_json).status ?? "visible"),
      owner_user_id: asString(row.owner_user_id),
      source_contract_ids: asStringArray(asObject(row.summary_json).contract_ids),
      generated_work_item_ids: [],
      command_search_record_id: String(row.counterparty_key ?? row.id),
      audit_event_ids: getAuditIds("relationship", row.id),
    })),
    ...decisions.map((row) => ({
      ...sharedReadModelRow({
        organizationId,
        featureFamily: "decisions",
        sourceTable: "decision_workspaces",
        sourceId: String(row.id),
        createdAt: asString(row.created_at),
        updatedAt: asString(row.updated_at),
      }),
      workspace_mode: "advanced",
      record_type: "decision",
      record_id: String(row.id),
      workspace_mode_minimum: "advanced",
      status: String(row.status ?? "open"),
      owner_user_id: asString(row.owner_user_id),
      source_contract_ids: asStringArray(row.linked_contract_ids),
      generated_work_item_ids: workItems
        .filter((item) => item.source_table === "decision_workspaces" && item.source_id === String(row.id))
        .map((item) => item.source_id),
      command_search_record_id: String(row.id),
      audit_event_ids: getAuditIds("decision", row.id),
    })),
    ...campaigns.map((row) => ({
      ...sharedReadModelRow({
        organizationId,
        featureFamily: "campaigns",
        sourceTable: "portfolio_campaigns",
        sourceId: String(row.id),
        createdAt: asString(row.created_at),
        updatedAt: asString(row.updated_at),
      }),
      workspace_mode: "advanced",
      record_type: "campaign",
      record_id: String(row.id),
      workspace_mode_minimum: "advanced",
      status: String(row.status ?? "draft"),
      owner_user_id: asString(row.owner_user_id),
      source_contract_ids: asStringArray(asObject(row.progress_summary_json).contract_ids),
      generated_work_item_ids: workItems
        .filter((item) => item.source_table === "portfolio_campaigns" && item.source_id === String(row.id))
        .map((item) => item.source_id),
      command_search_record_id: String(row.id),
      audit_event_ids: getAuditIds("campaign", row.id),
    })),
    ...simulations.map((row) => ({
      ...sharedReadModelRow({
        organizationId,
        featureFamily: "simulations",
        sourceTable: "change_simulations",
        sourceId: String(row.id),
        createdAt: asString(row.created_at),
        updatedAt: asString(row.updated_at),
      }),
      workspace_mode: "advanced",
      record_type: "simulation",
      record_id: String(row.id),
      workspace_mode_minimum: "advanced",
      status: String(row.status ?? "completed"),
      owner_user_id: asString(row.owner_user_id),
      source_contract_ids: asStringArray(asObject(row.input_json).contract_ids),
      generated_work_item_ids: [],
      command_search_record_id: String(row.id),
      audit_event_ids: getAuditIds("simulation", row.id),
    })),
    ...findings.map((row) => ({
      ...sharedReadModelRow({
        organizationId,
        featureFamily: "findings",
        sourceTable: "assurance_findings",
        sourceId: String(row.id),
        createdAt: asString(row.created_at),
        updatedAt: asString(row.updated_at),
      }),
      workspace_mode: "assurance",
      record_type: "finding",
      record_id: String(row.id),
      workspace_mode_minimum: "assurance",
      status: String(row.status ?? "open"),
      owner_user_id: asString(asObject(row.linked_entities_json).owner_user_id),
      source_contract_ids: asStringArray(asObject(row.linked_entities_json).contract_ids),
      generated_work_item_ids: workItems
        .filter((item) => item.source_table === "assurance_findings" && item.source_id === String(row.id))
        .map((item) => item.source_id),
      command_search_record_id: String(row.id),
      audit_event_ids: getAuditIds("finding", row.id),
    })),
    ...controls.map((row) => ({
      ...sharedReadModelRow({
        organizationId,
        featureFamily: "control_policies",
        sourceTable: "control_policies",
        sourceId: String(row.id),
        createdAt: asString(row.created_at),
        updatedAt: asString(row.updated_at),
      }),
      workspace_mode: "assurance",
      record_type: "control",
      record_id: String(row.id),
      workspace_mode_minimum: "assurance",
      status: String(row.status ?? "draft"),
      owner_user_id: null,
      source_contract_ids: asStringArray(asObject(row.severity_model_json).contract_ids),
      generated_work_item_ids: [],
      command_search_record_id: String(row.id),
      audit_event_ids: getAuditIds("control", row.id),
    })),
    ...playbookRuns.map((row) => ({
      ...sharedReadModelRow({
        organizationId,
        featureFamily: "playbooks",
        sourceTable: "adaptive_playbook_runs",
        sourceId: String(row.id),
        createdAt: asString(row.created_at),
        updatedAt: asString(row.updated_at),
      }),
      workspace_mode: "assurance",
      record_type: "playbook",
      record_id: String(row.id),
      workspace_mode_minimum: "assurance",
      status: String(row.status ?? "queued"),
      owner_user_id: asString(row.run_by),
      source_contract_ids: [],
      generated_work_item_ids: workItems
        .filter((item) => item.source_table === "adaptive_playbook_runs" && item.source_id === String(row.id))
        .map((item) => item.source_id),
      command_search_record_id: String(row.id),
      audit_event_ids: getAuditIds("playbook", row.id),
    })),
    ...playbookRuns.map((row) => ({
      ...sharedReadModelRow({
        organizationId,
        featureFamily: "playbooks",
        sourceTable: "adaptive_playbook_runs",
        sourceId: `${String(row.id)}:automation`,
        createdAt: asString(row.created_at),
        updatedAt: asString(row.updated_at),
      }),
      workspace_mode: "assurance",
      record_type: "automation_run",
      record_id: String(row.id),
      workspace_mode_minimum: "assurance",
      status: String(row.status ?? "queued"),
      owner_user_id: asString(row.run_by),
      source_contract_ids: [],
      generated_work_item_ids: workItems
        .filter((item) => item.source_table === "adaptive_playbook_runs" && item.source_id === String(row.id))
        .map((item) => item.source_id),
      command_search_record_id: String(row.id),
      audit_event_ids: getAuditIds("automation_run", row.id),
    })),
    ...scorecards.map((row) => ({
      ...sharedReadModelRow({
        organizationId,
        featureFamily: "scorecards",
        sourceTable: "assurance_scorecards",
        sourceId: String(row.id),
        createdAt: asString(row.created_at),
        updatedAt: asString(row.updated_at),
      }),
      workspace_mode: "assurance",
      record_type: "scorecard",
      record_id: String(row.id),
      workspace_mode_minimum: "assurance",
      status: String(row.status ?? "active"),
      owner_user_id: asString(row.owner_user_id),
      source_contract_ids: [],
      generated_work_item_ids: [],
      command_search_record_id: String(row.id),
      audit_event_ids: getAuditIds("scorecard", row.id),
    })),
    ...reviewBoards.map((row) => ({
      ...sharedReadModelRow({
        organizationId,
        featureFamily: "review_boards",
        sourceTable: "review_boards",
        sourceId: String(row.id),
        createdAt: asString(row.created_at),
        updatedAt: asString(row.updated_at),
      }),
      workspace_mode: "assurance",
      record_type: "review_board",
      record_id: String(row.id),
      workspace_mode_minimum: "assurance",
      status: String(row.status ?? "active"),
      owner_user_id: asString(row.owner_user_id),
      source_contract_ids: [],
      generated_work_item_ids: [],
      command_search_record_id: String(row.id),
      audit_event_ids: getAuditIds("review_board", row.id),
    })),
    ...healthGraphEdges.map((row) => ({
      ...sharedReadModelRow({
        organizationId,
        featureFamily: "health_graph",
        sourceTable: "portfolio_health_graph_edges",
        sourceId: String(row.id),
        createdAt: asString(row.created_at),
        updatedAt: asString(row.updated_at),
      }),
      workspace_mode: "assurance",
      record_type: "health_graph",
      record_id: String(row.id),
      workspace_mode_minimum: "assurance",
      status: "visible",
      owner_user_id: null,
      source_contract_ids: [],
      generated_work_item_ids: [],
      command_search_record_id: String(row.id),
      audit_event_ids: getAuditIds("health_graph", row.id),
    })),
  ];

  const genericReadModels: Record<string, Row[]> = {
    activation_state: activationRows,
    work_items: workItems,
    contract_health_snapshots: healthRows,
    contract_activity_events: contractActivityRows,
    field_provenance_records: fieldProvenanceRows,
    renewal_posture_snapshots: renewalPostureRows,
    evidence_request_statuses: evidenceStatusRows,
    obligation_records: obligationRows,
    approval_records: approvalRows,
    exception_records: exceptionRows,
    notification_deliveries: notificationRows,
    renewal_checkpoint_records: renewalCheckpointRows,
    external_evidence_submissions: externalSubmissionRows,
    audit_events: auditReadModelRows,
    job_run_visibility: jobRows,
    report_run_visibility: reportRows,
    command_search_index: commandRows,
    advanced_assurance_linked_records: advancedLinkedRows,
  };
  const scopedGenericReadModels = Object.fromEntries(
    Object.entries(genericReadModels).map(([modelKey, rows]) => [
      modelKey,
      selectedModelKeys.includes(modelKey as V10ReadModelKey)
        ? scopeV10Rows(rows, scopedContractId).filter((row) => rowChangedSince(row, changedSinceMs))
        : [],
    ])
  ) as Record<V10ReadModelKey, Row[]>;

  const readModelRows = selectedModelKeys.flatMap((modelKey) =>
    (scopedGenericReadModels[modelKey] ?? []).map((row) => ({
      organization_id: organizationId,
      workspace_mode: String(row.workspace_mode ?? "core"),
      required_role_minimum: String(row.required_role_minimum ?? "viewer"),
      feature_family: String(row.feature_family ?? modelKey),
      source_table: String(row.source_table ?? modelKey),
      source_id: String(row.source_id ?? row.id ?? modelKey),
      model_key: modelKey,
      fields: {
        ...row,
        v10_refresh: {
          refresh_job_id: refreshJobId,
          refresh_reason: refreshReason,
          refreshed_at: refreshedAt,
          source_count: sourceCounts[String(row.source_table ?? modelKey)] ?? 0,
        },
      },
      visibility_state: String(row.visibility_state ?? "visible"),
      created_at: asString(row.created_at) ?? refreshedAt,
      updated_at: asString(row.updated_at) ?? refreshedAt,
      deleted_at: null,
      archived_at: null,
    }))
  );
  const lineageRows = readModelRows.map((row) => ({
    organization_id: organizationId,
    workspace_mode: String(row.workspace_mode ?? "core"),
    required_role_minimum: String(row.required_role_minimum ?? "admin"),
    feature_family: String(row.feature_family ?? row.model_key),
    refresh_job_id: refreshJobId,
    model_key: row.model_key,
    target_model: row.model_key,
    read_model_table: `v10_${row.model_key}`,
    read_model_source_table: row.source_table,
    read_model_source_id: row.source_id,
    source_table: row.source_table,
    source_id: row.source_id,
    audit_event_id: null,
    spec_requirement_id: `v10-read-model:${row.model_key}`,
    visibility_state: row.visibility_state,
    created_at: refreshedAt,
    updated_at: refreshedAt,
  }));
  const artifactRows = [
    ...reportRows
      .filter((row) => asString(row.artifact_url))
      .map((row) => ({
        organization_id: organizationId,
        workspace_mode: "core",
        required_role_minimum: "admin",
        feature_family: "reports",
        artifact_key: `report:${row.report_run_id}`,
        artifact_kind: "report",
        source_type: "report_run",
        source_id: row.report_run_id,
        checksum: null,
        classification: "support_safe",
        access_scope: "organization",
        evidence_key: `report_run:${row.report_run_id}`,
        diagnostic_id: row.diagnostic_id,
        href: row.artifact_url,
        expires_at: null,
        revoked_at: null,
        visibility_state: row.visibility_state,
        created_at: refreshedAt,
        updated_at: refreshedAt,
      })),
    ...exportJobs.map((row) => ({
      organization_id: organizationId,
      workspace_mode: "core",
      required_role_minimum: "admin",
      feature_family: "reports",
      artifact_key: `export:${String(row.id)}`,
      artifact_kind: "export",
      source_type: "export_job",
      source_id: String(row.id),
      checksum: asString(asObject(row.metrics_json).checksum),
      classification: "customer_private",
      access_scope: "actor",
      evidence_key: `export_job:${String(row.id)}`,
      diagnostic_id: row.truncated === true || asString(row.error_message) ? `export_${row.id}` : null,
      href: null,
      expires_at: null,
      revoked_at: null,
      visibility_state: "visible",
      created_at: refreshedAt,
      updated_at: refreshedAt,
    })),
  ];
  const scopedArtifactRows = scopedContractId ? scopeV10Rows(artifactRows, scopedContractId) : artifactRows;
  const coverageRows = buildV10RuntimeCoverageLedgerRows({
    organizationId,
    refreshedAt,
    freshnessState: sourceFailures.length > 0 ? "partial" : "fresh",
  });
  const writeBatches: readonly { table: string; rows: Row[] }[] = [
    { table: "v10_read_model_rows", rows: readModelRows },
    { table: "v10_work_items", rows: scopedGenericReadModels.work_items },
    { table: "v10_contract_health_snapshots", rows: scopedGenericReadModels.contract_health_snapshots },
    { table: "v10_activation_state", rows: scopedGenericReadModels.activation_state },
    { table: "v10_contract_activity_events", rows: scopedGenericReadModels.contract_activity_events },
    { table: "v10_field_provenance_records", rows: scopedGenericReadModels.field_provenance_records },
    { table: "v10_renewal_posture_snapshots", rows: scopedGenericReadModels.renewal_posture_snapshots },
    { table: "v10_evidence_request_statuses", rows: scopedGenericReadModels.evidence_request_statuses },
    { table: "v10_obligation_records", rows: scopedGenericReadModels.obligation_records },
    { table: "v10_approval_records", rows: scopedGenericReadModels.approval_records },
    { table: "v10_exception_records", rows: scopedGenericReadModels.exception_records },
    { table: "v10_notification_deliveries", rows: scopedGenericReadModels.notification_deliveries },
    { table: "v10_renewal_checkpoint_records", rows: scopedGenericReadModels.renewal_checkpoint_records },
    { table: "v10_external_evidence_submissions", rows: scopedGenericReadModels.external_evidence_submissions },
    { table: "v10_job_run_visibility", rows: scopedGenericReadModels.job_run_visibility },
    { table: "v10_report_run_visibility", rows: scopedGenericReadModels.report_run_visibility },
    { table: "v10_command_search_index", rows: scopedGenericReadModels.command_search_index },
    { table: "v10_advanced_assurance_linked_records", rows: scopedGenericReadModels.advanced_assurance_linked_records },
    { table: "v10_read_model_lineage", rows: lineageRows },
    { table: "v10_runtime_artifacts", rows: scopedArtifactRows },
    { table: "v10_runtime_coverage_ledger", rows: coverageRows },
  ];
  const replaceCandidateBatches = writeBatches.filter((batch) => batch.rows.length > 0);

  const writeFailures =
    refreshScope === "dry_run" || sourceFailures.length > 0
      ? []
      : (
          await Promise.all(
            replaceCandidateBatches.map((batch) => replaceRows(admin, batch.table, organizationId, batch.rows, refreshedAt))
          )
        ).filter((failure): failure is string => Boolean(failure));

  const targetCounts = {
    work_items: scopedGenericReadModels.work_items.length,
    contract_health_snapshots: scopedGenericReadModels.contract_health_snapshots.length,
    activation_state: scopedGenericReadModels.activation_state.length,
    read_model_rows: readModelRows.length,
    contract_activity_events: scopedGenericReadModels.contract_activity_events.length,
    field_provenance_records: scopedGenericReadModels.field_provenance_records.length,
    renewal_posture_snapshots: scopedGenericReadModels.renewal_posture_snapshots.length,
    evidence_request_statuses: scopedGenericReadModels.evidence_request_statuses.length,
    obligation_records: scopedGenericReadModels.obligation_records.length,
    approval_records: scopedGenericReadModels.approval_records.length,
    exception_records: scopedGenericReadModels.exception_records.length,
    notification_deliveries: scopedGenericReadModels.notification_deliveries.length,
    renewal_checkpoint_records: scopedGenericReadModels.renewal_checkpoint_records.length,
    external_evidence_submissions: scopedGenericReadModels.external_evidence_submissions.length,
    audit_events: scopedGenericReadModels.audit_events.length,
    job_run_visibility: scopedGenericReadModels.job_run_visibility.length,
    report_run_visibility: scopedGenericReadModels.report_run_visibility.length,
    command_search_index: scopedGenericReadModels.command_search_index.length,
    advanced_assurance_linked_records: scopedGenericReadModels.advanced_assurance_linked_records.length,
    read_model_lineage: lineageRows.length,
    runtime_artifacts: scopedArtifactRows.length,
    runtime_coverage_ledger: coverageRows.length,
  };
  const failedSourceTables = sourceFailures.map((failure) => failure.replace(/^\[v10-refresh\] query ([^ ]+) failed:[\s\S]*$/, "$1"));
  const modelFreshnessState = getV10FreshnessState({
    sourceFailures,
    writeFailures: [...refreshJobFailures, ...writeFailures],
    sourceCounts,
    targetCounts,
    refreshedAtMs: Date.parse(refreshedAt),
    latestSourceUpdatedAtMs,
  });
  const backfillPlan = buildV10ReadModelBackfillPlan({
    sourceCounts,
    targetCounts,
    freshnessState: modelFreshnessState,
    refreshScope,
  });
  const refreshJobCompleteFailure = await completeV10RefreshJob(admin, {
    organizationId,
    refreshJobId,
    refreshedAt,
    ok: sourceFailures.length === 0 && writeFailures.length === 0 && refreshJobFailures.length === 0,
    sourceCounts,
    targetCounts,
    failures: [...refreshJobFailures, ...sourceFailures, ...writeFailures],
    failedSourceTables,
    staleSourceTables: backfillPlan.staleSourceTables,
    driftState: modelFreshnessState,
  });
  if (refreshJobCompleteFailure) refreshJobFailures.push(refreshJobCompleteFailure);
  const refreshFailures = [...refreshJobFailures, ...sourceFailures, ...writeFailures];
  const writeFailureCount = refreshJobFailures.length + writeFailures.length;
  const partialFailureCount = failedSourceTables.length + writeFailureCount;
  const diagnosticFreshnessState: V10ReadModelFreshnessState =
    refreshFailures.length === 0
      ? modelFreshnessState
      : sourceFailures.length > 0
        ? "partial"
        : modelFreshnessState === "stale"
          ? "stale"
          : "failed";
  const diagnosticBackfillPlan =
    diagnosticFreshnessState === modelFreshnessState
      ? backfillPlan
      : buildV10ReadModelBackfillPlan({
          sourceCounts,
          targetCounts,
          freshnessState: diagnosticFreshnessState,
          refreshScope,
        });

  return {
    ok: refreshFailures.length === 0,
    failures: refreshFailures,
    counts: targetCounts,
    sourceCounts,
    targetCounts,
    diagnostics: {
      refresh_job_id: refreshJobId,
      refresh_reason: refreshReason,
      refresh_scope: refreshScope,
      refreshed_at: refreshedAt,
      dry_run: refreshScope === "dry_run",
      scoped_contract_id: scopedContractId,
      changed_since: options.changedSince?.toISOString() ?? null,
      selected_model_keys: selectedModelKeys,
      archived_before_upsert_tables: refreshScope === "dry_run" || sourceFailures.length > 0 ? [] : replaceCandidateBatches.map((batch) => batch.table),
      failed_source_tables: failedSourceTables,
      stale_source_tables: [...diagnosticBackfillPlan.staleSourceTables],
      expected_source_table_count: diagnosticBackfillPlan.expectedSourceTables.length,
      missing_source_tables: [...diagnosticBackfillPlan.missingSourceTables],
      missing_target_models: [...diagnosticBackfillPlan.missingTargetModels],
      repair_recommendation: diagnosticBackfillPlan.repairRecommendation,
      partial_failure_count: partialFailureCount,
      write_failure_count: writeFailureCount,
      refresh_failure_count: refreshFailures.length,
      model_freshness_state: diagnosticFreshnessState,
      source_count_total: Object.values(sourceCounts).reduce((sum, count) => sum + count, 0),
      target_count_total: Object.values(targetCounts).reduce((sum, count) => sum + count, 0),
      lineage_count: lineageRows.length,
      artifact_count: artifactRows.length,
      coverage_count: coverageRows.length,
    },
  };
}

