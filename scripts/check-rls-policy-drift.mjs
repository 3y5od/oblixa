#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migrationsDir = path.join(root, "supabase", "migrations");
const strict = process.argv.includes("--strict");

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

const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
const created = new Set();
const rlsEnabled = new Set();
const policyProtected = new Set();

for (const file of files) {
  const text = fs.readFileSync(path.join(migrationsDir, file), "utf8");
  for (const match of text.matchAll(/create table(?: if not exists)?\s+public\.([a-zA-Z0-9_]+)/gi)) {
    created.add(match[1]);
  }
  for (const match of text.matchAll(/alter table\s+public\.([a-zA-Z0-9_]+)\s+enable row level security/gi)) {
    rlsEnabled.add(match[1]);
  }
  for (const match of text.matchAll(/create policy\s+"[^"]+"\s+on\s+(?:public\.)?([a-zA-Z0-9_]+)/gi)) {
    policyProtected.add(match[1]);
  }
}

for (const table of dynamicPolicyTables) {
  policyProtected.add(table);
}
for (const table of serviceManagedTables) {
  policyProtected.add(table);
}

const missingRls = [...created].filter((table) => !rlsEnabled.has(table)).sort();
const missingPolicies = [...rlsEnabled]
  .filter((table) => !policyProtected.has(table))
  .sort();

const payload = {
  strict,
  totalCreatedTables: created.size,
  totalRlsEnabledTables: rlsEnabled.size,
  totalPolicyProtectedTables: policyProtected.size,
  missingRls,
  missingPolicies,
};

console.log(JSON.stringify(payload, null, 2));
if (missingRls.length > 0) process.exit(1);
if (strict && missingPolicies.length > 0) process.exit(1);
