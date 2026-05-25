import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeSqlNeutralTableViewAliases,
  buildSqlNeutralTableViewAliases,
} from "./check-sql-neutral-table-view-aliases.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sql-neutral-table-view-aliases-"));
}

function writeFile(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, value);
}

function writeJson(root, rel, value) {
  writeFile(root, rel, `${JSON.stringify(value, null, 2)}\n`);
}

function stagingRows() {
  return [
    {
      legacyObject: "public.v10_activation_state",
      newObject: "public.activation_state",
      objectType: "table",
      dataBearing: true,
      owner: "database-platform",
      reason: "Data-bearing SQL object needs neutral read-only view alias.",
      status: "requires_forward_migration",
      validationCommand: "npm run check:sql-object-reference-inventory",
      validationSql: "select true;",
      cutoverStrategy: "Create neutral read-only view.",
      earliestRemovalCondition: "Forward migration and linked verification pass.",
      manualFollowUp: "Do not remove retained table.",
      stages: ["add_new_object_or_alias"],
    },
    {
      legacyObject: "public.v10_mutation_idempotency",
      newObject: "public.mutation_idempotency",
      objectType: "table",
      dataBearing: true,
      owner: "database-platform",
      reason: "Data-bearing SQL object needs neutral read-only view alias.",
      status: "requires_forward_migration",
      validationCommand: "npm run check:sql-object-reference-inventory",
      validationSql: "select true;",
      cutoverStrategy: "Create service-role-only neutral read-only view.",
      earliestRemovalCondition: "Forward migration and linked verification pass.",
      manualFollowUp: "Do not remove retained table.",
      stages: ["add_new_object_or_alias"],
    },
  ];
}

function validMigrationSql() {
  return `
create or replace view public.activation_state
with (security_invoker = true)
as
select * from public.v10_activation_state;

revoke all on table public.activation_state from public;
grant select on table public.activation_state to authenticated;
grant select on table public.activation_state to service_role;

create or replace view public.mutation_idempotency
with (security_invoker = true)
as
select * from public.v10_mutation_idempotency;

revoke all on table public.mutation_idempotency from public;
grant select on table public.mutation_idempotency to service_role;
`;
}

function writeFixture(root, migrationSql = validMigrationSql()) {
  writeJson(root, "artifacts/supabase/sql-object-rename-staging.json", {
    schemaVersion: 2,
    stagedRenames: stagingRows(),
  });
  writeFile(root, "supabase/migrations/089_sql_neutral_table_view_aliases.sql", migrationSql);
}

test("table view alias check accepts security-invoker aliases with bounded grants", () => {
  const root = makeRoot();
  writeFixture(root);

  const artifact = buildSqlNeutralTableViewAliases(root, { expectedTableAliasCount: 2 });

  assert.equal(artifact.issueCount, 0);
  assert.equal(artifact.totals.tableAliasCount, 2);
  assert.equal(artifact.totals.aliasAddedCount, 2);
  assert.equal(artifact.totals.memberReadableAliasCount, 1);
  assert.equal(artifact.totals.serviceRoleOnlyAliasCount, 1);
});

test("table view alias check fails when security_invoker is missing", () => {
  const root = makeRoot();
  writeFixture(root, validMigrationSql().replace("with (security_invoker = true)", ""));

  const artifact = buildSqlNeutralTableViewAliases(root, { expectedTableAliasCount: 2 });

  assert.equal(artifact.issueCount > 0, true);
  assert.ok(artifact.issues.some((row) => row.issue === "sql_neutral_table_view_alias_missing_security_invoker"));
});

test("table view alias check fails when service-role-only alias grants authenticated", () => {
  const root = makeRoot();
  writeFixture(
    root,
    `${validMigrationSql()}
grant select on table public.mutation_idempotency to authenticated;
`,
  );

  const artifact = buildSqlNeutralTableViewAliases(root, { expectedTableAliasCount: 2 });

  assert.equal(artifact.issueCount > 0, true);
  assert.ok(artifact.issues.some((row) => row.issue === "sql_neutral_table_view_alias_broader_grant" && row.role === "authenticated"));
});

test("table view alias check fails on write, backfill, drop, or policy SQL", () => {
  const root = makeRoot();
  writeFixture(
    root,
    `${validMigrationSql()}
insert into public.activation_state select * from public.v10_activation_state;
`,
  );

  const artifact = buildSqlNeutralTableViewAliases(root, { expectedTableAliasCount: 2 });

  assert.equal(artifact.issueCount > 0, true);
  assert.ok(artifact.issues.some((row) => row.issue === "sql_neutral_table_view_aliases_unsafe_sql_statement"));
});

test("table view alias check fails on unexpected neutral views", () => {
  const root = makeRoot();
  writeFixture(
    root,
    `${validMigrationSql()}
create or replace view public.extra_alias
with (security_invoker = true)
as
select * from public.v10_extra_alias;
`,
  );

  const artifact = buildSqlNeutralTableViewAliases(root, { expectedTableAliasCount: 2 });

  assert.equal(artifact.issueCount > 0, true);
  assert.ok(artifact.issues.some((row) => row.issue === "sql_neutral_table_view_aliases_unexpected_view"));
});

test("table view alias check detects deterministic artifact drift", () => {
  const root = makeRoot();
  writeFixture(root);
  writeJson(root, "artifacts/supabase/sql-neutral-table-view-aliases.json", { stale: true });

  const report = analyzeSqlNeutralTableViewAliases({ root, expectedTableAliasCount: 2 });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((row) => row.issue === "sql_neutral_table_view_aliases_artifact_drift"));
});

test("table view alias check passes when committed artifact matches current evidence", () => {
  const root = makeRoot();
  writeFixture(root);
  const artifact = buildSqlNeutralTableViewAliases(root, { expectedTableAliasCount: 2 });
  writeJson(root, "artifacts/supabase/sql-neutral-table-view-aliases.json", artifact);

  const report = analyzeSqlNeutralTableViewAliases({ root, expectedTableAliasCount: 2 });

  assert.equal(report.ok, true);
});
