#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REQUIRED_V10_INDEXES } from "./lib/v10-required-indexes.mjs";

const root = process.cwd();
const strict = process.argv.includes("--strict");
const migrationPath = join(root, "supabase", "migrations", "057_v10_runtime_contracts.sql");
const databaseUrl = process.env.V10_MIGRATION_SMOKE_DATABASE_URL ?? "";
const allowMutatingDatabase = process.env.V10_MIGRATION_SMOKE_ALLOW_MUTATING_DATABASE === "1";
const applyTwice = process.env.V10_MIGRATION_SMOKE_APPLY_TWICE !== "0";
const failures = [];

const REQUIRED_V10_TABLES = [
  "v10_mutation_idempotency",
  "v10_audit_events",
  "v10_read_model_rows",
  "v10_activation_state",
  "v10_work_items",
  "v10_contract_health_snapshots",
  "v10_contract_activity_events",
  "v10_field_provenance_records",
  "v10_renewal_posture_snapshots",
  "v10_evidence_request_statuses",
  "v10_obligation_records",
  "v10_approval_records",
  "v10_exception_records",
  "v10_notification_deliveries",
  "v10_renewal_checkpoint_records",
  "v10_external_evidence_submissions",
  "v10_job_run_visibility",
  "v10_report_run_visibility",
  "v10_command_search_index",
  "v10_release_evidence_records",
  "v10_fixture_manifests",
  "v10_denominator_locks",
  "v10_metric_runs",
  "v10_promotion_decisions",
  "v10_release_waivers",
  "v10_verification_command_results",
  "v10_external_blocker_records",
  "v10_fixture_teardown_records",
  "v10_read_model_refresh_jobs",
  "v10_read_model_lineage",
  "v10_runtime_artifacts",
  "v10_runtime_coverage_ledger",
  "v10_advanced_assurance_linked_records",
];

const REQUIRED_V10_CONSTRAINTS = [
  "v10_activation_state_state_check",
  "v10_work_items_type_check",
  "v10_work_items_status_check",
  "v10_work_items_owner_due_priority_severity_check",
  "v10_job_run_visibility_enum_check",
  "v10_job_run_visibility_count_timing_diagnostic_check",
  "v10_report_run_visibility_enum_check",
  "v10_report_run_visibility_count_timing_diagnostic_check",
  "v10_command_search_index_plan_mode_check",
  "v10_mutation_idempotency_claim_status_check",
  "v10_mutation_idempotency_claim_timing_check",
  "v10_runtime_artifacts_retention_check",
  "v10_fixture_manifests_status_check",
  "v10_denominator_locks_status_check",
  "v10_metric_runs_accounting_check",
  "v10_promotion_decisions_check",
  "v10_release_waivers_check",
  "v10_verification_command_results_status_check",
  "v10_external_blocker_records_status_check",
  "v10_fixture_teardown_records_status_check",
  "v10_read_model_refresh_jobs_scope_check",
  "v10_read_model_refresh_jobs_drift_check",
];

const REQUIRED_V10_SECURITY_DEFINER_FUNCTIONS = [
  "cleanup_expired_v10_mutation_idempotency",
  "claim_v10_mutation_idempotency",
  "complete_v10_mutation_idempotency",
  "v10_role_rank",
  "v10_member_can_read",
  "cleanup_old_v10_read_model_refresh_jobs",
  "cleanup_expired_v10_runtime_artifacts",
  "replace_v10_read_model_rows",
];

function assertContains(sql, needle, failure) {
  if (!sql.toLowerCase().includes(needle.toLowerCase())) failures.push(failure);
}

function assertRegex(sql, pattern, failure) {
  if (!pattern.test(sql)) failures.push(failure);
}

if (!existsSync(migrationPath)) {
  failures.push("missing:v10-runtime-migration");
} else {
  const sql = readFileSync(migrationPath, "utf8");
  if (/\)\s*;\s*\)\s*;\s*if\s+row_count_input\s*>/i.test(sql)) {
    failures.push("syntax-regression:replace_v10_read_model_rows-extra-close");
  }
  for (const required of [
    "create or replace function public.replace_v10_read_model_rows",
    "create or replace function public.cleanup_expired_v10_mutation_idempotency",
    "enable row level security",
    "drop policy if exists",
    "create policy",
    "create index",
    "security definer",
    "set search_path = public",
    "revoke all on function public.claim_v10_mutation_idempotency",
    "grant execute on function public.claim_v10_mutation_idempotency",
  ]) {
    if (!sql.toLowerCase().includes(required)) failures.push(`missing-v10-migration-contract:${required}`);
  }

  for (const tableName of REQUIRED_V10_TABLES) {
    assertRegex(
      sql,
      new RegExp(`create table if not exists public\\.${tableName}\\b`, "i"),
      `missing-v10-table:${tableName}`
    );
    assertContains(
      sql,
      `alter table public.${tableName} enable row level security`,
      `missing-v10-rls:${tableName}`
    );
    if (tableName === "v10_mutation_idempotency") {
      assertRegex(
        sql,
        /No direct member access V10 mutation idempotency[\s\S]*on public\.v10_mutation_idempotency for all[\s\S]*using \(false\)[\s\S]*with check \(false\)/i,
        "missing-v10-idempotency-deny-policy"
      );
    } else {
      assertRegex(
        sql,
        new RegExp(`on public\\.${tableName} for select`, "i"),
        `missing-v10-select-policy:${tableName}`
      );
    }
  }

  for (const indexName of REQUIRED_V10_INDEXES) {
    assertRegex(sql, new RegExp(`create (unique )?index if not exists ${indexName}\\b`, "i"), `missing-v10-index:${indexName}`);
  }

  for (const constraintName of REQUIRED_V10_CONSTRAINTS) {
    assertContains(sql, `add constraint ${constraintName}`, `missing-v10-constraint:${constraintName}`);
  }

  assertRegex(
    sql,
    /v10_release_evidence_records[\s\S]*denominator_lock_id text[\s\S]*fixed_sample_size integer[\s\S]*promotion_rule text/i,
    "missing-v10-release-evidence-promotion-columns"
  );
  assertRegex(
    sql,
    /v10_fixture_manifests[\s\S]*fixture_version text not null[\s\S]*denominator_locks jsonb not null[\s\S]*promoted_evidence_protected boolean not null default true/i,
    "missing-v10-fixture-manifest-persistence"
  );
  assertRegex(
    sql,
    /v10_metric_runs[\s\S]*denominator_lock_id text not null[\s\S]*pass_count integer not null[\s\S]*evidence_key text not null/i,
    "missing-v10-metric-run-persistence"
  );
  assertRegex(
    sql,
    /v10_promotion_decisions[\s\S]*unresolved_blockers text\[\] not null[\s\S]*rollback_ready boolean not null default false/i,
    "missing-v10-promotion-decision-persistence"
  );
  assertRegex(
    sql,
    /v10_verification_command_results[\s\S]*command text not null[\s\S]*blocker_reason text[\s\S]*captured_at timestamptz not null/i,
    "missing-v10-verification-command-persistence"
  );
  assertRegex(
    sql,
    /v10_runtime_artifacts[\s\S]*classification text not null[\s\S]*expires_at timestamptz[\s\S]*revoked_at timestamptz/i,
    "missing-v10-runtime-artifact-retention-columns"
  );
  assertRegex(
    sql,
    /v10_read_model_lineage[\s\S]*source_table text not null[\s\S]*source_id text not null[\s\S]*target_model text not null/i,
    "missing-v10-read-model-lineage-columns"
  );

  for (const functionName of REQUIRED_V10_SECURITY_DEFINER_FUNCTIONS) {
    const functionPattern = new RegExp(
      `create or replace function public\\.${functionName}[\\s\\S]*?security definer[\\s\\S]*?set search_path = public`,
      "i"
    );
    if (!functionPattern.test(sql)) failures.push(`missing-v10-function-search-path:${functionName}`);
    if (!sql.toLowerCase().includes(`revoke all on function public.${functionName}`)) {
      failures.push(`missing-v10-function-public-revoke:${functionName}`);
    }
    if (!sql.toLowerCase().includes(`grant execute on function public.${functionName}`)) {
      failures.push(`missing-v10-function-service-role-grant:${functionName}`);
    }
  }
}

function buildDisposableSupabaseBootstrap() {
  return `
create extension if not exists pgcrypto;
create schema if not exists auth;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role;
  end if;
end
$$;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select null::uuid
$$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid()
);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer',
  primary key (organization_id, user_id)
);
`;
}

function finish(payload, exitCode = 0) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(exitCode);
}

if (failures.length > 0) {
  finish({ ok: false, mode: "static_preflight", failures }, 1);
}

if (!databaseUrl) {
  /** Only GitHub Actions disposable Postgres jobs must run SQL; local `CI=1` QA sweeps use static preflight. */
  const strictSqlRequired = strict && process.env.GITHUB_ACTIONS === "true";
  finish(
    {
      ok: !strictSqlRequired,
      mode: "release_check_required",
      strict,
      sqlSmokeSkipped: strict && !strictSqlRequired,
      command: "psql --set ON_ERROR_STOP=1 --single-transaction --file supabase/migrations/057_v10_runtime_contracts.sql",
      requiredEnv: ["V10_MIGRATION_SMOKE_DATABASE_URL", "V10_MIGRATION_SMOKE_ALLOW_MUTATING_DATABASE=1"],
      reason: strictSqlRequired
        ? "GitHub Actions strict mode requires V10_MIGRATION_SMOKE_DATABASE_URL for SQL execution smoke."
        : "A disposable PostgreSQL database URL is required for SQL execution smoke.",
    },
    strictSqlRequired ? 1 : 0
  );
}

if (!allowMutatingDatabase) {
  finish(
    {
      ok: false,
      mode: "refused",
      reason: "Set V10_MIGRATION_SMOKE_ALLOW_MUTATING_DATABASE=1 only for a disposable migration-smoke database.",
    },
    1
  );
}

const result = spawnSync(
  "psql",
  (() => {
    const sql = readFileSync(migrationPath, "utf8");
    const scratchDir = mkdtempSync(join(tmpdir(), "v10-migration-smoke-"));
    const smokePath = join(scratchDir, "smoke.sql");
    writeFileSync(
      smokePath,
      [
        buildDisposableSupabaseBootstrap(),
        "\\echo applying_v10_runtime_contracts_first_pass",
        sql,
        applyTwice ? "\\echo applying_v10_runtime_contracts_idempotency_pass" : "",
        applyTwice ? sql : "",
      ].join("\n\n")
    );
    process.on("exit", () => rmSync(scratchDir, { recursive: true, force: true }));
    return ["--set", "ON_ERROR_STOP=1", "--single-transaction", "--file", smokePath, databaseUrl];
  })(),
  { stdio: "pipe", encoding: "utf8" }
);

finish(
  {
    ok: result.status === 0,
    mode: "executed",
    command: "psql --set ON_ERROR_STOP=1 --single-transaction --file <bootstrap+057_v10_runtime_contracts.sql>",
    applyTwice,
    exitCode: result.status,
    stdout: result.stdout.slice(-4000),
    stderr: result.stderr.slice(-4000),
  },
  result.status ?? 1
);
