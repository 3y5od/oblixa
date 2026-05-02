import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  V10_ACCEPTANCE_GATES,
  V10_ACTIVATION_STATES,
  V10_CANCELLATION_STATES,
  V10_CONFIDENCE_STATES,
  V10_CORE_REPORT_FAMILIES,
  V10_DUE_STATES,
  V10_FIELD_STATES,
  V10_HEALTH_BANDS,
  V10_JOB_CLASSES,
  V10_JOB_STATUSES,
  V10_MUTATION_CATALOG,
  V10_MUTATION_OUTCOMES,
  V10_NOTIFICATION_CLASSES,
  V10_OWNER_STATES,
  V10_PLANS,
  V10_PRIORITIES,
  V10_READ_MODEL_FIELDS,
  V10_RENEWAL_POSTURES,
  V10_SEVERITIES,
  V10_SHARED_READ_MODEL_FIELDS,
  V10_SOURCE_OBJECT_TYPES,
  V10_WORKSPACE_MODES,
  V10_WORK_ITEM_STATUSES,
  V10_WORK_ITEM_TYPES,
  V10_RENEWAL_HORIZONS,
} from "./v10-release-contract";
import {
  V10_READ_MODEL_RUNTIME_CONTRACTS,
  V10_REQUIRED_READ_MODEL_KEYS,
  V10_SOURCE_LINK_COLUMN_COMPATIBILITY,
  type V10CommandSearchIndexReadModel,
  assertV10SharedReadModelFields,
  getV10VisibilityState,
  validateV10ReadModelRuntimeContracts,
  validateV10SourceLinkColumnCompatibility,
  validateV10ReadModelLineage,
  getV10ReadModelTableName,
  queryV10ReadModel,
} from "./v10-read-models";
import { V10_SPEC_TRACE } from "./v10-spec-trace-map";

function parseMigrationColumns(migration: string): Map<string, string[]> {
  const tables = new Map<string, string[]>();
  const tablePattern = /create table if not exists public\.(v10_[a-z0-9_]+) \(([\s\S]*?)\n\);/g;
  for (const match of migration.matchAll(tablePattern)) {
    const [, tableName, body] = match;
    if (!tableName || !body) continue;
    const columns = body
      .split("\n")
      .map((line) => line.trim().replace(/,$/, ""))
      .filter((line) => line.length > 0)
      .filter((line) => !/^(constraint|primary|foreign|unique|check)\b/i.test(line))
      .map((line) => line.split(/\s+/)[0])
      .filter((column): column is string => Boolean(column));
    tables.set(tableName, columns);
  }
  return tables;
}

function parseMigrationTableReferences(migration: string, pattern: RegExp): string[] {
  return [...migration.matchAll(pattern)]
    .map((match) => match[1])
    .filter((tableName): tableName is string => Boolean(tableName))
    .sort();
}

function expectMigrationConstraintValues(migration: string, constraintName: string, values: readonly string[]) {
  const constraintStart = migration.indexOf(`add constraint ${constraintName}`);
  expect(constraintStart, constraintName).toBeGreaterThanOrEqual(0);
  const constraintEnd = migration.indexOf(");", constraintStart);
  expect(constraintEnd, constraintName).toBeGreaterThan(constraintStart);
  const constraintSql = migration.slice(constraintStart, constraintEnd);
  for (const value of values) {
    expect(constraintSql, `${constraintName}:${value}`).toContain(`'${value}'`);
  }
}

function parseRequiredV10IndexNames(): string[] {
  const requiredIndexesSource = readFileSync(join(process.cwd(), "scripts/lib/v10-required-indexes.mjs"), "utf8");
  return [...requiredIndexesSource.matchAll(/"(idx_v10_[^"]+)"/g)]
    .map((match) => match[1])
    .filter((name): name is string => Boolean(name));
}

function makeReadModelQueryClient(seed: Record<string, Record<string, unknown>[]>) {
  const calls: string[] = [];
  class Query implements PromiseLike<{ data: Record<string, unknown>[]; error: null }> {
    private table: string;
    private rows: Record<string, unknown>[];

    constructor(table: string) {
      this.table = table;
      this.rows = seed[table] ?? [];
    }

    select() {
      calls.push(`${this.table}:select`);
      return this;
    }

    eq(column: string, value: unknown) {
      calls.push(`${this.table}:eq:${column}:${String(value)}`);
      this.rows = this.rows.filter((row) => row[column] === value);
      return this;
    }

    in(column: string, values: readonly unknown[]) {
      calls.push(`${this.table}:in:${column}:${values.join("|")}`);
      this.rows = this.rows.filter((row) => values.includes(row[column]));
      return this;
    }

    order(column: string) {
      calls.push(`${this.table}:order:${column}`);
      return this;
    }

    limit(count: number) {
      calls.push(`${this.table}:limit:${count}`);
      this.rows = this.rows.slice(0, count);
      return this;
    }

    then<TResult1 = { data: Record<string, unknown>[]; error: null }, TResult2 = never>(
      onfulfilled?: ((value: { data: Record<string, unknown>[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ): PromiseLike<TResult1 | TResult2> {
      return Promise.resolve({ data: this.rows, error: null }).then(onfulfilled, onrejected);
    }
  }
  return {
    calls,
    from(table: `v10_${string}`) {
      calls.push(`from:${table}`);
      return new Query(table);
    },
  };
}

describe("V10 data contracts and traceability", () => {
  it("keeps every V10 read model backed by field catalogs", () => {
    expect(Object.keys(V10_READ_MODEL_FIELDS)).toEqual([...V10_REQUIRED_READ_MODEL_KEYS]);
    expect(Object.keys(V10_READ_MODEL_FIELDS)).toEqual(
      expect.arrayContaining([
        "activation_state",
        "work_items",
        "contract_health_snapshots",
        "field_provenance_records",
        "renewal_posture_snapshots",
        "evidence_request_statuses",
        "job_run_visibility",
        "report_run_visibility",
        "command_search_index",
      ])
    );
    expect(V10_REQUIRED_READ_MODEL_KEYS).toEqual(
      expect.arrayContaining([
        "notification_deliveries",
        "renewal_checkpoint_records",
        "external_evidence_submissions",
        "audit_events",
        "advanced_assurance_linked_records",
      ])
    );
    for (const fields of Object.values(V10_READ_MODEL_FIELDS)) {
      expect(fields.length).toBeGreaterThan(5);
    }
  });

  it("validates shared read-model field presence and visibility precedence", () => {
    expect(V10_SHARED_READ_MODEL_FIELDS).toContain("organization_id");
    expect(
      assertV10SharedReadModelFields({
        id: "row",
        organization_id: "org",
        workspace_mode: "core",
        required_role_minimum: "viewer",
        feature_family: "work",
        source_table: "contract_tasks",
        source_id: "task",
        created_at: "2026-04-25T00:00:00Z",
        updated_at: "2026-04-25T00:00:00Z",
        visibility_state: "visible",
      })
    ).toBe(true);
    expect(getV10VisibilityState({ deletedAt: "2026-04-25T00:00:00Z", hiddenByPlan: true })).toBe("deleted");
    expect(getV10VisibilityState({ hiddenByModule: true })).toBe("hidden_by_module");
    expect(
      validateV10ReadModelLineage({
        organization_id: "org",
        source_table: "contracts",
        source_id: "contract",
        created_at: "2026-04-25T00:00:00Z",
        updated_at: "2026-04-25T00:00:00Z",
        visibility_state: "visible",
      })
    ).toEqual([]);
    expect(validateV10ReadModelLineage({ source_table: "contracts", deleted_at: "2026-04-25T00:00:00Z", visibility_state: "visible" })).toEqual(
      expect.arrayContaining(["organization_id_missing", "source_id_missing", "deleted_visibility_mismatch"])
    );
  });

  it("queries typed V10 read APIs with visibility, source, and freshness metadata", async () => {
    expect(getV10ReadModelTableName("work_items")).toBe("v10_work_items");
    const client = makeReadModelQueryClient({
      v10_work_items: [
        {
          id: "work_1",
          organization_id: "org_1",
          visibility_state: "visible",
          required_role_minimum: "viewer",
          workspace_mode: "core",
          source_id: "task_1",
          contract_id: "contract_1",
          title: "Review terms",
        },
        {
          id: "work_2",
          organization_id: "org_2",
          visibility_state: "visible",
          required_role_minimum: "viewer",
          workspace_mode: "core",
          source_id: "task_2",
          contract_id: "contract_2",
          title: "Hidden org",
        },
      ],
    });

    const result = await queryV10ReadModel(client, "work_items", {
      organizationId: "org_1",
      role: "viewer",
      workspaceMode: "core",
      plan: "core",
    }, {
      contractId: "contract_1",
      limit: 10,
      orderBy: "updated_at",
    });

    expect(result.error).toBeNull();
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.id).toBe("work_1");
    expect(result.metadata).toMatchObject({
      modelKey: "work_items",
      tableName: "v10_work_items",
      rowCount: 1,
      freshnessState: "fresh",
      sourceLineageRequired: true,
      recoveryDestination: "/settings/health?model=work_items",
    });
    expect(client.calls).toEqual(
      expect.arrayContaining([
        "from:v10_work_items",
        "v10_work_items:eq:organization_id:org_1",
        "v10_work_items:eq:visibility_state:visible",
        "v10_work_items:in:required_role_minimum:viewer",
        "v10_work_items:eq:contract_id:contract_1",
      ])
    );
  });

  it("locks every required read model to a runtime table, refresh path, migration, and tests", () => {
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/057_v10_runtime_contracts.sql"), "utf8");

    expect(validateV10ReadModelRuntimeContracts()).toEqual([]);
    expect(V10_READ_MODEL_RUNTIME_CONTRACTS.map((row) => row.key)).toEqual([...V10_REQUIRED_READ_MODEL_KEYS]);
    for (const contract of V10_READ_MODEL_RUNTIME_CONTRACTS) {
      expect(contract.tableName).toBe(`v10_${contract.key}`);
      expect(migration, contract.key).toContain(`public.${contract.tableName}`);
      expect(existsSync(join(process.cwd(), contract.sourceArtifact)), `${contract.key}:source`).toBe(true);
      expect(existsSync(join(process.cwd(), contract.refreshArtifact)), `${contract.key}:refresh`).toBe(true);
      expect(existsSync(join(process.cwd(), contract.migrationArtifact)), `${contract.key}:migration`).toBe(true);
      for (const testArtifact of contract.testArtifacts) {
        expect(existsSync(join(process.cwd(), testArtifact)), `${contract.key}:${testArtifact}`).toBe(true);
      }
      expect(contract.freshnessWindowMinutes, contract.key).toBeGreaterThan(0);
      expect(contract.supportsRepairRefresh, contract.key).toBe(true);
    }
    expect(
      validateV10ReadModelRuntimeContracts([
        {
          ...V10_READ_MODEL_RUNTIME_CONTRACTS[0]!,
          tableName: "v10_wrong_model",
          freshnessWindowMinutes: 0,
          supportsRepairRefresh: false,
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "read_model_runtime_contract_missing:work_items",
        "activation_state:table_name_mismatch",
        "activation_state:freshness_window_invalid",
        "activation_state:repair_refresh_required",
      ])
    );
  });

  it("keeps command search and linked-source read-model types aligned with the migration", () => {
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/057_v10_runtime_contracts.sql"), "utf8");
    const commandSearchRow = {
      id: "row",
      organization_id: "org",
      workspace_mode: "core",
      required_role_minimum: "manager",
      feature_family: "search",
      source_table: "contracts",
      source_id: "contract-1",
      created_at: "2026-04-25T00:00:00Z",
      updated_at: "2026-04-25T00:00:00Z",
      deleted_at: null,
      archived_at: null,
      visibility_state: "visible",
      record_type: "contract",
      record_id: "contract-1",
      label: "Acme MSA",
      description_safe: "Contract",
      href: "/contracts/contract-1",
      rank_terms_safe: ["acme", "msa"],
      workspace_mode_minimum: "core",
      module_key: null,
      plan_minimum: "core",
    } satisfies V10CommandSearchIndexReadModel;

    expect(commandSearchRow.required_role_minimum).toBe("manager");
    expect(migration).toMatch(/v10_command_search_index[\s\S]*required_role_minimum text not null default 'viewer'/);
    expect(validateV10SourceLinkColumnCompatibility()).toEqual([]);
    expect(V10_SOURCE_LINK_COLUMN_COMPATIBILITY).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          readModelKey: "exception_records",
          canonicalSourceIdColumn: "source_id",
          linkedSourceIdColumn: "linked_source_id",
          linkedSourceIdRequired: false,
        }),
        expect.objectContaining({
          readModelKey: "notification_deliveries",
          canonicalSourceIdColumn: "source_id",
          linkedSourceIdColumn: "linked_source_id",
          linkedSourceIdRequired: true,
        }),
      ])
    );
    for (const row of V10_SOURCE_LINK_COLUMN_COMPATIBILITY) {
      expect(migration, row.readModelKey).toContain(row.sourceTable);
      expect(migration, row.readModelKey).toMatch(new RegExp(`${row.sourceTable}[\\s\\S]*${row.canonicalSourceIdColumn} text not null`));
      if (row.linkedSourceIdColumn) {
        const nullability = row.linkedSourceIdRequired ? " text not null" : " text";
        expect(migration, row.readModelKey).toMatch(new RegExp(`${row.sourceTable}[\\s\\S]*${row.linkedSourceIdColumn}${nullability}`));
      }
    }
  });

  it("keeps mutation catalog entries audit-backed", () => {
    expect(V10_MUTATION_CATALOG.length).toBeGreaterThanOrEqual(23);
    for (const mutation of V10_MUTATION_CATALOG) {
      expect(mutation.name).toMatch(/^[a-z0-9_]+$/);
      expect(mutation.auditAction).toContain(".");
      expect(mutation.minimumRole.length).toBeGreaterThan(2);
    }
  });

  it("keeps the migration aligned with typed V10 read-model tables", () => {
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/057_v10_runtime_contracts.sql"), "utf8");
    const tables = [...parseMigrationColumns(migration).keys()].sort();
    const rlsEnabledTables = parseMigrationTableReferences(
      migration,
      /alter table public\.(v10_[a-z0-9_]+) enable row level security/g
    );
    const memberReadableTables = tables.filter((table) => table !== "v10_mutation_idempotency");
    const selectPolicyTables = parseMigrationTableReferences(migration, /on public\.(v10_[a-z0-9_]+) for select/g);

    for (const table of [
      "v10_work_items",
      "v10_exception_records",
      "v10_notification_deliveries",
      "v10_advanced_assurance_linked_records",
    ]) {
      expect(migration).toContain(`public.${table}`);
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
    expect(rlsEnabledTables).toEqual(tables);
    expect(selectPolicyTables).toEqual(memberReadableTables);
    expect(migration).toMatch(/v10_exception_records[\s\S]*linked_source_id text/);
    expect(migration).toMatch(/v10_notification_deliveries[\s\S]*linked_source_id text not null/);
    expect(migration).toMatch(
      /Members can read V10 release evidence records[\s\S]*om\.organization_id = v10_release_evidence_records\.organization_id[\s\S]*om\.user_id = auth\.uid\(\)/
    );
    expect(migration).toMatch(
      /Members can read V10 runtime artifacts[\s\S]*on public\.v10_runtime_artifacts for select[\s\S]*classification <> 'prohibited'[\s\S]*revoked_at is null[\s\S]*public\.v10_member_can_read\(organization_id, required_role_minimum, visibility_state\)/
    );
    expect(migration).toMatch(
      /create table if not exists public\.v10_audit_events[\s\S]*required_role_minimum text not null default 'viewer'[\s\S]*visibility_state text not null default 'visible'/
    );
    expect(migration).toMatch(
      /Members can read V10 audit[\s\S]*on public\.v10_audit_events for select[\s\S]*public\.v10_member_can_read\(organization_id, required_role_minimum, visibility_state\)/
    );
    expect(migration).toMatch(/create or replace function public\.v10_member_can_read/);
    expect(migration).toMatch(
      /No direct member access V10 mutation idempotency[\s\S]*on public\.v10_mutation_idempotency for all[\s\S]*using \(false\)[\s\S]*with check \(false\)/
    );
    expect(migration).toMatch(/create or replace function public\.cleanup_expired_v10_mutation_idempotency/);
    expect(migration).toMatch(
      /where expires_at < retention_cutoff[\s\S]*claim_status = 'in_progress'[\s\S]*claim_expires_at is not null[\s\S]*claim_expires_at < retention_cutoff/
    );
    expect(migration).toMatch(/grant execute on function public\.cleanup_expired_v10_mutation_idempotency\(timestamptz\) to service_role/);
    expect(migration).toMatch(/create or replace function public\.cleanup_expired_v10_runtime_artifacts/);
    expect(migration).toMatch(/grant execute on function public\.cleanup_expired_v10_runtime_artifacts\(timestamptz\) to service_role/);
    expect(migration).toMatch(/create or replace function public\.cleanup_old_v10_read_model_refresh_jobs/);
    expect(migration).toMatch(/grant execute on function public\.cleanup_old_v10_read_model_refresh_jobs\(timestamptz\) to service_role/);
    expect(migration).toMatch(/delete from public\.v10_read_model_refresh_jobs[\s\S]*completed_at < retention_cutoff/);
    expect(migration).toMatch(/create or replace function public\.replace_v10_read_model_rows/);
    expect(migration).toMatch(/grant execute on function public\.replace_v10_read_model_rows\(text, uuid, jsonb, text\[\], timestamptz\) to service_role/);
    expect(migration).toMatch(/jsonb_populate_recordset\(null::public\.%1\$I, \$1\)/);
    expect(migration).toMatch(/target\.visibility_state = ''visible''[\s\S]*not exists/);
    expect(migration).toMatch(/if row_count_input = 0 then[\s\S]*archived_count := 0[\s\S]*return next/);
    expect(migration).toMatch(/archive_scope_predicate := format[\s\S]*jsonb_array_elements\(\$2\) as scope_row/);
    expect(migration).toMatch(/and %3\$s[\s\S]*not exists/);
    expect(migration).toMatch(
      /idx_v10_work_items_org_source_upsert[\s\S]*on public\.v10_work_items \(organization_id, source_table, source_id, type\)/
    );
    expect(migration).not.toMatch(
      /idx_v10_work_items_org_source_upsert[\s\S]*on public\.v10_work_items \(organization_id, source_table, source_id\)/
    );
  });

  it("keeps V10 migration table columns unique and policy references valid", () => {
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/057_v10_runtime_contracts.sql"), "utf8");
    const tables = parseMigrationColumns(migration);

    expect(tables.get("v10_release_evidence_records")).toContain("organization_id");
    expect(tables.get("v10_fixture_manifests")).toEqual(
      expect.arrayContaining(["fixture_version", "denominator_locks", "privacy_scan_status", "teardown_status"])
    );
    expect(tables.get("v10_denominator_locks")).toEqual(
      expect.arrayContaining(["lock_id", "metric_key", "fixed_sample_size", "denominator_count"])
    );
    expect(tables.get("v10_metric_runs")).toEqual(
      expect.arrayContaining(["metric_key", "denominator_lock_id", "pass_count", "fail_count", "excluded_count"])
    );
    expect(tables.get("v10_promotion_decisions")).toEqual(
      expect.arrayContaining(["release_state", "decision", "evidence_keys", "unresolved_blockers", "rollback_ready"])
    );
    expect(tables.get("v10_release_waivers")).toEqual(
      expect.arrayContaining(["waiver_key", "waived_evidence_key", "approver", "expires_at"])
    );
    expect(tables.get("v10_verification_command_results")).toEqual(
      expect.arrayContaining(["command", "required_for", "status", "blocker_reason", "captured_at"])
    );
    expect(tables.get("v10_external_blocker_records")).toEqual(
      expect.arrayContaining(["blocker_key", "evidence_kind", "release_state", "blocker_reason", "mitigation"])
    );
    expect(tables.get("v10_fixture_teardown_records")).toEqual(
      expect.arrayContaining(["fixture_version", "teardown_key", "status", "deleted_counts", "preserved_evidence_keys"])
    );
    expect(tables.get("v10_mutation_idempotency")).toEqual(
      expect.arrayContaining(["claim_status", "claimed_at", "completed_at", "claim_expires_at"])
    );
    for (const [tableName, columns] of tables) {
      expect(new Set(columns).size, `${tableName} has duplicate columns`).toBe(columns.length);
    }

    for (const match of migration.matchAll(/\b(v10_[a-z0-9_]+)\.organization_id\b/g)) {
      const tableName = match[1];
      expect(tables.get(tableName ?? ""), `${tableName} is referenced by RLS`).toContain("organization_id");
    }
  });

  it("keeps V10 security-definer functions search-path pinned and service-role scoped", () => {
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/057_v10_runtime_contracts.sql"), "utf8");
    const functionBlocks = [...migration.matchAll(/create or replace function public\.([a-z0-9_]+)\([\s\S]*?\n\$\$;/g)];
    const v10FunctionBlocks = functionBlocks.filter(([, name]) => name?.includes("v10"));

    expect(v10FunctionBlocks.length).toBeGreaterThanOrEqual(7);
    for (const [block, name] of v10FunctionBlocks) {
      if (!block.includes("security definer")) continue;
      expect(block, `${name}:search_path`).toContain("set search_path = public");
      expect(migration, `${name}:public_revoke`).toContain(`revoke all on function public.${name}`);
      expect(migration, `${name}:service_role_grant`).toContain(`grant execute on function public.${name}`);
    }
    expect(migration).toMatch(/create or replace function public\.claim_v10_mutation_idempotency[\s\S]*security definer[\s\S]*set search_path = public/);
    expect(migration).toMatch(/create or replace function public\.complete_v10_mutation_idempotency[\s\S]*security definer[\s\S]*set search_path = public/);
    expect(migration).toMatch(/create or replace function public\.replace_v10_read_model_rows[\s\S]*security definer[\s\S]*set search_path = public/);
  });

  it("keeps V10 hot-path query indexes for lenses, jobs, reports, and recovery surfaces", () => {
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/057_v10_runtime_contracts.sql"), "utf8");

    for (const indexName of [
      ...parseRequiredV10IndexNames(),
      "idx_v10_read_model_rows_org_model_source_upsert",
      "idx_v10_work_items_org_source_upsert",
      "idx_v10_contract_health_org_source_upsert",
      "idx_v10_command_search_org_source_upsert",
      "idx_v10_advanced_assurance_org_source_upsert",
      "idx_v10_refresh_jobs_org_scope_drift",
    ]) {
      expect(migration, indexName).toMatch(new RegExp(`create (unique )?index if not exists ${indexName}`));
    }
  });

  it("requires diagnostics and sane counts for failed job and report visibility rows", () => {
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/057_v10_runtime_contracts.sql"), "utf8");

    expect(migration).toMatch(
      /add constraint v10_job_run_visibility_count_timing_diagnostic_check[\s\S]*completed_count >= 0[\s\S]*failed_count >= 0[\s\S]*skipped_count >= 0[\s\S]*retryable_count >= 0[\s\S]*completed_at >= started_at[\s\S]*status not in \('partial', 'failed_retryable', 'failed_terminal'\)[\s\S]*or diagnostic_id is not null/
    );
    expect(migration).toMatch(
      /add constraint v10_report_run_visibility_count_timing_diagnostic_check[\s\S]*coalesce\(selected_row_count, 0\) >= 0[\s\S]*coalesce\(generated_row_count, 0\) >= 0[\s\S]*completed_at >= started_at[\s\S]*status not in \('partial', 'failed_retryable', 'failed_terminal'\)[\s\S]*or diagnostic_id is not null/
    );
    expectMigrationConstraintValues(migration, "v10_read_model_refresh_jobs_scope_check", [
      "full",
      "incremental",
      "repair",
      "dry_run",
      "one_contract",
      "one_model",
    ]);
    expect(migration).toMatch(/repair_mode text not null default 'replace_visible'[\s\S]*check \(repair_mode in \('replace_visible', 'incremental_upsert', 'dry_run'\)\)/);
    expect(migration).toMatch(/expected_source_tables text\[\] not null default '\{\}'/);
    expect(migration).toMatch(/stale_source_tables text\[\] not null default '\{\}'/);
    expect(migration).toMatch(/drift_state text not null default 'fresh'[\s\S]*check \(drift_state in \('fresh', 'stale', 'partial', 'failed', 'missing'\)\)/);
  });

  it("pins DB enum constraints to the V10 runtime vocabulary", () => {
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/057_v10_runtime_contracts.sql"), "utf8");

    expectMigrationConstraintValues(migration, "v10_activation_state_state_check", V10_ACTIVATION_STATES);
    expectMigrationConstraintValues(migration, "v10_activation_state_owner_state_check", V10_OWNER_STATES);
    expectMigrationConstraintValues(migration, "v10_work_items_type_check", V10_WORK_ITEM_TYPES);
    expectMigrationConstraintValues(migration, "v10_work_items_status_check", V10_WORK_ITEM_STATUSES);
    expectMigrationConstraintValues(migration, "v10_work_items_owner_due_priority_severity_check", [
      ...V10_OWNER_STATES,
      ...V10_DUE_STATES,
      ...V10_PRIORITIES,
      ...V10_SEVERITIES,
    ]);
    expectMigrationConstraintValues(migration, "v10_job_run_visibility_enum_check", [
      ...V10_JOB_CLASSES,
      ...V10_JOB_STATUSES,
      ...V10_CANCELLATION_STATES,
    ]);
    expectMigrationConstraintValues(
      migration,
      "v10_contract_health_band_check",
      V10_HEALTH_BANDS.map(({ band }) => band)
    );
    expectMigrationConstraintValues(migration, "v10_report_run_visibility_enum_check", [...V10_CORE_REPORT_FAMILIES, ...V10_JOB_STATUSES]);
    expectMigrationConstraintValues(migration, "v10_renewal_posture_snapshots_posture_check", V10_RENEWAL_POSTURES);
    expectMigrationConstraintValues(migration, "v10_renewal_posture_snapshots_horizon_check", V10_RENEWAL_HORIZONS);
    expectMigrationConstraintValues(migration, "v10_field_provenance_records_enum_check", [...V10_FIELD_STATES, ...V10_CONFIDENCE_STATES]);
    expectMigrationConstraintValues(migration, "v10_notification_deliveries_class_check", V10_NOTIFICATION_CLASSES);
    expectMigrationConstraintValues(migration, "v10_command_search_index_plan_mode_check", [...V10_WORKSPACE_MODES, ...V10_PLANS]);
    expectMigrationConstraintValues(migration, "v10_audit_events_outcome_check", V10_MUTATION_OUTCOMES);
    for (const constraintName of [
      "v10_work_items_source_type_check",
      "v10_contract_activity_events_target_type_check",
      "v10_job_run_visibility_source_type_check",
      "v10_exception_records_source_type_check",
      "v10_notification_deliveries_source_type_check",
      "v10_audit_events_target_type_check",
    ]) {
      expectMigrationConstraintValues(migration, constraintName, V10_SOURCE_OBJECT_TYPES);
    }
  });

  it("prevents member RLS from exposing archived, deleted, or hidden V10 rows", () => {
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/057_v10_runtime_contracts.sql"), "utf8");
    const tables = parseMigrationColumns(migration);
    const visibilityScopedTables = [...tables.entries()]
      .filter(([, columns]) => columns.includes("visibility_state"))
      .map(([table]) => table);

    expect(visibilityScopedTables.length).toBeGreaterThan(10);
    for (const table of visibilityScopedTables) {
      const directPolicy = new RegExp(`on public\\.${table} for select[\\s\\S]*using \\(visibility_state = 'visible' and exists`);
      const helperPolicy = new RegExp(`on public\\.${table} for select[\\s\\S]*public\\.v10_member_can_read\\(`);
      expect(directPolicy.test(migration) || helperPolicy.test(migration), table).toBe(true);
    }
  });

  it("maps every acceptance gate to the release trace", () => {
    expect(V10_ACCEPTANCE_GATES).toHaveLength(16);
    for (const section of [
      "1",
      "2",
      "2.1",
      "2.2",
      "3",
      "3.1",
      "3.1.1",
      "3.2",
      "3.3",
      "3.4",
      "3.5",
      "4",
      "4.1",
      "4.2",
      "4.3",
      "4.4",
      "4.5",
      "4.6",
      "4.7",
      "4.8",
      "4.9",
      "4.10",
      "4.11",
      "4.12",
      "4.13",
      "4.14",
      "4.15",
      "4.16",
      "5",
      "5.1",
      "5.2",
      "5.3",
      "5.4",
      "5.5",
      "5.6",
      "5.7",
      "6",
      "6.1",
      "6.2",
      "6.3",
      "6.4",
      "6.5",
      "6.6",
      "6.7",
      "6.8",
      "6.9",
      "6.10",
      "6.11",
      "6.12",
      "6.13",
      "6.14",
      "6.15",
      "6.16",
      "7",
      "8",
    ]) {
      expect(V10_SPEC_TRACE[section]?.length, section).toBeGreaterThan(0);
      expect(V10_SPEC_TRACE[section]?.some((path) => existsSync(join(process.cwd(), path))), section).toBe(true);
    }
    for (const [section, paths] of Object.entries(V10_SPEC_TRACE)) {
      expect(paths.length, section).toBeGreaterThan(0);
      for (const path of paths) {
        expect(existsSync(join(process.cwd(), path)), `${section}:${path}`).toBe(true);
      }
      expect(
        paths.some((path) => path.endsWith(".v10.test.ts") || path.endsWith(".ui.test.tsx") || path.includes("e2e/")),
        `${section} should include an executable proof path`
      ).toBe(true);
    }
  });
});
