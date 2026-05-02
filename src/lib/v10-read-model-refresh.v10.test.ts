import { describe, expect, it } from "vitest";
import {
  V10_READ_MODEL_REFRESH_DEFERRED_SOURCE_TABLES,
  V10_READ_MODEL_REFRESH_INDIRECT_SOURCE_TABLES,
  V10_READ_MODEL_REFRESH_SOURCE_TABLES,
  buildV10ReadModelRefreshEventPlan,
  buildV10ReadModelBackfillPlan,
  refreshV10ReadModelsForOrganization,
  validateV10ReadModelRefreshDiagnostics,
  validateV10ReadModelRefreshCoverage,
} from "./v10-read-model-refresh";
import { V10_REQUIRED_READ_MODEL_KEYS } from "./v10-read-models";
import { V10_READ_MODEL_FIELDS } from "./v10-release-contract";
import { getV10RouteTemplateForHref } from "./v10-route-api-catalog";
import { V10_RUNTIME_COVERAGE_LEDGER } from "./v10-traceability-ledger";

type FakeTableData = Record<string, Record<string, unknown>[]>;

function makeFakeAdmin(seed: FakeTableData) {
  const inserted: FakeTableData = {};
  const updated: FakeTableData = {};
  const upsertConflicts: Record<string, string | undefined> = {};
  class Query implements PromiseLike<{ data: Record<string, unknown>[]; error: null }> {
    private table: string;
    private writeRows: Record<string, unknown>[] | null = null;
    private rangeStart = 0;
    private rangeEnd: number | null = null;

    constructor(table: string) {
      this.table = table;
    }

    select() {
      return this;
    }

    eq() {
      return this;
    }

    limit() {
      return this;
    }

    order() {
      return this;
    }

    range(from: number, to: number) {
      this.rangeStart = from;
      this.rangeEnd = to;
      return this;
    }

    update(row: Record<string, unknown>) {
      updated[this.table] = [row];
      return this;
    }

    delete() {
      inserted[this.table] = [];
      return this;
    }

    insert(rows: Record<string, unknown>[]) {
      this.writeRows = rows;
      inserted[this.table] = rows;
      return Promise.resolve({ error: null });
    }

    upsert(rows: Record<string, unknown>[], options?: { onConflict?: string }) {
      this.writeRows = rows;
      inserted[this.table] = rows;
      upsertConflicts[this.table] = options?.onConflict;
      return Promise.resolve({ error: null });
    }

    then<TResult1 = { data: Record<string, unknown>[]; error: null }, TResult2 = never>(
      onfulfilled?: ((value: { data: Record<string, unknown>[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ): PromiseLike<TResult1 | TResult2> {
      const sourceRows = this.writeRows ?? seed[this.table] ?? [];
      const data = this.rangeEnd === null ? sourceRows : sourceRows.slice(this.rangeStart, this.rangeEnd + 1);
      const value = { data, error: null as null };
      return Promise.resolve(value).then(onfulfilled, onrejected);
    }
  }
  return {
    inserted,
    updated,
    upsertConflicts,
    from(table: string) {
      return new Query(table);
    },
  };
}

describe("V10 read model refresh", () => {
  it("keeps source-object inventory covered by direct, indirect, or deferred refresh contracts", () => {
    expect(validateV10ReadModelRefreshCoverage()).toEqual([]);
    expect(V10_READ_MODEL_REFRESH_INDIRECT_SOURCE_TABLES).toEqual(
      expect.arrayContaining([
        "contract_files",
        "reminders",
        "organization_workflow_settings",
        "notification_destinations",
        "portfolio_programs",
        "v10_runtime_artifacts",
      ])
    );
    expect(V10_READ_MODEL_REFRESH_DEFERRED_SOURCE_TABLES).toEqual(
      expect.arrayContaining(["billing_sync_jobs"])
    );
    expect(
      validateV10ReadModelRefreshCoverage([
        {
          sourceObjectType: "contract",
          sourceTable: "unmapped_contract_source",
          organizationScope: "required",
          ownerField: null,
          statusField: null,
          dueField: null,
          visibilityField: null,
          featureFamily: "contracts",
          minimumMode: "core",
          workItemType: null,
          readModels: ["command_search_index"],
          commandSearch: "required",
          auditActions: ["contract.created"],
          telemetryObjectives: ["activation_first_work_item"],
          reportExportInclusion: "required",
          retentionPolicy: "source_retained",
          autonomousStatus: "runtime_mapped",
          tests: ["src/lib/v10-read-model-refresh.v10.test.ts"],
        },
      ])
    ).toEqual(expect.arrayContaining(["source_inventory_table_uncovered:contract:unmapped_contract_source"]));
  });

  it("maps source events to scoped read-model refresh options with lineage required", () => {
    const taskPlan = buildV10ReadModelRefreshEventPlan({
      organizationId: "org_1",
      sourceTable: "contract_tasks",
      sourceId: "task_1",
      contractId: "contract_1",
      mutationKey: "work.complete",
      changedAt: new Date("2026-04-25T00:00:00Z"),
    });

    expect(taskPlan).toMatchObject({
      targetModels: ["work_items", "contract_activity_events", "command_search_index"],
      lineageRequired: true,
      refreshReason: "event:contract_tasks:work.complete",
      refreshOptions: {
        reason: "event:contract_tasks:work.complete",
        refreshScope: "one_contract",
        contractId: "contract_1",
        modelKeys: ["work_items", "contract_activity_events", "command_search_index"],
        changedSince: new Date("2026-04-25T00:00:00Z"),
      },
    });

    const reportPlan = buildV10ReadModelRefreshEventPlan({
      organizationId: "org_1",
      sourceTable: "report_runs",
      sourceId: "report_1",
    });

    expect(reportPlan.refreshOptions.refreshScope).toBe("incremental");
    expect(reportPlan.targetModels).toEqual(["report_run_visibility", "job_run_visibility"]);
  });

  it("materializes work, health, activation, job visibility, report visibility, and command search rows", async () => {
    const orgId = "org_1";
    const admin = makeFakeAdmin({
      contracts: [
        {
          id: "contract_1",
          organization_id: orgId,
          title: "Master services agreement",
          counterparty: "Acme",
          contract_type: "msa",
          status: "active",
          owner_id: null,
          created_at: "2026-04-20T00:00:00Z",
          updated_at: "2026-04-25T00:00:00Z",
        },
      ],
      extracted_fields: [
        { id: "field_1", contract_id: "contract_1", field_name: "title", field_value: "Master services agreement", status: "approved", created_at: "2026-04-21T00:00:00Z", updated_at: "2026-04-21T00:00:00Z" },
        { id: "field_2", contract_id: "contract_1", field_name: "end_date", field_value: "2027-04-25", status: "approved", created_at: "2026-04-21T00:00:00Z", updated_at: "2026-04-22T00:00:00Z" },
        { id: "field_3", contract_id: "contract_1", field_name: "renewal_date", field_value: "2027-03-25", status: "approved", created_at: "2026-04-21T00:00:00Z", updated_at: "2026-04-22T00:00:00Z" },
        { id: "field_4", contract_id: "contract_1", field_name: "notice_deadline", field_value: "2027-02-25", status: "approved", created_at: "2026-04-21T00:00:00Z", updated_at: "2026-04-23T00:00:00Z" },
        { id: "field_5", contract_id: "contract_1", field_name: "governing_law", field_value: "Delaware", status: "pending", created_at: "2026-04-21T00:00:00Z", updated_at: "2026-04-23T00:00:00Z" },
      ],
      contract_tasks: [
        {
          id: "task_1",
          contract_id: "contract_1",
          title: "Review missing fields",
          status: "open",
          priority: "high",
          assignee_id: "user_1",
          due_date: "2026-04-20",
          created_at: "2026-04-20T00:00:00Z",
          updated_at: "2026-04-24T00:00:00Z",
        },
      ],
      contract_obligations: [
        {
          id: "obligation_1",
          contract_id: "contract_1",
          title: "Provide SOC report",
          status: "open",
          due_date: "2026-04-20",
          evidence_notes: "SOC 2 report required",
          created_at: "2026-04-20T00:00:00Z",
          updated_at: "2026-04-24T00:00:00Z",
        },
      ],
      contract_approvals: [
        {
          id: "approval_1",
          contract_id: "contract_1",
          approval_type: "legal",
          status: "pending",
          approver_id: "user_1",
          due_at: "2026-04-20T00:00:00Z",
          created_at: "2026-04-20T00:00:00Z",
          updated_at: "2026-04-24T00:00:00Z",
        },
      ],
      exceptions: [
        {
          id: "exception_1",
          contract_id: "contract_1",
          title: "High risk exception",
          severity: "high",
          status: "open",
          owner_id: null,
          due_date: "2026-04-20",
          linked_entity_type: "contract_obligation",
          linked_entity_id: "obligation_1",
          resolution_note: "Escalate to owner",
          created_at: "2026-04-20T00:00:00Z",
          updated_at: "2026-04-24T00:00:00Z",
        },
      ],
      evidence_requirements: [
        {
          id: "evidence_1",
          contract_id: "contract_1",
          work_item_id: "task_1",
          title: "SOC 2 evidence",
          status: "rejected",
          reviewer_id: "user_1",
          due_at: "2026-04-20T00:00:00Z",
          config_json: { external_token_hash: "hash" },
          created_at: "2026-04-20T00:00:00Z",
          updated_at: "2026-04-24T00:00:00Z",
        },
      ],
      contract_renewal_checkpoints: [
        {
          id: "checkpoint_1",
          contract_id: "contract_1",
          task_key: "notice_deadline",
          status: "open",
          due_date: "2026-04-20",
          workspace_json: { owner_user_id: "user_1", reminder_eligible: true },
          created_at: "2026-04-20T00:00:00Z",
          updated_at: "2026-04-24T00:00:00Z",
        },
      ],
      evidence_submissions: [
        {
          id: "submission_1",
          requirement_id: "evidence_1",
          status: "rejected",
          submitted_at: "2026-04-23T00:00:00Z",
          payload_json: { submitter_email: "redacted@example.com", files: ["pdf"] },
          rejection_reason: "Needs current report",
          created_at: "2026-04-23T00:00:00Z",
        },
      ],
      notification_deliveries: [
        {
          id: "notification_1",
          channel: "email",
          notification_type: "evidence_rejected",
          status: "failed",
          last_error: "SMTP unavailable",
          metadata: { contract_id: "contract_1", source_type: "evidence_request", source_id: "evidence_1" },
          created_at: "2026-04-25T00:00:00Z",
          updated_at: "2026-04-25T00:00:00Z",
        },
      ],
      v10_audit_events: [
        {
          audit_event_id: "audit_1",
          actor_user_id: "user_1",
          actor_type: "user",
          action: "evidence_request.rejected",
          target_type: "evidence_request",
          target_id: "evidence_1",
          contract_id: "contract_1",
          outcome: "success",
          safe_metadata: {},
          created_at: "2026-04-25T00:00:00Z",
        },
      ],
      account_workspaces: [
        { id: "account_1", account_key: "acme", display_name: "Acme account", created_at: "2026-04-20T00:00:00Z" },
      ],
      counterparty_workspaces: [
        { id: "counterparty_1", counterparty_key: "acme-inc", display_name: "Acme Inc", created_at: "2026-04-20T00:00:00Z" },
      ],
      decision_workspaces: [
        { id: "decision_1", title: "Renewal decision", decision_type: "renewal_recommendation", status: "open", created_at: "2026-04-20T00:00:00Z" },
      ],
      portfolio_campaigns: [
        { id: "campaign_1", name: "Notice campaign", campaign_type: "renewal_notice", status: "active", created_at: "2026-04-20T00:00:00Z" },
      ],
      change_simulations: [
        { id: "simulation_1", name: "Renewal simulation", simulation_type: "renewal", status: "completed", owner_user_id: "user_1", input_json: { contract_ids: ["contract_1"] }, created_at: "2026-04-20T00:00:00Z" },
      ],
      assurance_findings: [
        { id: "finding_1", title: "Control gap", finding_type: "control_gap", severity: "high", status: "open", created_at: "2026-04-20T00:00:00Z" },
      ],
      control_policies: [
        { id: "control_1", name: "Evidence policy", status: "published", enforcement_mode: "warn", created_at: "2026-04-20T00:00:00Z" },
      ],
      adaptive_playbook_runs: [
        { id: "playbook_run_1", status: "awaiting_approval", run_by: "user_1", created_at: "2026-04-25T00:00:00Z" },
      ],
      assurance_scorecards: [
        { id: "scorecard_1", name: "Control scorecard", status: "active", owner_user_id: "user_1", overall_score: 82, created_at: "2026-04-20T00:00:00Z" },
      ],
      review_boards: [
        { id: "review_board_1", name: "Assurance board", status: "active", owner_user_id: "user_1", created_at: "2026-04-20T00:00:00Z" },
      ],
      portfolio_health_graph_edges: [
        { id: "edge_1", source_node_id: "finding_1", target_node_id: "control_1", edge_type: "control_gap", created_at: "2026-04-20T00:00:00Z" },
      ],
      contract_import_jobs: [
        {
          id: "import_1",
          status: "failed",
          total_rows: 10,
          inserted_rows: 5,
          error_rows: 5,
          failure_reason: "Rows require correction",
          created_by: "user_1",
          created_at: "2026-04-25T00:00:00Z",
        },
      ],
      contract_export_jobs: [],
      report_runs: [
        {
          id: "report_1",
          report_mode: "management",
          status: "failed",
          error_summary: "SMTP unavailable",
          triggered_by: "user_1",
          subscription_id: "subscription_1",
          metrics_json: { selected_row_count: 42, generated_row_count: 40, artifact_url: "/api/reports/report_1" },
          started_at: "2026-04-25T00:00:00Z",
          created_at: "2026-04-25T00:00:00Z",
        },
      ],
      saved_views: [
        {
          id: "view_1",
          name: "Renewal risk view",
          view_type: "contracts",
          query_json: { status: "active" },
          pinned: true,
          created_at: "2026-04-20T00:00:00Z",
          updated_at: "2026-04-24T00:00:00Z",
        },
      ],
    });

    const result = await refreshV10ReadModelsForOrganization(admin as never, orgId, {
      refreshJobId: "refresh_1",
      reason: "fixture_rebuild",
      now: new Date("2026-12-20T00:00:00Z"),
    });

    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
    expect(result.sourceCounts.contracts).toBe(1);
    expect(result.targetCounts.read_model_rows).toBe(result.counts.read_model_rows);
    expect(result.diagnostics).toMatchObject({
      refresh_job_id: "refresh_1",
      refresh_reason: "fixture_rebuild",
      expected_source_table_count: V10_READ_MODEL_REFRESH_SOURCE_TABLES.length,
      missing_source_tables: [],
      missing_target_models: [],
      repair_recommendation: "none",
      partial_failure_count: 0,
      model_freshness_state: "fresh",
    });
    expect(result.diagnostics.lineage_count).toBe(result.counts.read_model_rows);
    expect(result.diagnostics.artifact_count).toBe(1);
    expect(result.diagnostics.coverage_count).toBe(V10_RUNTIME_COVERAGE_LEDGER.length);
    expect(validateV10ReadModelRefreshDiagnostics(result.diagnostics)).toEqual([]);
    expect(admin.inserted.v10_read_model_refresh_jobs[0]).toMatchObject({
      refresh_job_id: "refresh_1",
      refresh_scope: "full",
      repair_mode: "replace_visible",
      status: "running",
      expected_source_tables: [...V10_READ_MODEL_REFRESH_SOURCE_TABLES],
    });
    expect(admin.updated.v10_read_model_refresh_jobs[0]).toMatchObject({
      status: "succeeded",
      failure_count: 0,
      stale_source_tables: [],
      drift_state: "fresh",
    });
    expect(result.diagnostics.archived_before_upsert_tables).toEqual(
      expect.arrayContaining(["v10_read_model_rows", "v10_work_items", "v10_read_model_lineage"])
    );
    expect(admin.updated.v10_read_model_rows).toBeUndefined();
    expect(admin.upsertConflicts.v10_work_items).toBe("organization_id,source_table,source_id,type");
    expect(admin.upsertConflicts.v10_read_model_rows).toBe("organization_id,model_key,source_table,source_id");
    expect(Object.keys(result.counts).sort()).toEqual(
      ["read_model_rows", "read_model_lineage", "runtime_artifacts", "runtime_coverage_ledger", ...V10_REQUIRED_READ_MODEL_KEYS].sort()
    );
    expect(result.counts.work_items).toBe(11);
    expect(V10_REQUIRED_READ_MODEL_KEYS.every((modelKey) => Object.prototype.hasOwnProperty.call(result.counts, modelKey))).toBe(true);
    for (const [modelKey, fields] of Object.entries(V10_READ_MODEL_FIELDS)) {
      const tableName = `v10_${modelKey}`;
      const rows = (admin.inserted[tableName] ?? []).length > 0
        ? admin.inserted[tableName]
        : admin.inserted.v10_read_model_rows
          .filter((row) => row.model_key === modelKey)
          .map((row) => row.fields as Record<string, unknown>);
      expect(rows.length, tableName).toBeGreaterThan(0);
      for (const field of fields) {
        expect(Object.prototype.hasOwnProperty.call(rows[0], field), `${tableName}.${field}`).toBe(true);
      }
    }
    expect(admin.inserted.v10_read_model_rows.every((row) => V10_REQUIRED_READ_MODEL_KEYS.includes(row.model_key as never))).toBe(true);
    for (const row of admin.inserted.v10_read_model_rows) {
      expect(row.organization_id).toBe(orgId);
      expect(row.source_table).toBeTruthy();
      expect(row.source_id).toBeTruthy();
      expect(row.visibility_state).toBe("visible");
      expect(row.fields).toMatchObject({
        v10_refresh: {
          refresh_job_id: "refresh_1",
          refresh_reason: "fixture_rebuild",
        },
      });
    }
    expect(admin.inserted.v10_work_items.map((row) => row.type)).toEqual([
      "field_review",
      "contract_task",
      "obligation",
      "approval",
      "exception",
      "evidence_request",
      "renewal_checkpoint",
      "unassigned_work",
      "import_failure",
      "report_failure",
      "automation_approval",
    ]);
    expect(admin.inserted.v10_work_items.find((row) => row.type === "field_review")).toMatchObject({
      source_table: "extracted_fields",
      source_type: "field",
      primary_action: "review_field",
    });
    expect(admin.inserted.v10_work_items.find((row) => row.type === "renewal_checkpoint")).toMatchObject({
      source_table: "contract_renewal_checkpoints",
      source_type: "renewal_checkpoint",
      primary_action: "complete_renewal_checkpoint",
    });
    expect(admin.inserted.v10_work_items.find((row) => row.type === "unassigned_work")).toMatchObject({
      source_table: "contracts",
      source_id: "contract_1:owner",
      source_type: "contract",
      primary_action: "assign_owner",
    });
    expect(admin.inserted.v10_contract_health_snapshots[0].next_action).toBe("missing_required_activation_field");
    expect(admin.inserted.v10_contract_health_snapshots[0].missing_critical_date_count).toBe(0);
    expect(admin.inserted.v10_contract_health_snapshots[0].deductions).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ key: "missing_or_unapproved_critical_date" })])
    );
    expect(admin.inserted.v10_activation_state[0]).toMatchObject({
      extraction_started_at: "2026-04-21T00:00:00.000Z",
      extraction_completed_at: "2026-04-23T00:00:00.000Z",
      blocked_reason: "required_fields_unapproved",
    });
    expect(admin.inserted.v10_job_run_visibility[0].retry_action).toBe("retry");
    expect(admin.inserted.v10_report_run_visibility[0].retry_action).toBeNull();
    expect(admin.inserted.v10_report_run_visibility[0].report_family).toBe("contract_portfolio_summary");
    expect(admin.inserted.v10_report_run_visibility[0].schedule_id).toBe("subscription_1");
    expect(admin.inserted.v10_report_run_visibility[0].selected_row_count).toBe(42);
    expect(admin.inserted.v10_report_run_visibility[0].generated_row_count).toBe(40);
    expect(admin.inserted.v10_report_run_visibility[0].artifact_url).toBe("/api/reports/report_1");
    expect(admin.inserted.v10_field_provenance_records).toHaveLength(5);
    expect(admin.inserted.v10_field_provenance_records[0].current_value_display).toBe("Master services agreement");
    expect(admin.inserted.v10_field_provenance_records[0].value_hash).toMatch(/^fnv1a:/);
    expect(admin.inserted.v10_renewal_posture_snapshots[0]).toMatchObject({
      posture: "plan",
      horizon: "90_days",
      approved_end_date: "2027-04-25",
      approved_renewal_date: "2027-03-25",
      approved_notice_deadline: "2027-02-25",
      next_checkpoint_work_item_id: "checkpoint_1",
    });
    expect(admin.inserted.v10_obligation_records[0].linked_exception_ids).toEqual(["exception_1"]);
    expect(admin.inserted.v10_exception_records[0].resolution_action).toBe("Escalate to owner");
    expect(admin.inserted.v10_evidence_request_statuses[0].resubmission_allowed).toBe(true);
    expect(admin.inserted.v10_external_evidence_submissions[0].submitter_email_state).toBe("redacted");
    expect(admin.inserted.v10_notification_deliveries[0].failure_category).toBe("delivery_failed");
    expect(admin.inserted.v10_contract_activity_events[0].action).toBe("evidence_request.rejected");
    expect(admin.inserted.v10_read_model_rows.some((row) => row.model_key === "evidence_request_statuses")).toBe(true);
    expect(admin.inserted.v10_read_model_lineage).toHaveLength(result.counts.read_model_rows);
    expect(admin.inserted.v10_read_model_lineage[0]).toMatchObject({
      refresh_job_id: "refresh_1",
      spec_requirement_id: expect.stringMatching(/^v10-read-model:/),
    });
    expect(admin.inserted.v10_runtime_artifacts[0]).toMatchObject({
      artifact_key: "report:report_1",
      artifact_kind: "report",
      classification: "support_safe",
    });
    expect(admin.inserted.v10_runtime_coverage_ledger).toHaveLength(V10_RUNTIME_COVERAGE_LEDGER.length);
    expect(admin.inserted.v10_runtime_coverage_ledger[0]).toMatchObject({
      organization_id: orgId,
      runtime_status: expect.stringMatching(/^(runtime_backed|contract_only|release_check_required|environment_gated|external_blocker)$/),
      freshness_state: expect.stringMatching(/^(fresh|stale|partial|failed|missing|unknown)$/),
    });
    expect(admin.inserted.v10_command_search_index.some((row) => row.record_type === "contract")).toBe(true);
    expect(admin.inserted.v10_command_search_index.some((row) => row.record_type === "work_item")).toBe(true);
    expect(admin.inserted.v10_command_search_index.some((row) => row.record_type === "saved_view")).toBe(true);
    expect(admin.inserted.v10_command_search_index.some((row) => row.record_type === "approval")).toBe(true);
    expect(admin.inserted.v10_command_search_index.some((row) => row.record_type === "renewal_checkpoint")).toBe(true);
    expect(admin.inserted.v10_command_search_index.some((row) => row.record_type === "exception")).toBe(true);
    expect(admin.inserted.v10_command_search_index.some((row) => row.record_type === "evidence_request")).toBe(true);
    expect(admin.inserted.v10_command_search_index.some((row) => row.record_type === "report_run")).toBe(true);
    expect(admin.inserted.v10_command_search_index.some((row) => row.record_type === "import_job")).toBe(true);
    expect(
      admin.inserted.v10_command_search_index.every((row) => !String(row.href).startsWith("/api/import/"))
    ).toBe(true);
    expect(
      admin.inserted.v10_command_search_index.some(
        (row) => row.record_type === "import_job" && row.href === "/settings/health#jobs"
      )
    ).toBe(true);
    expect(
      admin.inserted.v10_command_search_index.some(
        (row) =>
          row.record_type === "account" &&
          row.workspace_mode_minimum === "advanced" &&
          row.module_key === "relationship_workspaces"
      )
    ).toBe(true);
    expect(
      admin.inserted.v10_command_search_index.some(
        (row) =>
          row.record_type === "counterparty" &&
          row.workspace_mode_minimum === "advanced" &&
          row.module_key === "relationship_workspaces"
      )
    ).toBe(true);
    expect(admin.inserted.v10_command_search_index.some((row) => row.record_type === "relationship")).toBe(true);
    expect(
      admin.inserted.v10_command_search_index.every(
        (row) =>
          !String(row.href).startsWith("/relationships/") &&
          !String(row.href).startsWith("/simulations/") &&
          !/^\/assurance\/(playbooks|scorecards)\/[^?]/.test(String(row.href))
      )
    ).toBe(true);
    expect(
      admin.inserted.v10_command_search_index.every((row) => getV10RouteTemplateForHref(String(row.href)) !== null)
    ).toBe(true);
    expect(admin.inserted.v10_command_search_index.some((row) => row.record_type === "decision")).toBe(true);
    expect(admin.inserted.v10_command_search_index.some((row) => row.record_type === "campaign")).toBe(true);
    expect(admin.inserted.v10_command_search_index.some((row) => row.record_type === "simulation")).toBe(true);
    expect(admin.inserted.v10_command_search_index.some((row) => row.record_type === "finding")).toBe(true);
    expect(admin.inserted.v10_command_search_index.some((row) => row.record_type === "control")).toBe(true);
    expect(admin.inserted.v10_command_search_index.some((row) => row.record_type === "scorecard")).toBe(true);
    expect(admin.inserted.v10_command_search_index.some((row) => row.record_type === "review_board")).toBe(true);
    expect(admin.inserted.v10_command_search_index.some((row) => row.record_type === "health_graph")).toBe(true);
    expect(admin.inserted.v10_command_search_index.some((row) => row.record_type === "playbook")).toBe(true);
    expect(admin.inserted.v10_command_search_index.some((row) => row.record_type === "automation_run")).toBe(true);
    expect(admin.inserted.v10_advanced_assurance_linked_records).toHaveLength(13);
    expect(admin.inserted.v10_advanced_assurance_linked_records.some((row) => row.record_type === "account")).toBe(true);
    expect(admin.inserted.v10_advanced_assurance_linked_records.some((row) => row.record_type === "counterparty")).toBe(true);
    expect(admin.inserted.v10_advanced_assurance_linked_records.some((row) => row.record_type === "relationship")).toBe(true);
    expect(admin.inserted.v10_advanced_assurance_linked_records.some((row) => row.record_type === "campaign")).toBe(true);
    expect(admin.inserted.v10_advanced_assurance_linked_records.some((row) => row.record_type === "simulation")).toBe(true);
    expect(admin.inserted.v10_advanced_assurance_linked_records.some((row) => row.record_type === "finding")).toBe(true);
    expect(admin.inserted.v10_advanced_assurance_linked_records.some((row) => row.record_type === "control")).toBe(true);
    expect(admin.inserted.v10_advanced_assurance_linked_records.some((row) => row.record_type === "automation_run")).toBe(true);
    expect(admin.inserted.v10_advanced_assurance_linked_records.some((row) => row.record_type === "scorecard")).toBe(true);
    expect(admin.inserted.v10_advanced_assurance_linked_records.some((row) => row.record_type === "review_board")).toBe(true);
    expect(admin.inserted.v10_advanced_assurance_linked_records.some((row) => row.record_type === "health_graph")).toBe(true);
    expect(
      admin.inserted.v10_read_model_rows.some((row) => row.model_key === "advanced_assurance_linked_records")
    ).toBe(true);
  });

  it("validates refresh diagnostics for repairability and stale source coverage", () => {
    expect(
      validateV10ReadModelRefreshDiagnostics({
        refresh_job_id: "",
        refresh_reason: "",
        refresh_scope: "unsafe" as never,
        refreshed_at: "2026-04-25T00:00:00Z",
        dry_run: false,
        scoped_contract_id: null,
        changed_since: null,
        selected_model_keys: ["unknown_model" as never],
        archived_before_upsert_tables: [],
        failed_source_tables: ["contracts"],
        stale_source_tables: [],
        expected_source_table_count: 0,
        missing_source_tables: [],
        missing_target_models: [],
        repair_recommendation: "none",
        partial_failure_count: 0,
        write_failure_count: 0,
        refresh_failure_count: 1,
        model_freshness_state: "stale",
        source_count_total: -1,
        target_count_total: 0,
        lineage_count: 0,
        artifact_count: 0,
        coverage_count: 0,
      })
    ).toEqual(
      expect.arrayContaining([
        "refresh_job_id_required",
        "refresh_reason_required",
        "refresh_scope_invalid",
        "selected_model_unknown:unknown_model",
        "expected_source_table_count_mismatch",
        "partial_failure_count_mismatch",
        "refresh_failure_count_mismatch",
        "non_fresh_model_requires_repair_recommendation",
        "stale_model_requires_stale_source_tables",
        "source_count_total_invalid",
      ])
    );
  });

  it("reports source query failures as partial refresh diagnostics", async () => {
    const admin = makeFakeAdmin({});
    const originalFrom = admin.from.bind(admin);
    admin.from = ((table: string) => {
      const query = originalFrom(table);
      if (table !== "contracts") return query;
      return Object.assign(Object.create(query), {
        then<TResult1 = { data: Record<string, unknown>[]; error: { message: string } }, TResult2 = never>(
          onfulfilled?: ((value: { data: Record<string, unknown>[]; error: { message: string } }) => TResult1 | PromiseLike<TResult1>) | null,
          onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
        ) {
          return Promise.resolve({
            data: [],
            error: { message: "permission denied" },
          }).then(onfulfilled, onrejected);
        },
      });
    }) as typeof admin.from;

    const result = await refreshV10ReadModelsForOrganization(admin as never, "org_1", {
      refreshJobId: "refresh_failed_source",
      reason: "repair",
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toContain("[v10-refresh] query contracts failed: permission denied");
    expect(result.diagnostics.failed_source_tables).toEqual(["contracts"]);
    expect(result.diagnostics.partial_failure_count).toBe(1);
    expect(result.diagnostics.write_failure_count).toBe(0);
    expect(result.diagnostics.refresh_failure_count).toBe(1);
    expect(result.diagnostics.repair_recommendation).toBe("incremental_repair");
    expect(admin.inserted.v10_read_model_rows).toBeUndefined();
    expect(admin.inserted.v10_work_items).toBeUndefined();
    expect(admin.inserted.v10_contract_health_snapshots).toBeUndefined();
    expect(admin.updated.v10_read_model_refresh_jobs[0]).toMatchObject({
      status: "partial",
      failed_source_tables: ["contracts"],
      drift_state: "partial",
    });
  });

  it("supports dry-run refresh diagnostics without replacing read-model tables", async () => {
    const orgId = "org_1";
    const admin = makeFakeAdmin({
      contracts: [
        {
          id: "contract_1",
          organization_id: orgId,
          title: "Dry run contract",
          counterparty: "Acme",
          status: "active",
          owner_id: "user_1",
          created_at: "2026-04-20T00:00:00Z",
          updated_at: "2026-04-20T00:00:00Z",
        },
      ],
    });

    const result = await refreshV10ReadModelsForOrganization(admin as never, orgId, {
      refreshJobId: "refresh_dry_run",
      reason: "operator_preview",
      refreshScope: "dry_run",
    });

    expect(result.ok).toBe(true);
    expect(result.targetCounts.read_model_rows).toBeGreaterThan(0);
    expect(result.diagnostics).toMatchObject({
      refresh_scope: "dry_run",
      dry_run: true,
      scoped_contract_id: null,
      selected_model_keys: [...V10_REQUIRED_READ_MODEL_KEYS],
    });
    expect(result.diagnostics.archived_before_upsert_tables).toEqual([]);
    expect(admin.inserted.v10_read_model_refresh_jobs[0]).toMatchObject({
      refresh_scope: "dry_run",
      repair_mode: "dry_run",
    });
    expect(admin.inserted.v10_read_model_rows).toBeUndefined();
    expect(admin.updated.v10_read_model_rows).toBeUndefined();
  });

  it("supports one-model refreshes without touching unrelated read-model tables", async () => {
    const orgId = "org_1";
    const admin = makeFakeAdmin({
      contracts: [
        {
          id: "contract_1",
          organization_id: orgId,
          title: "Scoped contract",
          counterparty: "Acme",
          status: "active",
          owner_id: "user_1",
          created_at: "2026-04-20T00:00:00Z",
          updated_at: "2026-04-20T00:00:00Z",
        },
      ],
      contract_tasks: [
        {
          id: "task_1",
          contract_id: "contract_1",
          title: "Scoped task",
          status: "open",
          assignee_id: "user_1",
          created_at: "2026-04-20T00:00:00Z",
          updated_at: "2026-04-20T00:00:00Z",
        },
      ],
    });

    const result = await refreshV10ReadModelsForOrganization(admin as never, orgId, {
      refreshJobId: "refresh_one_model",
      refreshScope: "one_model",
      modelKeys: ["work_items"],
      now: new Date("2026-04-21T00:00:00Z"),
    });

    expect(result.ok).toBe(true);
    expect(result.targetCounts.work_items).toBe(1);
    expect(result.targetCounts.contract_health_snapshots).toBe(0);
    expect(result.diagnostics.selected_model_keys).toEqual(["work_items"]);
    expect(result.diagnostics.archived_before_upsert_tables).toEqual(
      expect.arrayContaining(["v10_read_model_rows", "v10_work_items", "v10_read_model_lineage"])
    );
    expect(admin.inserted.v10_work_items).toHaveLength(1);
    expect(admin.inserted.v10_contract_health_snapshots).toBeUndefined();
    expect(admin.inserted.v10_read_model_rows.every((row) => row.model_key === "work_items")).toBe(true);
    expect(admin.inserted.v10_read_model_refresh_jobs[0]).toMatchObject({
      refresh_scope: "one_model",
      repair_mode: "replace_visible",
    });
  });

  it("supports one-contract refreshes with contract-scoped model output", async () => {
    const orgId = "org_1";
    const admin = makeFakeAdmin({
      contracts: [
        {
          id: "contract_1",
          organization_id: orgId,
          title: "Other contract",
          counterparty: "Other",
          status: "active",
          owner_id: "user_1",
          created_at: "2026-04-20T00:00:00Z",
          updated_at: "2026-04-20T00:00:00Z",
        },
        {
          id: "contract_2",
          organization_id: orgId,
          title: "Target contract",
          counterparty: "Target",
          status: "active",
          owner_id: "user_2",
          created_at: "2026-04-20T00:00:00Z",
          updated_at: "2026-04-20T00:00:00Z",
        },
      ],
      contract_tasks: [
        {
          id: "task_1",
          contract_id: "contract_1",
          title: "Other task",
          status: "open",
          assignee_id: "user_1",
          created_at: "2026-04-20T00:00:00Z",
          updated_at: "2026-04-20T00:00:00Z",
        },
        {
          id: "task_2",
          contract_id: "contract_2",
          title: "Target task",
          status: "open",
          assignee_id: "user_2",
          created_at: "2026-04-20T00:00:00Z",
          updated_at: "2026-04-20T00:00:00Z",
        },
      ],
    });

    const result = await refreshV10ReadModelsForOrganization(admin as never, orgId, {
      refreshJobId: "refresh_one_contract",
      refreshScope: "one_contract",
      contractId: "contract_2",
      modelKeys: ["work_items", "contract_health_snapshots", "command_search_index"],
      now: new Date("2026-04-21T00:00:00Z"),
    });

    expect(result.ok).toBe(true);
    expect(result.diagnostics.scoped_contract_id).toBe("contract_2");
    expect(result.targetCounts.work_items).toBe(1);
    expect(result.targetCounts.contract_health_snapshots).toBe(1);
    expect(admin.inserted.v10_work_items.map((row) => row.contract_id)).toEqual(["contract_2"]);
    expect(admin.inserted.v10_contract_health_snapshots.map((row) => row.contract_id)).toEqual(["contract_2"]);
    expect(admin.inserted.v10_read_model_rows.every((row) => row.source_id === "task_2" || row.source_id === "contract_2")).toBe(true);
    expect(admin.inserted.v10_read_model_refresh_jobs[0]).toMatchObject({
      refresh_scope: "one_contract",
      repair_mode: "replace_visible",
    });
  });

  it("supports incremental refreshes that only materialize changed model rows", async () => {
    const orgId = "org_1";
    const admin = makeFakeAdmin({
      contract_tasks: [
        {
          id: "task_old",
          contract_id: "contract_1",
          title: "Old task",
          status: "open",
          assignee_id: "user_1",
          created_at: "2026-04-01T00:00:00Z",
          updated_at: "2026-04-01T00:00:00Z",
        },
        {
          id: "task_new",
          contract_id: "contract_1",
          title: "New task",
          status: "open",
          assignee_id: "user_1",
          created_at: "2026-04-20T00:00:00Z",
          updated_at: "2026-04-22T00:00:00Z",
        },
      ],
    });

    const result = await refreshV10ReadModelsForOrganization(admin as never, orgId, {
      refreshJobId: "refresh_incremental",
      refreshScope: "incremental",
      modelKeys: ["work_items"],
      changedSince: new Date("2026-04-10T00:00:00Z"),
      now: new Date("2026-04-23T00:00:00Z"),
    });

    expect(result.ok).toBe(true);
    expect(result.diagnostics.changed_since).toBe("2026-04-10T00:00:00.000Z");
    expect(result.targetCounts.work_items).toBe(1);
    expect(admin.inserted.v10_work_items.map((row) => row.source_id)).toEqual(["task_new"]);
    expect(admin.inserted.v10_read_model_rows.map((row) => row.source_id)).toEqual(["task_new"]);
  });

  it("fails closed when a one-contract refresh omits the contract scope", async () => {
    const admin = makeFakeAdmin({
      contracts: [
        {
          id: "contract_1",
          organization_id: "org_1",
          title: "Scoped contract",
          status: "active",
          created_at: "2026-04-20T00:00:00Z",
          updated_at: "2026-04-20T00:00:00Z",
        },
      ],
    });

    const result = await refreshV10ReadModelsForOrganization(admin as never, "org_1", {
      refreshJobId: "refresh_missing_scope",
      refreshScope: "one_contract",
      modelKeys: ["work_items"],
      now: new Date("2026-04-21T00:00:00Z"),
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toContain("[v10-refresh] one_contract scope requires contractId");
    expect(result.diagnostics.scoped_contract_id).toBeNull();
    expect(result.diagnostics.archived_before_upsert_tables).toEqual([]);
    expect(admin.inserted.v10_work_items).toBeUndefined();
  });

  it("uses the service-role replacement RPC when available so archive and upsert are one database operation", async () => {
    const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const admin = makeFakeAdmin({
      contract_tasks: [
        {
          id: "task_rpc",
          contract_id: "contract_rpc",
          title: "RPC scoped task",
          status: "open",
          assignee_id: "user_1",
          created_at: "2026-04-20T00:00:00Z",
          updated_at: "2026-04-20T00:00:00Z",
        },
      ],
    });
    (admin as typeof admin & {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: null }>;
    }).rpc = async (fn, args) => {
      rpcCalls.push({ fn, args });
      return { data: [{ upserted_count: 0, archived_count: 0 }], error: null };
    };

    const result = await refreshV10ReadModelsForOrganization(admin as never, "org_1", {
      refreshJobId: "refresh_rpc",
      reason: "operator_repair",
    });

    expect(result.ok).toBe(true);
    expect(rpcCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fn: "replace_v10_read_model_rows",
          args: expect.objectContaining({
            p_table_name: "v10_work_items",
            p_organization_id: "org_1",
            p_identity_columns: ["organization_id", "source_table", "source_id", "type"],
          }),
        }),
      ])
    );
    expect(result.diagnostics.archived_before_upsert_tables).toEqual(
      expect.arrayContaining(["v10_read_model_rows", "v10_work_items", "v10_read_model_lineage"])
    );
    expect(admin.updated.v10_work_items).toBeUndefined();
  });

  it("builds deterministic backfill repair plans from source and target counts", () => {
    const plan = buildV10ReadModelBackfillPlan({
      sourceCounts: { contracts: 1 },
      targetCounts: { work_items: 0 },
      freshnessState: "missing",
      refreshScope: "repair",
    });

    expect(plan).toMatchObject({
      refreshScope: "repair",
      freshnessState: "missing",
      repairRecommendation: "full_backfill",
      diagnosticId: "v10_refresh_full_backfill_missing",
    });
    expect(plan.missingSourceTables).toContain("extracted_fields");
    expect(plan.missingTargetModels).toContain("activation_state");
    expect(plan.sourceObjectCoverageCount).toBeGreaterThanOrEqual(20);
  });
});

