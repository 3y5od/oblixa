import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeRlsPolicyDrift } from "./check-rls-policy-drift.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeHarness(root) {
  write(root, "package.json", JSON.stringify({ scripts: { "check:rls-policy-drift": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:rls-policy-drift\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:rls-policy-drift"\n');
}

test("analyzeRlsPolicyDrift accepts RLS-enabled policy-protected tables", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-rls-policy-ok-"));
  writeHarness(root);
  write(
    root,
    "supabase/migrations/001_ok.sql",
    `
create table public.contracts (
  id uuid primary key,
  organization_id uuid not null
);
alter table public.contracts enable row level security;
create policy "members read contracts" on public.contracts for select using (organization_id is not null);
`
  );

  const report = analyzeRlsPolicyDrift(root);
  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
  assert.equal(report.missingRls.length, 0);
  assert.equal(report.missingPolicies.length, 0);
});

test("analyzeRlsPolicyDrift rejects missing RLS, missing policies, and missing harness wiring", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-rls-policy-bad-"));
  write(root, "package.json", JSON.stringify({ scripts: {} }));
  write(root, ".github/workflows/ci.yml", "");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", "");
  write(
    root,
    "supabase/migrations/001_bad.sql",
    `
create table public.contracts (
  id uuid primary key,
  organization_id uuid not null
);
alter table public.contracts enable row level security;

create table public.tasks (
  id uuid primary key,
  organization_id uuid not null
);
`
  );

  const report = analyzeRlsPolicyDrift(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "missing_package_script"));
  assert(report.issues.some((issue) => issue.issue === "missing_ci_reference"));
  assert(report.issues.some((issue) => issue.issue === "missing_security_pipeline_step"));
  assert(report.issues.some((issue) => issue.issue === "table_missing_rls_enable" && issue.table === "tasks"));
  assert(report.issues.some((issue) => issue.issue === "rls_table_missing_policy_or_exception" && issue.table === "contracts"));
});
