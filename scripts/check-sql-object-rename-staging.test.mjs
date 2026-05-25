import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeSqlObjectRenameStaging,
  buildSqlObjectRenameStagingArtifact,
} from "./check-sql-object-rename-staging.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sql-object-rename-staging-"));
}

function writeJson(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`);
}

test("analyzeSqlObjectRenameStaging accepts an empty staged queue", () => {
  const root = makeRoot();
  writeJson(root, "artifacts/supabase/sql-object-rename-staging.json", buildSqlObjectRenameStagingArtifact(root));

  const report = analyzeSqlObjectRenameStaging({ root });

  assert.equal(report.ok, true);
  assert.equal(report.stagedRenameCount, 0);
});

test("analyzeSqlObjectRenameStaging rejects incomplete staged rename metadata", () => {
  const root = makeRoot();
  const artifact = buildSqlObjectRenameStagingArtifact(root);
  artifact.stagedRenames.push({ legacyObject: "public.old_table" });
  writeJson(root, "artifacts/supabase/sql-object-rename-staging.json", artifact);

  const report = analyzeSqlObjectRenameStaging({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "sql_object_rename_stage_missing_metadata"));
  assert.ok(report.issues.some((issue) => issue.issue === "sql_object_rename_stage_missing_stage_list"));
});

test("buildSqlObjectRenameStagingArtifact stages versioned SQL objects from reference inventory", () => {
  const root = makeRoot();
  writeJson(root, "artifacts/supabase/sql-object-reference-inventory.json", {
    definedObjects: {
      tables: {
        "public.v10_work_items": ["supabase/migrations/001.sql"],
      },
      views: {
        "public.work_items": ["supabase/migrations/002.sql"],
      },
      functions: {
        "public.cleanup_expired_v10_runtime_artifacts": ["supabase/migrations/001.sql"],
        "public.cleanup_expired_runtime_artifacts": ["supabase/migrations/002.sql"],
      },
    },
  });

  const artifact = buildSqlObjectRenameStagingArtifact(root);

  assert.deepEqual(
    artifact.stagedRenames.map((row) => [row.legacyObject, row.newObject, row.objectType, row.dataBearing]),
    [
      ["public.cleanup_expired_v10_runtime_artifacts", "public.cleanup_expired_runtime_artifacts", "function", false],
      ["public.v10_work_items", "public.work_items", "table", true],
    ],
  );
  assert.match(artifact.stagedRenames[0].validationSql, /to_regproc/u);
  assert.match(artifact.stagedRenames[1].validationSql, /to_regclass/u);
  assert.equal(artifact.stagedRenames.every((row) => row.cutoverStrategy.length > 0), true);
  assert.equal(artifact.stagedRenames[0].status, "alias_added");
  assert.equal(artifact.stagedRenames[0].validationCommand, "npm run check:sql-rename-verification-sql");
  assert.equal(artifact.stagedRenames[1].status, "alias_added");
  assert.equal(artifact.stagedRenames[1].validationCommand, "npm run check:sql-rename-verification-sql");
});
