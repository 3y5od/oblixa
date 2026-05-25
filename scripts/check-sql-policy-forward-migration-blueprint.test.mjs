import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { buildSqlPolicyAliasReadiness } from "./check-sql-policy-alias-readiness.mjs";
import { buildSqlPolicyPredicateEquivalence } from "./check-sql-policy-predicate-equivalence.mjs";
import {
  analyzeSqlPolicyForwardMigrationBlueprint,
  buildSqlPolicyForwardMigrationBlueprint,
  generatedBlueprintSqlIssues,
} from "./check-sql-policy-forward-migration-blueprint.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sql-policy-forward-migration-blueprint-"));
}

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeJson(root, rel, value) {
  write(root, rel, `${JSON.stringify(value, null, 2)}\n`);
}

function names() {
  const prefix = "v";
  const upperPrefix = "V";
  return {
    legacyTable: `public.${prefix}10_activation_state`,
    neutralTable: "public.activation_state",
    legacyPolicyName: `Members can read ${upperPrefix}10 activation`,
    neutralPolicyName: "Members can read activation",
  };
}

function stagingRow(overrides = {}) {
  const n = names();
  return {
    legacyObject: `${n.legacyTable}:${n.legacyPolicyName}`,
    newObject: `${n.neutralTable}:${n.neutralPolicyName}`,
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

function writeFixture(root, overrides = {}) {
  const n = names();
  const row = overrides.stagingRow ?? stagingRow();
  writeJson(root, "artifacts/supabase/sql-object-rename-staging.json", {
    schemaVersion: 1,
    stagedRenames: overrides.stagingRows ?? [row],
  });
  writeJson(root, "artifacts/supabase/sql-neutral-table-view-aliases.json", {
    rows:
      overrides.tableAliasRows ??
      [
        {
          legacyObject: n.legacyTable,
          neutralObject: n.neutralTable,
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
      `create policy "${n.legacyPolicyName}"
  on ${n.legacyTable} for select
  using (public.${"v"}10_member_can_read(organization_id, required_role_minimum, visibility_state));
`,
  );
  write(
    root,
    "supabase/migrations/089_sql_neutral_table_view_aliases.sql",
    overrides.neutralSql ??
      `create or replace view ${n.neutralTable}
with (security_invoker = true)
as select * from ${n.legacyTable};
`,
  );
  const readiness = buildSqlPolicyAliasReadiness(root, { expectedPolicyRowCount: 1 });
  writeJson(root, "artifacts/supabase/sql-policy-alias-readiness.json", readiness);
  const { artifact: predicateArtifact, linkedVerificationSql } = buildSqlPolicyPredicateEquivalence(root, {
    expectedPolicyRowCount: 1,
  });
  writeJson(root, "artifacts/supabase/sql-policy-predicate-equivalence.json", predicateArtifact);
  write(root, "supabase/sql/policy-predicate-equivalence.sql", linkedVerificationSql);
}

test("sql policy forward-migration blueprint records prerequisites and comment-only SQL", () => {
  const root = makeRoot();
  writeFixture(root);

  const { artifact, blueprintSql } = buildSqlPolicyForwardMigrationBlueprint(root, { expectedPolicyRowCount: 1 });

  assert.equal(artifact.issueCount, 0);
  assert.equal(artifact.totals.policyRowCount, 1);
  assert.equal(artifact.totals.migratableInThisPassCount, 0);
  assert.equal(artifact.totals.queueCoveredCount, 1);
  assert.equal(artifact.rows[0].futureTargetRequirement, "neutral_policy_capable_table_or_equivalent_target_required");
  assert.equal(artifact.rows[0].requiredPredicateEquivalenceLinkedContext, "representative_authenticated_org_member_contexts");
  assert.match(blueprintSql, /FUTURE DDL PLACEHOLDER/u);
  assert.match(blueprintSql, /create policy "Members can read activation"/u);
  assert.match(blueprintSql, /false::boolean as migratable_in_this_pass/u);
  assert.deepEqual(generatedBlueprintSqlIssues(blueprintSql), []);
});

test("sql policy forward-migration blueprint fails without predicate-equivalence coverage", () => {
  const root = makeRoot();
  writeFixture(root);

  const { artifact } = buildSqlPolicyForwardMigrationBlueprint(root, {
    expectedPolicyRowCount: 1,
    policyPredicateEquivalenceReport: {
      ok: true,
      issueCount: 0,
      issues: [],
      current: { rows: [] },
    },
  });

  assert.equal(artifact.issueCount > 0, true);
  assert.ok(artifact.issues.some((row) => row.issue === "sql_policy_forward_migration_blueprint_unexpected_policy_row_count"));
});

test("sql policy forward-migration blueprint fails when queue, verification, and table-view evidence are missing", () => {
  const root = makeRoot();
  writeFixture(root, { queueRows: [], verificationRows: [], tableAliasRows: [] });

  const { artifact } = buildSqlPolicyForwardMigrationBlueprint(root, { expectedPolicyRowCount: 1 });

  assert.equal(artifact.issueCount > 0, true);
  assert.ok(artifact.issues.some((row) => row.issue === "sql_policy_forward_migration_blueprint_missing_queue_coverage"));
  assert.ok(artifact.issues.some((row) => row.issue === "sql_policy_forward_migration_blueprint_missing_verification_sql"));
  assert.ok(artifact.issues.some((row) => row.issue === "sql_policy_forward_migration_blueprint_missing_neutral_table_view_alias"));
});

test("sql policy forward-migration blueprint rejects executable DDL, grants, and writes", () => {
  const issues = generatedBlueprintSqlIssues(`
create policy unsafe on public.neutral using (true);
grant select on public.neutral to authenticated;
insert into public.neutral values (1);
`);

  assert.ok(issues.some((row) => row.issue === "sql_policy_forward_migration_blueprint_policy_ddl_rejected"));
  assert.ok(issues.some((row) => row.issue === "sql_policy_forward_migration_blueprint_grant_rejected"));
  assert.ok(issues.some((row) => row.issue === "sql_policy_forward_migration_blueprint_write_or_backfill_rejected"));
});

test("sql policy forward-migration blueprint detects deterministic artifact drift", () => {
  const root = makeRoot();
  writeFixture(root);
  writeJson(root, "artifacts/supabase/sql-policy-forward-migration-blueprint.json", { stale: true });
  write(root, "supabase/sql/policy-forward-migration-blueprint.sql", "-- stale\n");

  const report = analyzeSqlPolicyForwardMigrationBlueprint({ root, expectedPolicyRowCount: 1 });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((row) => row.issue === "sql_policy_forward_migration_blueprint_artifact_drift"));
  assert.ok(report.issues.some((row) => row.issue === "sql_policy_forward_migration_blueprint_sql_drift"));
});

test("sql policy forward-migration blueprint passes when committed outputs match", () => {
  const root = makeRoot();
  writeFixture(root);
  const { artifact, blueprintSql } = buildSqlPolicyForwardMigrationBlueprint(root, { expectedPolicyRowCount: 1 });
  writeJson(root, "artifacts/supabase/sql-policy-forward-migration-blueprint.json", artifact);
  write(root, "supabase/sql/policy-forward-migration-blueprint.sql", blueprintSql);

  const report = analyzeSqlPolicyForwardMigrationBlueprint({ root, expectedPolicyRowCount: 1 });

  assert.equal(report.ok, true);
});
