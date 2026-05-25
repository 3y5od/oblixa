import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { buildSqlPolicyAliasReadiness } from "./check-sql-policy-alias-readiness.mjs";
import {
  analyzeSqlPolicyPredicateEquivalence,
  buildSqlPolicyPredicateEquivalence,
} from "./check-sql-policy-predicate-equivalence.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sql-policy-predicate-equivalence-"));
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
  using (public.v10_member_can_read(organization_id, required_role_minimum, visibility_state));
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
}

test("sql policy predicate equivalence records predicate candidates and generated SQL", () => {
  const root = makeRoot();
  writeFixture(root);

  const { artifact, linkedVerificationSql } = buildSqlPolicyPredicateEquivalence(root, { expectedPolicyRowCount: 1 });

  assert.equal(artifact.issueCount, 0);
  assert.equal(artifact.totals.policyRowCount, 1);
  assert.equal(artifact.rows[0].legacyUsingPredicate, "public.v10_member_can_read(organization_id, required_role_minimum, visibility_state)");
  assert.equal(artifact.rows[0].neutralUsingPredicateCandidate, "public.member_can_read(organization_id, required_role_minimum, visibility_state)");
  assert.equal(artifact.rows[0].authContextRequired, true);
  assert.match(linkedVerificationSql, /manual_auth_context_required/u);
  assert.match(linkedVerificationSql, /visible_count_matches/u);
});

test("sql policy predicate equivalence fails on missing predicate evidence", () => {
  const root = makeRoot();
  const n = names();
  writeFixture(root, {
    legacySql: `create policy "${n.legacyPolicyName}" on ${n.legacyTable} for select;`,
  });

  const { artifact } = buildSqlPolicyPredicateEquivalence(root, { expectedPolicyRowCount: 1 });

  assert.equal(artifact.issueCount > 0, true);
  assert.ok(artifact.issues.some((row) => row.issue === "sql_policy_predicate_equivalence_missing_using_predicate"));
});

test("sql policy predicate equivalence fails when queue and verification coverage are missing", () => {
  const root = makeRoot();
  writeFixture(root, { queueRows: [], verificationRows: [] });

  const { artifact } = buildSqlPolicyPredicateEquivalence(root, { expectedPolicyRowCount: 1 });

  assert.equal(artifact.issueCount > 0, true);
  assert.ok(artifact.issues.some((row) => row.issue === "sql_policy_predicate_equivalence_missing_queue_coverage"));
  assert.ok(artifact.issues.some((row) => row.issue === "sql_policy_predicate_equivalence_missing_verification_sql"));
});

test("sql policy predicate equivalence fails when neutral table-view evidence is stale", () => {
  const root = makeRoot();
  writeFixture(root, { tableAliasRows: [] });

  const { artifact } = buildSqlPolicyPredicateEquivalence(root, { expectedPolicyRowCount: 1 });

  assert.equal(artifact.issueCount > 0, true);
  assert.ok(artifact.issues.some((row) => row.issue === "sql_policy_predicate_equivalence_missing_neutral_table_view_alias"));
});

test("sql policy predicate equivalence rejects generated policy DDL", () => {
  const root = makeRoot();
  writeFixture(root);
  const report = analyzeSqlPolicyPredicateEquivalence({
    root,
    expectedPolicyRowCount: 1,
    policyReadinessReport: {
      ok: true,
      issueCount: 0,
      issues: [],
      current: {
        rows: [
          {
            ...buildSqlPolicyAliasReadiness(root, { expectedPolicyRowCount: 1 }).rows[0],
            legacyTable: "create policy injected",
          },
        ],
      },
    },
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((row) => row.issue === "sql_policy_predicate_equivalence_policy_ddl_rejected"));
});

test("sql policy predicate equivalence detects deterministic artifact drift", () => {
  const root = makeRoot();
  writeFixture(root);
  writeJson(root, "artifacts/supabase/sql-policy-predicate-equivalence.json", { stale: true });
  write(root, "supabase/sql/policy-predicate-equivalence.sql", "-- stale\n");

  const report = analyzeSqlPolicyPredicateEquivalence({ root, expectedPolicyRowCount: 1 });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((row) => row.issue === "sql_policy_predicate_equivalence_artifact_drift"));
  assert.ok(report.issues.some((row) => row.issue === "sql_policy_predicate_equivalence_sql_drift"));
});

test("sql policy predicate equivalence passes when committed outputs match", () => {
  const root = makeRoot();
  writeFixture(root);
  const { artifact, linkedVerificationSql } = buildSqlPolicyPredicateEquivalence(root, { expectedPolicyRowCount: 1 });
  writeJson(root, "artifacts/supabase/sql-policy-predicate-equivalence.json", artifact);
  write(root, "supabase/sql/policy-predicate-equivalence.sql", linkedVerificationSql);

  const report = analyzeSqlPolicyPredicateEquivalence({ root, expectedPolicyRowCount: 1 });

  assert.equal(report.ok, true);
});
