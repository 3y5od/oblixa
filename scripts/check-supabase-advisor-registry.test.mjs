import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeSupabaseAdvisorRegistry,
  analyzeSupabaseAdvisorRegistryFromRows,
  normalizeSupabaseAdvisorRows,
} from "./check-supabase-advisor-registry.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "supabase-advisor-registry-"));
}

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join("scripts", "fixtures", "supabase-advisors", name), "utf8"));
}

const registry = {
  schemaVersion: 1,
  reviewedWarnings: [
    {
      advisorName: "rls_disabled_in_public",
      level: "warn",
      owner: "security",
      reason: "Fixture warning accepted while testing registry matching.",
      reviewDate: "2026-05-23",
    },
  ],
};

test("normalizeSupabaseAdvisorRows returns stable categories", () => {
  assert.deepEqual(normalizeSupabaseAdvisorRows(fixture("known-warning.json")), [
    {
      advisorName: "rls_disabled_in_public",
      level: "warn",
      title: "RLS Disabled in Public",
      detail: "Table public.example has RLS disabled.",
      entity: "public.example",
    },
  ]);
});

test("analyzeSupabaseAdvisorRegistryFromRows accepts registered warnings", () => {
  const report = analyzeSupabaseAdvisorRegistryFromRows({
    rows: fixture("known-warning.json"),
    registry,
  });

  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
  assert.equal(report.warningCount, 0);
});

test("analyzeSupabaseAdvisorRegistryFromRows reports unregistered warnings without failing by default", () => {
  const report = analyzeSupabaseAdvisorRegistryFromRows({
    rows: fixture("unregistered-warning.json"),
    registry,
  });

  assert.equal(report.ok, true);
  assert.equal(report.warningCount, 1);
  assert.equal(report.warnings[0].warning, "unregistered_supabase_advisor_warning");
});

test("analyzeSupabaseAdvisorRegistryFromRows can make unregistered warnings strict", () => {
  const report = analyzeSupabaseAdvisorRegistryFromRows({
    rows: fixture("unregistered-warning.json"),
    registry,
    strictWarnings: true,
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((row) => row.issue === "unregistered_supabase_advisor_warning"));
});

test("analyzeSupabaseAdvisorRegistryFromRows fails on advisor errors", () => {
  const report = analyzeSupabaseAdvisorRegistryFromRows({
    rows: fixture("advisor-error.json"),
    registry,
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((row) => row.issue === "supabase_advisor_error"));
});

test("analyzeSupabaseAdvisorRegistry validates registry entry metadata", () => {
  const root = makeRoot();
  write(
    root,
    "scripts/supabase-advisor-warning-registry.json",
    JSON.stringify(
      {
        schemaVersion: 1,
        reviewedWarnings: [{ advisorName: "rls_disabled_in_public", level: "warn", owner: "", reason: "", reviewDate: "today" }],
      },
      null,
      2,
    ),
  );

  const report = analyzeSupabaseAdvisorRegistry({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((row) => row.issue === "missing_supabase_advisor_registry_field" && row.field === "owner"));
  assert.ok(report.issues.some((row) => row.issue === "invalid_supabase_advisor_review_date"));
});
