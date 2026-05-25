import assert from "node:assert/strict";
import test from "node:test";

import { buildMigrationRollbackReport } from "./report-migration-rollbacks.mjs";

test("buildMigrationRollbackReport emits verification and manual rollback guidance", () => {
  const report = buildMigrationRollbackReport({
    index: {
      migrationCount: 2,
      latestVersion: "002",
      migrations: [
        {
          file: "001_initial_schema.sql",
          riskLevel: "low",
          changeType: "schema-only",
          cleanupMarked: false,
          requiresFollowUpVerification: false,
          affectedTables: [],
          verificationQueries: [],
        },
        {
          file: "002_security_policy.sql",
          riskLevel: "medium",
          changeType: "policy-changing",
          cleanupMarked: false,
          requiresFollowUpVerification: true,
          affectedTables: ["public.accounts"],
          verificationQueries: ["select * from pg_policies;"],
        },
      ],
    },
  });

  assert.equal(report.ok, true);
  assert.equal(report.reviewedMigrationCount, 1);
  assert.equal(report.entries[0].file, "002_security_policy.sql");
  assert.ok(report.entries[0].rollbackNote.includes("Policy-changing"));
  assert.ok(report.entries[0].manualActions.every((action) => !action.includes("password")));
});
