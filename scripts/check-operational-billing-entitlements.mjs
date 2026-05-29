#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { analyzeAuditEventCoverage } from "./check-audit-event-coverage.mjs";
import { analyzeProviderIntegrationFixtures } from "./check-provider-integration-fixtures.mjs";
import { analyzeReleaseSecurityRequiredEnv } from "./check-release-security-required-env.mjs";

const ROOT = process.cwd();
const CONFIG_REL = "config/operational-billing-entitlements.json";
const ARTIFACT_REL = "artifacts/operational-billing-entitlements.json";
const WRITE = process.argv.includes("--write");

const REQUIRED_ENTITLEMENT_GATES = new Set([
  "plans",
  "billing-states",
  "feature-access",
  "workspace-modes",
  "seats",
  "usage-limits",
  "grace-periods",
  "blocked-states",
]);

const REQUIRED_BILLING_STATES = new Set([
  "trialing",
  "active",
  "past-due",
  "unpaid",
  "canceled",
  "incomplete",
  "incomplete-expired",
  "paused",
  "no-customer",
  "no-subscription",
  "portal-return",
]);

const REQUIRED_SEAT_INVITE_LIMITS = new Set([
  "invite-creation",
  "revoke",
  "accept",
  "expired-invite",
  "duplicate-invite",
  "seat-limit",
  "role-change",
  "billing-mismatch",
]);

const REQUIRED_REVENUE_SAFEGUARDS = new Set([
  "idempotency",
  "audit-events",
  "redaction",
  "provider-event-replay",
  "manual-boundary",
]);

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function read(root, rel) {
  if (!rel) return "";
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
}

function readJson(root, rel, fallback = null) {
  const text = read(root, rel);
  return text ? JSON.parse(text) : fallback;
}

function writeJson(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, stableStringify(value));
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function commandText(script) {
  return `npm run ${script}`;
}

function packageScripts(root) {
  return readJson(root, "package.json", { scripts: {} })?.scripts ?? {};
}

function validationCommandExists(scripts, command) {
  if (typeof command !== "string" || !command.trim()) return false;
  if (scripts[command]) return true;
  if (command.startsWith("npm run ")) return Boolean(scripts[command.slice("npm run ".length)]);
  return false;
}

function validateCommands(root, config, scripts, issues) {
  const ci = read(root, ".github/workflows/ci.yml");
  const rows = [];

  for (const objective of config.objectives ?? []) {
    for (const row of objective.commands ?? []) {
      const script = row.command;
      const packageScriptPresent = Boolean(scripts[script]);
      const ciPresent = ci.includes(commandText(script));
      if (!packageScriptPresent) {
        issues.push(issue("operational_billing_missing_package_script", { objective: objective.id, script }));
      }
      if (row.ciRequired && !ciPresent) {
        issues.push(issue("operational_billing_missing_ci_command", { objective: objective.id, script }));
      }
      rows.push({
        objective: objective.id,
        script,
        ciRequired: Boolean(row.ciRequired),
        packageScriptPresent,
        ciPresent,
        covers: [...(row.covers ?? [])].sort((a, b) => a.localeCompare(b)),
      });
    }

    for (const rel of objective.artifacts ?? []) {
      if (rel !== ARTIFACT_REL && !fs.existsSync(path.join(root, rel))) {
        issues.push(issue("operational_billing_missing_objective_artifact", { objective: objective.id, path: rel }));
      }
    }
  }

  return rows.sort((a, b) => `${a.objective}:${a.script}`.localeCompare(`${b.objective}:${b.script}`));
}

export function validateMarkerRows(root, rows, requiredIds, issuePrefix, issues, scripts = packageScripts(root)) {
  const seen = new Set();
  const out = [];

  for (const row of rows ?? []) {
    const text = read(root, row.path);
    const missing = [];
    if (seen.has(row.id)) issues.push(issue(`${issuePrefix}_duplicate_id`, { id: row.id }));
    seen.add(row.id);
    if (typeof row.owner !== "string" || !row.owner.startsWith("@")) {
      issues.push(issue(`${issuePrefix}_missing_owner`, { id: row.id, owner: row.owner ?? null }));
    }
    if (!validationCommandExists(scripts, row.validationCommand)) {
      issues.push(issue(`${issuePrefix}_missing_validation_command`, {
        id: row.id,
        validationCommand: row.validationCommand ?? null,
      }));
    }
    if (!text) {
      missing.push(...(row.markers ?? []));
      issues.push(issue(`${issuePrefix}_missing_file`, { id: row.id, path: row.path }));
    } else {
      for (const marker of row.markers ?? []) {
        if (!text.includes(marker)) {
          missing.push(marker);
          issues.push(issue(`${issuePrefix}_missing_marker`, { id: row.id, path: row.path, marker }));
        }
      }
    }
    out.push({
      id: row.id,
      path: row.path,
      owner: row.owner ?? null,
      validationCommand: row.validationCommand ?? null,
      markerCount: row.markers?.length ?? 0,
      missingCount: missing.length,
      ok: missing.length === 0,
    });
  }

  for (const id of requiredIds) {
    if (!seen.has(id)) issues.push(issue(`${issuePrefix}_missing_required_id`, { id }));
  }

  return out.sort((a, b) => a.id.localeCompare(b.id));
}

function countConstStringArrayEntries(text, constName) {
  const start = text.indexOf(`export const ${constName} = [`);
  if (start < 0) return 0;
  const end = text.indexOf("] as const", start);
  if (end < 0) return 0;
  return [...text.slice(start, end).matchAll(/"([^"]+)"/g)].length;
}

function countObjectArrayIds(text, constName) {
  const start = text.indexOf(`export const ${constName}:`);
  if (start < 0) return 0;
  const end = text.indexOf("] as const", start);
  if (end < 0) return 0;
  return [...text.slice(start, end).matchAll(/\bid:\s*"([^"]+)"/g)].length;
}

function analyzeIdempotencyPolicyInline(root) {
  const idempotency = read(root, "src/lib/idempotency.ts");
  const checkout = read(root, "src/app/api/stripe/checkout/route.ts");
  const portal = read(root, "src/app/api/stripe/portal/route.ts");
  const webhook = read(root, "src/app/api/stripe/webhook/route.ts");
  const issues = [];

  if (!idempotency.includes("x-idempotency-key") || !idempotency.includes("Duplicate request blocked by idempotency key")) {
    issues.push(issue("idempotency_helper_missing_header_contract"));
  }
  if (!checkout.includes("enforceIdempotency") || !checkout.includes("scope: \"stripe.checkout\"")) {
    issues.push(issue("stripe_checkout_missing_idempotency"));
  }
  if (!portal.includes("enforceIdempotency") || !portal.includes("scope: \"stripe.portal\"")) {
    issues.push(issue("stripe_portal_missing_idempotency"));
  }
  if (!webhook.includes("stripe_webhook_events") || !webhook.includes("duplicate: true")) {
    issues.push(issue("stripe_webhook_missing_replay_guard"));
  }

  return { checkId: "idempotency-policy-inline", ok: issues.length === 0, issueCount: issues.length, issues };
}

function analyzeDelegatedChecks(root, issues) {
  const releaseEnv = analyzeReleaseSecurityRequiredEnv({ root, env: {}, strict: false });
  const providerFixtures = analyzeProviderIntegrationFixtures(root);
  const auditEvents = analyzeAuditEventCoverage(root);
  const idempotency = analyzeIdempotencyPolicyInline(root);
  const checks = [
    releaseEnv,
    providerFixtures,
    auditEvents,
    idempotency,
  ];

  for (const report of checks) {
    if (!report.ok) {
      issues.push(issue("operational_billing_delegated_check_failed", {
        checkId: report.checkId,
        issueCount: report.issueCount,
      }));
    }
  }

  return {
    rows: checks.map((report) => ({
      checkId: report.checkId,
      ok: report.ok,
      issueCount: report.issueCount,
    })),
  };
}

function analyzeRuntimeInventory(root, issues) {
  const text = read(root, "src/lib/billing/operational-entitlements.ts");
  const gateCount = countConstStringArrayEntries(text, "OPERATIONAL_COMMERCIAL_GATE_IDS");
  const planCount = countConstStringArrayEntries(text, "OPERATIONAL_COMMERCIAL_PLAN_IDS");
  const stateCount = countConstStringArrayEntries(text, "OPERATIONAL_BILLING_STATE_IDS");
  const seatMutationCount = countConstStringArrayEntries(text, "OPERATIONAL_SEAT_MUTATION_IDS");
  const revenueSafeguardIdCount = countConstStringArrayEntries(text, "OPERATIONAL_REVENUE_IMPACT_SAFEGUARD_IDS");
  const featurePolicyCount = countObjectArrayIds(text, "OPERATIONAL_COMMERCIAL_FEATURE_POLICIES");
  const revenueSafeguardCount = countObjectArrayIds(text, "OPERATIONAL_REVENUE_IMPACT_SAFEGUARDS");

  if (gateCount < REQUIRED_ENTITLEMENT_GATES.size) issues.push(issue("operational_billing_gate_inventory_too_small", { gateCount }));
  if (planCount < 6) issues.push(issue("operational_billing_plan_inventory_too_small", { planCount }));
  if (stateCount < REQUIRED_BILLING_STATES.size) issues.push(issue("operational_billing_state_inventory_too_small", { stateCount }));
  if (seatMutationCount < REQUIRED_SEAT_INVITE_LIMITS.size) issues.push(issue("operational_billing_seat_inventory_too_small", { seatMutationCount }));
  if (revenueSafeguardIdCount < REQUIRED_REVENUE_SAFEGUARDS.size) issues.push(issue("operational_billing_revenue_safeguard_id_inventory_too_small", { revenueSafeguardIdCount }));
  if (featurePolicyCount < 8) issues.push(issue("operational_billing_feature_policy_inventory_too_small", { featurePolicyCount }));
  if (revenueSafeguardCount < REQUIRED_REVENUE_SAFEGUARDS.size) issues.push(issue("operational_billing_revenue_safeguard_inventory_too_small", { revenueSafeguardCount }));

  return {
    gateCount,
    planCount,
    stateCount,
    seatMutationCount,
    revenueSafeguardIdCount,
    featurePolicyCount,
    revenueSafeguardCount,
  };
}

export function buildOperationalBillingEntitlementsReport(root = ROOT) {
  const config = readJson(root, CONFIG_REL, {});
  const issues = [];
  const scripts = packageScripts(root);

  const commandCoverage = validateCommands(root, config, scripts, issues);
  const entitlementGates = validateMarkerRows(
    root,
    config.entitlementGates,
    REQUIRED_ENTITLEMENT_GATES,
    "operational_billing_entitlement_gate",
    issues,
    scripts
  );
  const billingStateTransitions = validateMarkerRows(
    root,
    config.billingStateTransitions,
    REQUIRED_BILLING_STATES,
    "operational_billing_state_transition",
    issues,
    scripts
  );
  const seatInviteLimits = validateMarkerRows(
    root,
    config.seatInviteLimits,
    REQUIRED_SEAT_INVITE_LIMITS,
    "operational_billing_seat_invite",
    issues,
    scripts
  );
  const revenueImpactSafeguards = validateMarkerRows(
    root,
    config.revenueImpactSafeguards,
    REQUIRED_REVENUE_SAFEGUARDS,
    "operational_billing_revenue_safeguard",
    issues,
    scripts
  );
  const delegatedChecks = analyzeDelegatedChecks(root, issues);
  const runtimeInventory = analyzeRuntimeInventory(root, issues);

  return {
    ok: issues.length === 0,
    schemaVersion: 1,
    source: "code-owned-operational-billing-entitlements",
    generatedFrom: CONFIG_REL,
    commandCoverage,
    runtimeInventory,
    delegatedChecks: delegatedChecks.rows,
    entitlementGates,
    billingStateTransitions,
    seatInviteLimits,
    revenueImpactSafeguards,
    manualBoundary: config.manualBoundary ?? null,
    issueCount: issues.length,
    issues,
  };
}

function main() {
  const report = buildOperationalBillingEntitlementsReport(ROOT);
  if (WRITE) {
    writeJson(ROOT, ARTIFACT_REL, {
      ...report,
      artifact: ARTIFACT_REL,
      generatedBy: "scripts/check-operational-billing-entitlements.mjs --write",
    });
  } else {
    const expected = readJson(ROOT, ARTIFACT_REL, null);
    if (!expected) {
      report.issues.push(issue("operational_billing_entitlements_missing_artifact", { path: ARTIFACT_REL }));
      report.issueCount = report.issues.length;
      report.ok = false;
    } else {
      const current = {
        ...report,
        artifact: ARTIFACT_REL,
        generatedBy: "scripts/check-operational-billing-entitlements.mjs --write",
      };
      if (stableStringify(current) !== stableStringify(expected)) {
        report.issues.push(issue("operational_billing_entitlements_artifact_drift", { path: ARTIFACT_REL }));
        report.issueCount = report.issues.length;
        report.ok = false;
      }
    }
  }

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
