#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:rls-policy-drift"];
const REQUIRED_CI_COMMANDS = ["npm run check:rls-policy-drift"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:rls-policy-drift"'];

const serviceManagedTables = new Set(["stripe_webhook_events"]);
const dynamicPolicyTables = new Set([
  "control_policies",
  "control_policy_versions",
  "control_policy_assignments",
  "assurance_findings",
  "assurance_finding_events",
  "assurance_check_runs",
  "adaptive_playbooks",
  "adaptive_playbook_runs",
  "adaptive_playbook_steps",
  "portfolio_health_graph_nodes",
  "portfolio_health_graph_edges",
  "assurance_scorecards",
  "scorecard_snapshots",
  "outcome_intervention_analyses",
  "review_boards",
  "review_board_runs",
  "segment_definitions",
  "segment_memberships",
  "autopilot_rules",
  "autopilot_run_logs",
  "program_evolution_experiments",
  "program_evolution_results",
]);

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

function stripComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*--/.test(line))
    .join("\n");
}

function addStaticPolicyExceptions(policyProtected) {
  for (const table of dynamicPolicyTables) {
    policyProtected.add(table);
  }
  for (const table of serviceManagedTables) {
    policyProtected.add(table);
  }
}

function collectMigrationPolicyState(root) {
  const migrationsDir = path.join(root, "supabase", "migrations");
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  const created = new Set();
  const rlsEnabled = new Set();
  const policyProtected = new Set();

  for (const file of files) {
    const text = stripComments(fs.readFileSync(path.join(migrationsDir, file), "utf8"));
    for (const match of text.matchAll(/create table(?: if not exists)?\s+public\.([a-zA-Z0-9_]+)/gi)) {
      created.add(match[1]);
    }
    for (const match of text.matchAll(/alter table\s+(?:if exists\s+)?public\.([a-zA-Z0-9_]+)\s+enable row level security/gi)) {
      rlsEnabled.add(match[1]);
    }
    for (const match of text.matchAll(/create policy\s+"[^"]+"\s+on\s+(?:public\.)?([a-zA-Z0-9_]+)/gi)) {
      policyProtected.add(match[1]);
    }
  }

  addStaticPolicyExceptions(policyProtected);
  return { created, rlsEnabled, policyProtected };
}

function collectHarnessIssues(root) {
  const issues = [];
  if (!exists(root, "package.json")) {
    issues.push({ issue: "missing_package_json" });
    return issues;
  }

  const pkg = JSON.parse(read(root, "package.json"));
  for (const script of REQUIRED_PACKAGE_SCRIPTS) {
    if (!pkg.scripts?.[script]) issues.push({ issue: "missing_package_script", script });
  }

  if (!exists(root, ".github/workflows/ci.yml")) {
    issues.push({ issue: "missing_ci_workflow", rel: ".github/workflows/ci.yml" });
  } else {
    const ci = read(root, ".github/workflows/ci.yml");
    for (const cmd of REQUIRED_CI_COMMANDS) {
      if (!ci.includes(cmd)) issues.push({ issue: "missing_ci_reference", cmd });
    }
  }

  if (!exists(root, "scripts/pipelines/pipeline-security-comprehensive.mjs")) {
    issues.push({
      issue: "missing_security_pipeline",
      rel: "scripts/pipelines/pipeline-security-comprehensive.mjs",
    });
  } else {
    const securityPipeline = read(root, "scripts/pipelines/pipeline-security-comprehensive.mjs");
    for (const step of REQUIRED_SECURITY_PIPELINE_STEPS) {
      if (!securityPipeline.includes(step)) {
        issues.push({ issue: "missing_security_pipeline_step", step: step.replaceAll('"', "") });
      }
    }
  }

  return issues;
}

export function analyzeRlsPolicyDrift(root = ROOT, options = {}) {
  const enforcePolicies = options.enforcePolicies ?? true;
  const issues = collectHarnessIssues(root);
  const { created, rlsEnabled, policyProtected } = collectMigrationPolicyState(root);

  const missingRls = [...created].filter((table) => !rlsEnabled.has(table)).sort();
  const missingPolicies = [...rlsEnabled].filter((table) => !policyProtected.has(table)).sort();

  for (const table of missingRls) {
    issues.push({ issue: "table_missing_rls_enable", table });
  }
  if (enforcePolicies) {
    for (const table of missingPolicies) {
      issues.push({ issue: "rls_table_missing_policy_or_exception", table });
    }
  }

  return {
    checkId: "rls-policy-drift",
    ok: issues.length === 0,
    enforcePolicies,
    totalCreatedTables: created.size,
    totalRlsEnabledTables: rlsEnabled.size,
    totalPolicyProtectedTables: policyProtected.size,
    missingRls,
    missingPolicies,
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeRlsPolicyDrift(ROOT, {
    enforcePolicies: !process.argv.includes("--warn-only"),
  });
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
