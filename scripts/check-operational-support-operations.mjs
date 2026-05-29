#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { analyzeRoleCapabilityInventory } from "./check-role-capability-inventory.mjs";
import { analyzeSensitiveActionStepUp } from "./check-sensitive-action-step-up.mjs";
import { analyzeServerLibAdminUsage } from "./check-server-lib-admin.mjs";

const ROOT = process.cwd();
const CONFIG_REL = "config/operational-support-operations.json";
const ARTIFACT_REL = "artifacts/operational-support-operations.json";
const WRITE = process.argv.includes("--write");

const REQUIRED_CAPABILITY_FIELDS = [
  "id",
  "capabilityName",
  "routeOrAction",
  "requiredRole",
  "stepUpRequirement",
  "auditEvent",
  "tenantBoundary",
  "readWriteClass",
  "supportSafeAlternative",
  "validationCommand",
  "evidenceRefs",
];

const REQUIRED_CAPABILITIES = [
  "step-up-password-confirmation",
  "session-revoke-others",
  "organization-mfa-policy",
  "integration-token-management",
  "maintenance-campaign-run",
  "maintenance-campaign-rollback",
  "account-deletion-request",
  "internal-health-diagnostics",
  "demo-workspace-seed",
];

const REQUIRED_BREAK_GLASS_CONTROLS = [
  "disabled-by-default",
  "explicit-enable",
  "reason-capture",
  "expiry-required",
  "audit-event-required",
  "step-up-required",
  "customer-impact-warning",
];

const REQUIRED_DEMO_SEED_CONTROLS = [
  "env-flag-required",
  "admin-role-required",
  "organization-scope-required",
  "production-refusal",
  "audit-event-required",
  "fixture-data-only",
  "local-seed-secret-scan",
  "fixture-pii-policy",
];

const REQUIRED_REDACTION_FIELDS = [
  "contract-text",
  "uploaded-file-name",
  "email-address",
  "token",
  "org-id",
  "user-id",
  "provider-id",
  "billing-id",
  "cookie",
  "authorization-header",
];

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function readText(rel) {
  return fs.existsSync(path.join(ROOT, rel)) ? fs.readFileSync(path.join(ROOT, rel), "utf8") : "";
}

function readJson(rel, fallback = null) {
  const text = readText(rel);
  return text ? JSON.parse(text) : fallback;
}

function writeJson(rel, value) {
  const abs = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, stableStringify(value));
}

function fileExists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function packageScripts() {
  return readJson("package.json", { scripts: {} })?.scripts ?? {};
}

function requirePackageScript(scripts, command, issues, fields = {}) {
  if (typeof command !== "string" || !command.trim()) {
    issues.push(issue("operational_support_missing_validation_command", fields));
    return;
  }
  if (!scripts[command]) {
    issues.push(issue("operational_support_unknown_validation_command", { ...fields, command }));
  }
}

function requireString(row, key, issues, fields = {}) {
  if (typeof row?.[key] !== "string" || !row[key].trim()) {
    issues.push(issue("operational_support_missing_required_field", { ...fields, key }));
  }
}

function requireCoverage(values, required, code, issues, field = "id") {
  const actual = new Set(Array.isArray(values) ? values : []);
  for (const value of required) {
    if (!actual.has(value)) issues.push(issue(code, { [field]: value }));
  }
}

function validateConfig(config, scripts) {
  const issues = [];
  if (config?.schemaVersion !== 1 || config?.source !== "code-owned-operational-support-operations") {
    issues.push(issue("operational_support_invalid_config_metadata"));
  }
  if (config?.generatedArtifact !== ARTIFACT_REL) {
    issues.push(issue("operational_support_unexpected_generated_artifact", { generatedArtifact: config?.generatedArtifact ?? null }));
  }
  for (const rel of config?.sourceFiles ?? []) {
    if (!fileExists(rel)) issues.push(issue("operational_support_source_file_missing", { path: rel }));
  }
  for (const command of config?.requiredValidationCommands ?? []) {
    requirePackageScript(scripts, command, issues, { source: "requiredValidationCommands" });
  }

  const capabilityIds = new Set((config?.supportCapabilities ?? []).map((row) => row.id));
  for (const id of REQUIRED_CAPABILITIES) {
    if (!capabilityIds.has(id)) issues.push(issue("operational_support_missing_capability", { id }));
  }
  for (const capability of config?.supportCapabilities ?? []) {
    for (const field of REQUIRED_CAPABILITY_FIELDS) {
      if (field === "evidenceRefs") {
        if (!Array.isArray(capability.evidenceRefs) || capability.evidenceRefs.length === 0) {
          issues.push(issue("operational_support_capability_missing_evidence_refs", { capability: capability.id ?? "(missing)" }));
        }
        continue;
      }
      requireString(capability, field, issues, { capability: capability.id ?? "(missing)" });
    }
    requirePackageScript(scripts, capability.validationCommand, issues, { capability: capability.id ?? "(missing)" });
    if (capability.routeOrAction && !fileExists(capability.routeOrAction)) {
      issues.push(issue("operational_support_capability_route_missing", { capability: capability.id ?? "(missing)", routeOrAction: capability.routeOrAction }));
    }
    for (const evidence of capability.evidenceRefs ?? []) {
      if (!fileExists(evidence)) {
        issues.push(issue("operational_support_capability_evidence_missing", { capability: capability.id ?? "(missing)", evidence }));
      }
    }
    if (capability.readWriteClass !== "read-only-diagnostic" && capability.stepUpRequirement === "not-required-read-only") {
      issues.push(issue("operational_support_mutation_without_step_up_policy", { capability: capability.id ?? "(missing)" }));
    }
    if (!capability.auditEvent || capability.auditEvent === "none") {
      issues.push(issue("operational_support_capability_missing_audit_event", { capability: capability.id ?? "(missing)" }));
    }
    if (!capability.tenantBoundary || capability.tenantBoundary === "none") {
      issues.push(issue("operational_support_capability_missing_tenant_boundary", { capability: capability.id ?? "(missing)" }));
    }
  }

  for (const surface of config?.supportDiagnosticSurfaces ?? []) {
    for (const field of ["id", "path", "requiredRole", "tenantBoundary", "validationCommand"]) {
      requireString(surface, field, issues, { surface: surface.id ?? "(missing)" });
    }
    if (surface.path && !fileExists(surface.path)) {
      issues.push(issue("operational_support_diagnostic_surface_missing", { surface: surface.id ?? "(missing)", path: surface.path }));
    }
    requirePackageScript(scripts, surface.validationCommand, issues, { surface: surface.id ?? "(missing)" });
  }

  requireCoverage(config?.breakGlassControls, REQUIRED_BREAK_GLASS_CONTROLS, "operational_support_missing_break_glass_control", issues, "control");
  requireCoverage(config?.demoSeedControls, REQUIRED_DEMO_SEED_CONTROLS, "operational_support_missing_demo_seed_control", issues, "control");
  requireCoverage(config?.redactionFields, REQUIRED_REDACTION_FIELDS, "operational_support_missing_redaction_field", issues, "field");

  const supportSource = readText("src/lib/operational-support-operations.ts");
  for (const marker of [
    "redactSupportBundle",
    "evaluateBreakGlassRequest",
    "evaluateDemoSeedRequest",
    "isProductionLikeEnvironment",
    "authorization-header",
    "uploaded-file-name",
  ]) {
    if (!supportSource.includes(marker)) issues.push(issue("operational_support_source_marker_missing", { marker }));
  }

  const demoSource = readText("src/actions/demo.ts");
  if (!demoSource.includes("ENABLE_DEMO_SEED")) issues.push(issue("operational_support_demo_seed_missing_env_gate"));
  if (!demoSource.includes("VERCEL_ENV") || !demoSource.includes("production")) {
    issues.push(issue("operational_support_demo_seed_missing_production_refusal"));
  }
  if (!demoSource.includes('ctx.role !== "admin"')) issues.push(issue("operational_support_demo_seed_missing_admin_gate"));
  if (!demoSource.includes("audit_events")) issues.push(issue("operational_support_demo_seed_missing_audit_event"));

  const testSource = readText("src/lib/operational-support-operations.test.ts") + "\n" + readText("src/actions/demo-action-scope.test.ts");
  for (const marker of [
    "refuses demo seed in production-like environments",
    "redacts tokens, emails",
    "keeps break-glass disabled",
    "denies support mutations without role",
  ]) {
    if (!testSource.includes(marker)) issues.push(issue("operational_support_test_marker_missing", { marker }));
  }

  return issues;
}

function summarizeDelegated(report) {
  return {
    ok: Boolean(report.ok),
    issueCount: Number(report.issueCount ?? report.violationCount ?? 0),
    checkId: report.checkId ?? "unknown",
  };
}

export function buildOperationalSupportOperationsReport() {
  const config = readJson(CONFIG_REL, {});
  const scripts = packageScripts();
  const issues = validateConfig(config, scripts);
  const delegated = {
    sensitiveActionStepUp: summarizeDelegated(analyzeSensitiveActionStepUp(ROOT)),
    serverLibAdmin: summarizeDelegated(analyzeServerLibAdminUsage(ROOT)),
    roleCapabilityInventory: summarizeDelegated(analyzeRoleCapabilityInventory(ROOT)),
  };
  for (const [key, report] of Object.entries(delegated)) {
    if (!report.ok) issues.push(issue("operational_support_delegated_check_failed", { key, issueCount: report.issueCount }));
  }

  return {
    schemaVersion: 1,
    source: "code-owned-operational-support-operations",
    generatedArtifact: ARTIFACT_REL,
    ok: issues.length === 0,
    summary: {
      supportCapabilityCount: config.supportCapabilities?.length ?? 0,
      diagnosticSurfaceCount: config.supportDiagnosticSurfaces?.length ?? 0,
      breakGlassControlCount: config.breakGlassControls?.length ?? 0,
      demoSeedControlCount: config.demoSeedControls?.length ?? 0,
      redactionFieldCount: config.redactionFields?.length ?? 0,
    },
    requiredValidationCommands: config.requiredValidationCommands ?? [],
    supportCapabilities: config.supportCapabilities ?? [],
    supportDiagnosticSurfaces: config.supportDiagnosticSurfaces ?? [],
    breakGlassControls: config.breakGlassControls ?? [],
    demoSeedControls: config.demoSeedControls ?? [],
    redactionFields: config.redactionFields ?? [],
    delegatedChecks: delegated,
    manualBoundary: {
      objectiveId: "oph-028-admin-support",
      boundary: "break-glass use remains manual and audited",
      readinessCommand: "check:operational-support-operations",
    },
    issueCount: issues.length,
    issues,
  };
}

const report = buildOperationalSupportOperationsReport();

if (WRITE) {
  writeJson(ARTIFACT_REL, report);
} else {
  const existing = readJson(ARTIFACT_REL, null);
  if (!existing) {
    report.issues.push(issue("operational_support_artifact_missing", { artifact: ARTIFACT_REL }));
    report.issueCount = report.issues.length;
    report.ok = false;
  } else if (stableStringify(existing) !== stableStringify(report)) {
    report.issues.push(issue("operational_support_artifact_drift", { artifact: ARTIFACT_REL, writeCommand: "npm run write:operational-support-operations" }));
    report.issueCount = report.issues.length;
    report.ok = false;
  }
}

console.log(stableStringify(report));

if (!report.ok) {
  process.exitCode = 1;
}
