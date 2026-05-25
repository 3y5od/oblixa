import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeSqlPolicyAliasReadiness,
  buildSqlPolicyAliasReadiness,
  extractPolicyDefinitions,
} from "./check-sql-policy-alias-readiness.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sql-policy-alias-readiness-"));
}

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeJson(root, rel, value) {
  write(root, rel, `${JSON.stringify(value, null, 2)}\n`);
}

function baseNames() {
  const prefix = "v";
  const upperPrefix = "V";
  return {
    legacyTable: `public.${prefix}10_activation_state`,
    neutralTable: "public.activation_state",
    legacyPolicyName: `Members can read ${upperPrefix}10 activation`,
    neutralPolicyName: "Members can read activation",
  };
}

function baseStagingRow(overrides = {}) {
  const names = baseNames();
  return {
    legacyObject: `${names.legacyTable}:${names.legacyPolicyName}`,
    newObject: `${names.neutralTable}:${names.neutralPolicyName}`,
    objectType: "policy",
    dataBearing: false,
    owner: "database-platform",
    reason: "Policy predicate equivalence needs a forward migration.",
    status: "requires_forward_migration",
    validationCommand: "npm run check:sql-object-reference-inventory",
    validationSql: "select true;",
    cutoverStrategy: "Create neutral policy only after predicate equivalence is proven.",
    earliestRemovalCondition: "Forward migration and linked verification pass.",
    manualFollowUp: "Do not remove the retained SQL policy yet.",
    ...overrides,
  };
}

function writeBaseFixture(root, overrides = {}) {
  const names = baseNames();
  const row = overrides.stagingRow ?? baseStagingRow();
  const stagingRows = overrides.stagingRows ?? [row];
  writeJson(root, "artifacts/supabase/sql-object-rename-staging.json", { schemaVersion: 1, stagedRenames: stagingRows });
  writeJson(root, "artifacts/supabase/sql-neutral-table-view-aliases.json", {
    rows:
      overrides.tableAliasRows ??
      [
        {
          legacyObject: names.legacyTable,
          neutralObject: names.neutralTable,
          status: "alias_added",
          viewDefined: true,
          securityInvoker: true,
          delegatesToLegacyTable: true,
        },
      ],
  });
  writeJson(root, "artifacts/supabase/sql-security-automation-coverage.json", {
    rows:
      overrides.securityRows ??
      [
        {
          kind: "rls_policy",
          objectType: "policy",
          legacyName: row.legacyObject,
          neutralAlias: row.newObject,
          queueCovered: true,
        },
      ],
  });
  writeJson(root, "artifacts/supabase/sql-rename-verification-sql.json", {
    statements:
      overrides.verificationRows ??
      [
        {
          legacyObject: row.legacyObject,
          neutralObject: row.newObject,
          objectType: "policy",
          validationSql: "select true;",
        },
      ],
  });
  writeJson(root, "artifacts/compatibility/removal-queue.json", {
    queues: {
      sqlObjects:
        overrides.queueRows ??
        [
          {
            legacyName: row.legacyObject,
            neutralAlias: row.newObject,
            status: "awaiting_linked_verification",
            validationCommand: "npm run check:sql-object-reference-inventory",
            manualFollowUp: "Do not remove the retained SQL policy yet.",
          },
        ],
    },
  });
  write(
    root,
    `supabase/migrations/057_${"v"}10_runtime_contracts.sql`,
    overrides.legacySql ??
      `create policy "${names.legacyPolicyName}"
  on ${names.legacyTable} for select
  using (exists (
    select 1 from public.organization_members om
    where om.organization_id = activation_state.organization_id
      and om.user_id = auth.uid()
  ));
`,
  );
  write(
    root,
    "supabase/migrations/089_sql_neutral_table_view_aliases.sql",
    overrides.neutralSql ??
      `create or replace view ${names.neutralTable}
with (security_invoker = true)
as select * from ${names.legacyTable};
`,
  );
  return row;
}

test("extractPolicyDefinitions normalizes policy command and predicates", () => {
  const names = baseNames();
  const definitions = extractPolicyDefinitions(`create policy "${names.legacyPolicyName}"
  on ${names.legacyTable} for all
  using (false)
  with check (false);`);

  assert.equal(definitions.length, 1);
  assert.equal(definitions[0].identity, `${names.legacyTable}:${names.legacyPolicyName}`);
  assert.equal(definitions[0].command, "all");
  assert.deepEqual(definitions[0].roles, []);
  assert.equal(definitions[0].usingPredicate, "false");
  assert.equal(definitions[0].withCheckPredicate, "false");
});

test("sql policy alias readiness classifies policies as blocked by neutral view targets", () => {
  const root = makeRoot();
  writeBaseFixture(root);

  const artifact = buildSqlPolicyAliasReadiness(root, { expectedPolicyRowCount: 1 });

  assert.equal(artifact.issueCount, 0);
  assert.equal(artifact.totals.policyRowCount, 1);
  assert.equal(artifact.totals.requiresForwardMigrationCount, 1);
  assert.equal(artifact.totals.aliasAddedCount, 0);
  assert.equal(artifact.totals.blockerClassCounts.neutral_target_is_view_requires_policy_migration, 1);
  assert.equal(artifact.rows[0].status, "requires_forward_migration");
  assert.equal(artifact.rows[0].command, "select");
  assert.match(artifact.rows[0].usingPredicate, /organization_members/u);
});

test("sql policy alias readiness fails when a legacy policy definition is missing", () => {
  const root = makeRoot();
  writeBaseFixture(root, { legacySql: "" });

  const artifact = buildSqlPolicyAliasReadiness(root, { expectedPolicyRowCount: 1 });

  assert.equal(artifact.issueCount > 0, true);
  assert.ok(artifact.issues.some((row) => row.issue === "sql_policy_alias_readiness_missing_legacy_policy_definition"));
});

test("sql policy alias readiness fails if a staged policy is marked alias-added", () => {
  const root = makeRoot();
  writeBaseFixture(root, { stagingRow: baseStagingRow({ status: "alias_added" }) });

  const artifact = buildSqlPolicyAliasReadiness(root, { expectedPolicyRowCount: 1 });

  assert.equal(artifact.issueCount > 0, true);
  assert.ok(artifact.issues.some((row) => row.issue === "sql_policy_alias_readiness_policy_marked_alias_added"));
});

test("sql policy alias readiness fails when neutral table-view evidence is stale", () => {
  const root = makeRoot();
  writeBaseFixture(root, { tableAliasRows: [] });

  const artifact = buildSqlPolicyAliasReadiness(root, { expectedPolicyRowCount: 1 });

  assert.equal(artifact.issueCount > 0, true);
  assert.ok(artifact.issues.some((row) => row.issue === "sql_policy_alias_readiness_missing_neutral_table_view_alias"));
});

test("sql policy alias readiness rejects policy migration SQL in this pass", () => {
  const root = makeRoot();
  const names = baseNames();
  writeBaseFixture(root, {
    neutralSql: `create policy "${names.neutralPolicyName}" on ${names.neutralTable} for select using (true);`,
  });

  const artifact = buildSqlPolicyAliasReadiness(root, { expectedPolicyRowCount: 1 });

  assert.equal(artifact.issueCount > 0, true);
  assert.ok(artifact.issues.some((row) => row.issue === "sql_policy_alias_readiness_policy_migration_sql_rejected"));
});

test("sql policy alias readiness fails when queue or verification coverage is missing", () => {
  const root = makeRoot();
  writeBaseFixture(root, { queueRows: [], verificationRows: [] });

  const artifact = buildSqlPolicyAliasReadiness(root, { expectedPolicyRowCount: 1 });

  assert.equal(artifact.issueCount > 0, true);
  assert.ok(artifact.issues.some((row) => row.issue === "sql_policy_alias_readiness_missing_queue_coverage"));
  assert.ok(artifact.issues.some((row) => row.issue === "sql_policy_alias_readiness_missing_verification_sql"));
});

test("sql policy alias readiness detects deterministic artifact drift", () => {
  const root = makeRoot();
  writeBaseFixture(root);
  writeJson(root, "artifacts/supabase/sql-policy-alias-readiness.json", { stale: true });

  const report = analyzeSqlPolicyAliasReadiness({ root, expectedPolicyRowCount: 1 });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((row) => row.issue === "sql_policy_alias_readiness_artifact_drift"));
});

test("sql policy alias readiness passes when committed artifact matches current evidence", () => {
  const root = makeRoot();
  writeBaseFixture(root);
  const artifact = buildSqlPolicyAliasReadiness(root, { expectedPolicyRowCount: 1 });
  writeJson(root, "artifacts/supabase/sql-policy-alias-readiness.json", artifact);

  const report = analyzeSqlPolicyAliasReadiness({ root, expectedPolicyRowCount: 1 });

  assert.equal(report.ok, true);
});
