#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const CONFIG_REL = "config/operational-feature-flags-rollout.json";
const ARTIFACT_REL = "artifacts/operational-feature-flags-rollout.json";
const WRITE = process.argv.includes("--write");

const RUNTIME_EVIDENCE = {
  "extraction-disablement": [
    { file: "src/app/api/extract/route.ts", markers: ["isKillExtraction", "killSwitchJsonResponse"] },
  ],
  "outbound-email-disablement": [
    { file: "src/lib/email.ts", markers: ["isKillOutboundEmail"] },
  ],
  "webhook-dispatch-pause": [
    { file: "src/app/api/webhooks/dispatch/route.ts", markers: ["isKillWebhookDispatch", "killSwitchJsonResponse"] },
  ],
  "cron-family-pause": [
    { file: "src/lib/cron/route-runner.ts", markers: ["isKillCronFamily", "killSwitchJsonResponse"] },
  ],
  "billing-mutation-freeze": [
    { file: "src/app/api/stripe/checkout/route.ts", markers: ["isKillBilling", "killSwitchJsonResponse"] },
  ],
  "import-export-disablement": [
    { file: "src/app/api/import/contracts/route.ts", markers: ["isKillImportExport", "killSwitchJsonResponse"] },
    { file: "src/app/api/export/contracts/route.ts", markers: ["isKillImportExport", "killSwitchJsonResponse"] },
    { file: "src/app/api/export/reports/route.ts", markers: ["isKillImportExport", "killSwitchJsonResponse"] },
  ],
  "integration-sync-pause": [
    { file: "src/app/api/integrations/refresh-tokens/route.ts", markers: ["isKillIntegrationSync", "killSwitchJsonResponse"] },
    { file: "src/app/api/integrations/crm/sync/route.ts", markers: ["isKillIntegrationSync", "killSwitchJsonResponse"] },
    { file: "src/app/api/integrations/calendar/sync/route.ts", markers: ["isKillIntegrationSync", "killSwitchJsonResponse"] },
  ],
};

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function readText(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function readJson(rel) {
  return JSON.parse(readText(rel));
}

function fileExists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function parseFeatureFlagAliases(source) {
  const start = source.indexOf("export const FEATURE_FLAG_ENV_ALIASES");
  const end = source.indexOf("export const TRUE_FLAG_VALUES");
  if (start === -1 || end === -1 || end <= start) return [];
  const block = source.slice(start, end);
  return [...block.matchAll(/^\s{2}([A-Za-z0-9]+):\s*\{\s*neutral:\s*"([^"]+)",\s*legacy:\s*"([^"]+)"/gms)]
    .map((match) => ({
      key: match[1],
      envName: match[2],
      legacyAlias: match[3],
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function parseMetadataKeys(source) {
  const start = source.indexOf("const FEATURE_FLAG_METADATA");
  const end = source.indexOf("export const OPERATIONAL_FEATURE_FLAG_CONTRACTS");
  if (start === -1 || end === -1 || end <= start) return [];
  const block = source.slice(start, end);
  return [...block.matchAll(/^\s{2}([A-Za-z0-9]+):\s*\{/gm)]
    .map((match) => match[1])
    .sort((a, b) => a.localeCompare(b));
}

function parseSourceIds(source, marker) {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...source.matchAll(new RegExp(`${escaped}:\\s*"([^"]+)"`, "g"))]
    .map((match) => match[1])
    .sort((a, b) => a.localeCompare(b));
}

function packageScripts() {
  return readJson("package.json").scripts ?? {};
}

function validateFeatureFlagInventory({ config, featureSource, contractSource }) {
  const issues = [];
  const aliases = parseFeatureFlagAliases(featureSource);
  const metadataKeys = parseMetadataKeys(contractSource);
  const sourceKeys = aliases.map((entry) => entry.key).sort((a, b) => a.localeCompare(b));

  if (aliases.length !== config.expectedFeatureFlagCount) {
    issues.push(issue("operational_feature_flag_count_mismatch", {
      expected: config.expectedFeatureFlagCount,
      actual: aliases.length,
    }));
  }
  if (new Set(sourceKeys).size !== sourceKeys.length) {
    issues.push(issue("operational_feature_flag_duplicate_keys"));
  }
  if (JSON.stringify(sourceKeys) !== JSON.stringify(metadataKeys)) {
    issues.push(issue("operational_feature_flag_metadata_key_mismatch", {
      missingMetadata: sourceKeys.filter((key) => !metadataKeys.includes(key)),
      extraMetadata: metadataKeys.filter((key) => !sourceKeys.includes(key)),
    }));
  }

  for (const entry of aliases) {
    if (!/^ENABLE_[A-Z0-9_]+$/.test(entry.envName)) {
      issues.push(issue("operational_feature_flag_invalid_env_name", { key: entry.key, envName: entry.envName }));
    }
    if (!/^ENABLE_[A-Z0-9_]+$/.test(entry.legacyAlias)) {
      issues.push(issue("operational_feature_flag_invalid_legacy_alias", { key: entry.key, legacyAlias: entry.legacyAlias }));
    }
    if (/_V7_|LEGACY|DEPRECATED/i.test(entry.envName)) {
      issues.push(issue("operational_feature_flag_stale_name", { key: entry.key, envName: entry.envName }));
    }
  }

  for (const required of [
    "ownerArea",
    "defaultByEnvironment",
    "expiresOn",
    "cleanupPlan",
    "removalTicket",
    "killSwitchBehavior",
    "testRefs",
  ]) {
    if (!contractSource.includes(required)) {
      issues.push(issue("operational_feature_flag_contract_missing_field", { field: required }));
    }
  }

  return { issues, aliases, metadataKeys };
}

function validateKillSwitches({ config, contractSource, killSwitchSource, envExampleSource }) {
  const issues = [];
  const contractIds = parseSourceIds(contractSource, "id");
  const required = Array.isArray(config.requiredKillSwitches) ? config.requiredKillSwitches : [];

  for (const row of required) {
    if (!contractIds.includes(row.id)) {
      issues.push(issue("operational_kill_switch_contract_missing", { id: row.id }));
    }
    for (const field of ["id", "envName", "helperName", "subsystem"]) {
      if (!row[field] || typeof row[field] !== "string") {
        issues.push(issue("operational_kill_switch_config_missing_field", { id: row.id ?? "(missing)", field }));
      }
    }
    if (!killSwitchSource.includes(`process.env.${row.envName}`)) {
      issues.push(issue("operational_kill_switch_env_not_read", { id: row.id, envName: row.envName }));
    }
    if (!killSwitchSource.includes(`function ${row.helperName}(`)) {
      issues.push(issue("operational_kill_switch_helper_missing", { id: row.id, helperName: row.helperName }));
    }
    if (!envExampleSource.includes(row.envName)) {
      issues.push(issue("operational_kill_switch_env_example_missing", { id: row.id, envName: row.envName }));
    }
    for (const testRef of row.testRefs ?? []) {
      if (!fileExists(testRef)) {
        issues.push(issue("operational_kill_switch_test_ref_missing", { id: row.id, testRef }));
      }
    }
    for (const evidence of RUNTIME_EVIDENCE[row.id] ?? []) {
      if (!fileExists(evidence.file)) {
        issues.push(issue("operational_kill_switch_runtime_evidence_file_missing", { id: row.id, file: evidence.file }));
        continue;
      }
      const source = readText(evidence.file);
      for (const marker of evidence.markers) {
        if (!source.includes(marker)) {
          issues.push(issue("operational_kill_switch_runtime_evidence_missing_marker", {
            id: row.id,
            file: evidence.file,
            marker,
          }));
        }
      }
    }
  }

  return {
    issues,
    requiredCount: required.length,
    runtimeEvidence: Object.fromEntries(
      Object.entries(RUNTIME_EVIDENCE).map(([id, evidence]) => [id, evidence.map((entry) => entry.file)])
    ),
  };
}

function validateRolloutSafety({ config, contractSource }) {
  const issues = [];
  const caseIds = parseSourceIds(contractSource, "id");
  const requiredCases = config.requiredRolloutSafetyCases ?? [];
  const requiredGuardrails = config.requiredRolloutGuardrails ?? [];

  for (const id of requiredCases) {
    if (!caseIds.includes(id)) {
      issues.push(issue("operational_rollout_safety_case_missing", { id }));
    }
  }
  for (const guardrail of requiredGuardrails) {
    if (!contractSource.includes(`"${guardrail}"`)) {
      issues.push(issue("operational_rollout_guardrail_missing", { guardrail }));
    }
  }
  for (const reason of [
    "auth_required",
    "tenant_scope_required",
    "billing_state_required",
    "workspace_mode_ineligible",
    "kill_switch_active",
    "stale_calibration",
    "outside_rollout_bucket",
    "organization_not_allowlisted",
  ]) {
    if (!contractSource.includes(reason)) {
      issues.push(issue("operational_rollout_reason_missing", { reason }));
    }
  }

  return {
    issues,
    requiredCases,
    requiredGuardrails,
  };
}

function validateScripts({ config }) {
  const issues = [];
  const scripts = packageScripts();
  for (const command of config.requiredValidationCommands ?? []) {
    if (!scripts[command]) {
      issues.push(issue("operational_feature_flags_missing_package_script", { command }));
    }
  }
  return { issues, scripts: config.requiredValidationCommands ?? [] };
}

function buildReport() {
  const config = readJson(CONFIG_REL);
  const featureSource = readText(config.featureFlagSource);
  const contractSource = readText(config.contractSource);
  const killSwitchSource = readText(config.killSwitchSource);
  const envExampleSource = readText(".env.example");
  const issues = [];

  if (config.schemaVersion !== 1 || config.source !== "code-owned-operational-feature-flags-rollout") {
    issues.push(issue("operational_feature_flags_invalid_config_metadata"));
  }
  if (config.generatedArtifact !== ARTIFACT_REL) {
    issues.push(issue("operational_feature_flags_unexpected_artifact", { artifact: config.generatedArtifact }));
  }

  const inventory = validateFeatureFlagInventory({ config, featureSource, contractSource });
  const killSwitches = validateKillSwitches({ config, contractSource, killSwitchSource, envExampleSource });
  const rolloutSafety = validateRolloutSafety({ config, contractSource });
  const scripts = validateScripts({ config });
  issues.push(...inventory.issues, ...killSwitches.issues, ...rolloutSafety.issues, ...scripts.issues);

  return {
    schemaVersion: 1,
    source: "code-owned-operational-feature-flags-rollout",
    generatedFrom: CONFIG_REL,
    featureFlagSource: config.featureFlagSource,
    contractSource: config.contractSource,
    killSwitchSource: config.killSwitchSource,
    featureFlagInventory: {
      expectedCount: config.expectedFeatureFlagCount,
      actualCount: inventory.aliases.length,
      flags: inventory.aliases,
      metadataCoverageCount: inventory.metadataKeys.length,
    },
    killSwitchCoverage: {
      requiredCount: killSwitches.requiredCount,
      requiredIds: (config.requiredKillSwitches ?? []).map((row) => row.id).sort((a, b) => a.localeCompare(b)),
      runtimeEvidence: killSwitches.runtimeEvidence,
    },
    rolloutSafety: {
      requiredCases: rolloutSafety.requiredCases,
      requiredGuardrails: rolloutSafety.requiredGuardrails,
    },
    validationCommands: scripts.scripts,
    issueCount: issues.length,
    issues,
  };
}

function main() {
  let report;
  try {
    report = buildReport();
  } catch (error) {
    console.error(stableStringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    process.exit(1);
  }

  const artifactPath = path.join(ROOT, ARTIFACT_REL);
  const serialized = stableStringify(report);
  if (WRITE) {
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, serialized);
  } else if (!fs.existsSync(artifactPath)) {
    report.issues.push(issue("operational_feature_flags_artifact_missing", { artifact: ARTIFACT_REL }));
    report.issueCount = report.issues.length;
  } else if (fs.readFileSync(artifactPath, "utf8") !== serialized) {
    report.issues.push(issue("operational_feature_flags_artifact_drift", {
      artifact: ARTIFACT_REL,
      writeCommand: "npm run write:operational-feature-flags-rollout",
    }));
    report.issueCount = report.issues.length;
  }

  if (report.issueCount > 0) {
    console.error(stableStringify({ ok: false, ...report }));
    process.exit(1);
  }

  console.log(stableStringify({ ok: true, ...report }));
}

main();
