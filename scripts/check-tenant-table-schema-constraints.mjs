#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:tenant-table-schema-constraints"];
const REQUIRED_CI_COMMANDS = ["npm run check:tenant-table-schema-constraints"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:tenant-table-schema-constraints"'];
const REQUIRED_MARKERS = {
  "supabase/migrations/078_tenant_table_schema_constraints_guard.sql": [
    "organization_id",
    "c.attnotnull = false",
    "fk.contype = 'f'",
    "fk.confrelid = 'public.organizations'::regclass",
    "fk.confkey = array[org_id.attnum]::smallint[]",
    "v10_runtime_coverage_ledger",
    "tenant organization_id columns must be NOT NULL",
    "tenant organization_id columns must reference public.organizations(id)",
  ],
  "artifacts/assurance/rls-sanity-tables.json": ["\"scope\": \"organization_id\"", "\"service_role_bypass\""],
};

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

export function analyzeTenantTableSchemaConstraints(root = ROOT) {
  const issues = [];
  const pkg = JSON.parse(read(root, "package.json"));
  for (const script of REQUIRED_PACKAGE_SCRIPTS) {
    if (!pkg.scripts?.[script]) issues.push({ issue: "missing_package_script", script });
  }
  const ci = read(root, ".github/workflows/ci.yml");
  for (const cmd of REQUIRED_CI_COMMANDS) {
    if (!ci.includes(cmd)) issues.push({ issue: "missing_ci_reference", cmd });
  }
  const pipeline = read(root, "scripts/pipelines/pipeline-security-comprehensive.mjs");
  for (const step of REQUIRED_SECURITY_PIPELINE_STEPS) {
    if (!pipeline.includes(step)) issues.push({ issue: "missing_security_pipeline_step", step: step.replaceAll('"', "") });
  }
  for (const [rel, markers] of Object.entries(REQUIRED_MARKERS)) {
    if (!exists(root, rel)) {
      issues.push({ issue: "missing_required_file", rel });
      continue;
    }
    const text = read(root, rel);
    for (const marker of markers) {
      if (!text.includes(marker)) issues.push({ issue: "missing_marker", rel, marker });
    }
  }
  return {
    checkId: "tenant-table-schema-constraints",
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeTenantTableSchemaConstraints();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
