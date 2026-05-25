import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  analyzeLocalMigrationSequence,
  runSupabaseOperationalReadiness,
} from "./check-supabase-operational-readiness.mjs";

function makeRoot(files) {
  const root = mkdtempSync(path.join(tmpdir(), "supabase-ops-readiness-"));
  const migrations = path.join(root, "supabase", "migrations");
  mkdirSync(migrations, { recursive: true });
  for (const file of files) {
    writeFileSync(path.join(migrations, file), "-- test migration\n");
  }
  return root;
}

test("analyzeLocalMigrationSequence accepts contiguous three digit migrations", () => {
  const root = makeRoot(["001_initial.sql", "002_second.sql", "003_third.sql"]);
  const report = analyzeLocalMigrationSequence(root);
  assert.equal(report.ok, true);
  assert.equal(report.migrationCount, 3);
  assert.equal(report.lastVersion, "003");
});

test("analyzeLocalMigrationSequence rejects duplicate and non-contiguous versions", () => {
  const root = makeRoot(["001_initial.sql", "001_duplicate.sql", "003_gap.sql"]);
  const report = analyzeLocalMigrationSequence(root);
  assert.equal(report.ok, false);
  assert.deepEqual(
    report.issues.map((issue) => issue.issue).sort(),
    ["duplicate_migration_version", "non_contiguous_migration_versions"]
  );
});

test("runSupabaseOperationalReadiness detects remote migration ledger drift", async () => {
  const root = makeRoot(["001_initial.sql", "002_second.sql"]);
  const runner = (command, args) => {
    assert.equal(command, "supabase");
    assert.deepEqual(args.slice(0, 3), ["db", "query", "--linked"]);
    return {
      status: 0,
      stdout: JSON.stringify({ rows: [{ version: "001" }, { version: "003" }] }),
      stderr: "",
    };
  };

  const report = await runSupabaseOperationalReadiness({
    root,
    runner,
    linked: true,
    advisors: false,
  });

  assert.equal(report.ok, false);
  assert.deepEqual(report.remoteLedger.missingRemote, ["002"]);
  assert.deepEqual(report.remoteLedger.extraRemote, ["003"]);
});

test("runSupabaseOperationalReadiness attaches advisor warning registry output", async () => {
  const root = makeRoot(["001_initial.sql"]);
  mkdirSync(path.join(root, "scripts"), { recursive: true });
  writeFileSync(
    path.join(root, "scripts", "supabase-advisor-warning-registry.json"),
    JSON.stringify({ schemaVersion: 1, reviewedWarnings: [] }, null, 2),
  );
  const warningRows = JSON.parse(readFileSync(path.join("scripts", "fixtures", "supabase-advisors", "unregistered-warning.json"), "utf8"));
  const runner = (command, args) => {
    assert.equal(command, "supabase");
    if (args[0] === "db" && args[1] === "query") {
      return { status: 0, stdout: JSON.stringify({ rows: [{ version: "001" }] }), stderr: "" };
    }
    if (args.includes("--level") && args.includes("error")) {
      return { status: 0, stdout: JSON.stringify([]), stderr: "" };
    }
    if (args.includes("--level") && args.includes("warn")) {
      return { status: 0, stdout: JSON.stringify(warningRows), stderr: "" };
    }
    throw new Error(`Unexpected command: supabase ${args.join(" ")}`);
  };

  const report = await runSupabaseOperationalReadiness({
    root,
    runner,
    linked: true,
    warnSummary: true,
  });

  assert.equal(report.ok, true);
  assert.equal(report.advisorWarnings.total, 1);
  assert.equal(report.advisorWarningRegistry.warningCount, 1);
  assert.equal(report.advisorWarningRegistry.warnings[0].warning, "unregistered_supabase_advisor_warning");
});

test("runSupabaseOperationalReadiness fails on linked advisor errors", async () => {
  const root = makeRoot(["001_initial.sql"]);
  const errorRows = JSON.parse(readFileSync(path.join("scripts", "fixtures", "supabase-advisors", "advisor-error.json"), "utf8"));
  const runner = (command, args) => {
    assert.equal(command, "supabase");
    if (args[0] === "db" && args[1] === "query") {
      return { status: 0, stdout: JSON.stringify({ rows: [{ version: "001" }] }), stderr: "" };
    }
    if (args.includes("--level") && args.includes("error")) {
      return { status: 0, stdout: JSON.stringify(errorRows), stderr: "" };
    }
    throw new Error(`Unexpected command: supabase ${args.join(" ")}`);
  };

  const report = await runSupabaseOperationalReadiness({
    root,
    runner,
    linked: true,
  });

  assert.equal(report.ok, false);
  assert.equal(report.advisorErrors.total, 1);
  assert.ok(report.issues.some((row) => row.issue === "supabase_advisor_errors"));
});
