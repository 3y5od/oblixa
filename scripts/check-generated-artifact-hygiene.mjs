#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { issueReport } from "./lib/static-check-utils.mjs";

export const GENERATED_ARTIFACT_HYGIENE_PATHS = [
  "artifacts/security-route-matrix.json",
  "artifacts/security-proxy-matrix.json",
  "artifacts/security-control-coverage-matrix.rows.json",
  "artifacts/security-report-checksums.json",
  "artifacts/operational-ci-enforcement.json",
  "artifacts/operational-cron-jobs.json",
  "artifacts/operational-webhooks-callbacks.json",
  "artifacts/operational-secrets-configuration.json",
  "artifacts/operational-authz-session.json",
  "artifacts/operational-api-runtime-contracts.json",
  "artifacts/operational-rate-limits-abuse-bounds.json",
  "artifacts/operational-observability-redaction.json",
  "artifacts/operational-browser-security.json",
  "artifacts/operational-uploads-files-extraction.json",
  "artifacts/operational-provider-integrations.json",
  "artifacts/operational-privacy-auditability.json",
  "artifacts/operational-supply-chain-risk.json",
  "artifacts/operational-frontend-resilience.json",
  "artifacts/operational-performance-load-chaos.json",
  "artifacts/operational-dr-incident-readiness.json",
  "artifacts/operational-incident-follow-up-template.json",
  "artifacts/operational-waivers-ratchets.json",
  "artifacts/operational-feature-flags-rollout.json",
  "artifacts/operational-schema-compatibility.json",
  "artifacts/operational-data-quality-invariants.json",
  "artifacts/operational-support-operations.json",
  "artifacts/operational-edge-readiness.json",
  "artifacts/operational-legal-trust-compliance.json",
  "artifacts/operational-static-architecture-code-health.json",
  "artifacts/operational-test-reliability-governance.json",
  "artifacts/operational-platform-variant-coverage.json",
  "artifacts/operational-search-reporting-analytics-exports.json",
  "artifacts/operational-notifications-messaging.json",
  "artifacts/operational-billing-entitlements.json",
  "artifacts/operational-oauth-integration-sync.json",
  "artifacts/operational-public-launch-positioning.json",
  "artifacts/operational-repository-artifact-hygiene.json",
  "artifacts/operational-threat-model-control-traceability.json",
  "artifacts/stride-dread-threat-model.json",
  "artifacts/operational-environment-isolation.json",
  "artifacts/operational-governance-ownership.json",
  "artifacts/operational-hardening-closure.json",
  "artifacts/operational-package-pipelines.json",
  "artifacts/operational-release-readiness.json",
  "artifacts/operational-supabase-database.json",
  "artifacts/assurance/dashboard.json",
  "artifacts/assurance/scripts-to-epic-map.json",
  "artifacts/assurance/catalog-script-index.json",
  "artifacts/route-universe.json",
  "artifacts/route-functionality-matrix.json",
  "artifacts/route-runtime-contract.json",
  "artifacts/route-provider-matrix.json",
  "artifacts/route-db-dependencies.json",
  "artifacts/page-route-state-matrix.json",
  "artifacts/route-external-contracts.json",
  "artifacts/dependency-review-policy.json",
  "artifacts/license-allowlist.json",
  "artifacts/supply-chain-install-script-allowlist.json",
  "artifacts/subprocessors-diff.json",
  "artifacts/sbom-diff-report.json",
  "artifacts/sbom-dual-format-evidence.json",
  "artifacts/spdx-sbom.json",
  "artifacts/reproducible-build-report.json",
  "artifacts/supabase/migration-manifest.json",
  "artifacts/supabase/local-catalog-fingerprint.json",
  "artifacts/supabase/migration-domain-index.json",
  "artifacts/supabase/data-retention-inventory.json",
  "artifacts/supabase/database-backup-restore-evidence.json",
  "artifacts/supabase/sql-object-reference-inventory.json",
  "artifacts/supabase/sql-object-rename-staging.json",
  "artifacts/supabase/sql-neutral-table-view-aliases.json",
  "artifacts/supabase/sql-policy-alias-readiness.json",
  "artifacts/supabase/sql-policy-predicate-equivalence.json",
  "supabase/sql/policy-predicate-equivalence.sql",
  "artifacts/supabase/sql-policy-forward-migration-blueprint.json",
  "supabase/sql/policy-forward-migration-blueprint.sql",
  "artifacts/supabase/sql-rename-verification-sql.json",
  "artifacts/supabase/sql-security-automation-coverage.json",
  "artifacts/supabase/migration-history-version-exceptions.json",
  "artifacts/supabase/seed-versioned-name-queue-coverage.json",
  "artifacts/compatibility/versioned-naming-safe-rename-manifest.json",
  "artifacts/compatibility/versioned-exported-symbol-inventory.json",
  "artifacts/compatibility/versioned-content-contract-inventory.json",
  "artifacts/compatibility/versioned-export-download-contracts.json",
  "artifacts/compatibility/versioned-local-content-rewrite-manifest.json",
  "artifacts/compatibility/versioned-content-surface-coverage.json",
  "artifacts/compatibility/versioned-remaining-surface-coverage.json",
  "artifacts/compatibility/versioned-detailed-objective-coverage.json",
  "artifacts/compatibility/versioned-public-runtime-dual-read.json",
  "artifacts/compatibility/versioned-forward-migration-readiness.json",
  "artifacts/compatibility/versioned-package-script-readiness.json",
  "artifacts/compatibility/neutral-naming-rules.json",
  "artifacts/compatibility/versioned-manual-surface-closure.json",
  "artifacts/compatibility/versioned-open-objective-closure.json",
  "artifacts/compatibility/versioned-local-surface-regression.json",
  "artifacts/compatibility/versioned-alias-usage-neutrality.json",
  "artifacts/compatibility/versioned-env-flag-aliases.json",
  "artifacts/compatibility/versioned-code-only-closure.json",
  "artifacts/compatibility/versioned-additive-alias-preservation.json",
  "artifacts/compatibility/versioned-remaining-local-contract-closure.json",
  "artifacts/compatibility/versioned-unchecked-objective-readiness.json",
  "artifacts/compatibility/versioned-final-checklist-reconciliation.json",
  "artifacts/compatibility/removal-queue.json",
  "scripts/versioned-naming-removal-queue.json",
];

export const DETERMINISTIC_GENERATED_ARTIFACT_PATHS = [
  "artifacts/operational-ci-enforcement.json",
  "artifacts/operational-cron-jobs.json",
  "artifacts/operational-webhooks-callbacks.json",
  "artifacts/operational-secrets-configuration.json",
  "artifacts/operational-authz-session.json",
  "artifacts/operational-api-runtime-contracts.json",
  "artifacts/operational-rate-limits-abuse-bounds.json",
  "artifacts/operational-observability-redaction.json",
  "artifacts/operational-browser-security.json",
  "artifacts/operational-uploads-files-extraction.json",
  "artifacts/operational-provider-integrations.json",
  "artifacts/operational-privacy-auditability.json",
  "artifacts/operational-supply-chain-risk.json",
  "artifacts/operational-frontend-resilience.json",
  "artifacts/operational-performance-load-chaos.json",
  "artifacts/operational-dr-incident-readiness.json",
  "artifacts/operational-incident-follow-up-template.json",
  "artifacts/operational-waivers-ratchets.json",
  "artifacts/operational-feature-flags-rollout.json",
  "artifacts/operational-schema-compatibility.json",
  "artifacts/operational-data-quality-invariants.json",
  "artifacts/operational-support-operations.json",
  "artifacts/operational-edge-readiness.json",
  "artifacts/operational-legal-trust-compliance.json",
  "artifacts/operational-static-architecture-code-health.json",
  "artifacts/operational-test-reliability-governance.json",
  "artifacts/operational-platform-variant-coverage.json",
  "artifacts/operational-search-reporting-analytics-exports.json",
  "artifacts/operational-notifications-messaging.json",
  "artifacts/operational-billing-entitlements.json",
  "artifacts/operational-oauth-integration-sync.json",
  "artifacts/operational-public-launch-positioning.json",
  "artifacts/operational-repository-artifact-hygiene.json",
  "artifacts/operational-threat-model-control-traceability.json",
  "artifacts/stride-dread-threat-model.json",
  "artifacts/operational-environment-isolation.json",
  "artifacts/operational-governance-ownership.json",
  "artifacts/operational-hardening-closure.json",
  "artifacts/operational-package-pipelines.json",
  "artifacts/operational-release-readiness.json",
  "artifacts/operational-supabase-database.json",
  "artifacts/supabase/migration-manifest.json",
  "artifacts/supabase/local-catalog-fingerprint.json",
  "artifacts/supabase/migration-domain-index.json",
  "artifacts/supabase/data-retention-inventory.json",
  "artifacts/supabase/database-backup-restore-evidence.json",
  "artifacts/supabase/sql-object-reference-inventory.json",
  "artifacts/supabase/sql-object-rename-staging.json",
  "artifacts/supabase/sql-neutral-table-view-aliases.json",
  "artifacts/supabase/sql-policy-alias-readiness.json",
  "artifacts/supabase/sql-policy-predicate-equivalence.json",
  "supabase/sql/policy-predicate-equivalence.sql",
  "artifacts/supabase/sql-policy-forward-migration-blueprint.json",
  "supabase/sql/policy-forward-migration-blueprint.sql",
  "artifacts/supabase/sql-rename-verification-sql.json",
  "artifacts/supabase/sql-security-automation-coverage.json",
  "artifacts/supabase/migration-history-version-exceptions.json",
  "artifacts/supabase/seed-versioned-name-queue-coverage.json",
  "artifacts/compatibility/versioned-naming-safe-rename-manifest.json",
  "artifacts/compatibility/versioned-exported-symbol-inventory.json",
  "artifacts/compatibility/versioned-content-contract-inventory.json",
  "artifacts/compatibility/versioned-export-download-contracts.json",
  "artifacts/compatibility/versioned-local-content-rewrite-manifest.json",
  "artifacts/compatibility/versioned-content-surface-coverage.json",
  "artifacts/compatibility/versioned-remaining-surface-coverage.json",
  "artifacts/compatibility/versioned-detailed-objective-coverage.json",
  "artifacts/compatibility/versioned-public-runtime-dual-read.json",
  "artifacts/compatibility/versioned-forward-migration-readiness.json",
  "artifacts/compatibility/versioned-package-script-readiness.json",
  "artifacts/compatibility/neutral-naming-rules.json",
  "artifacts/compatibility/versioned-manual-surface-closure.json",
  "artifacts/compatibility/versioned-open-objective-closure.json",
  "artifacts/compatibility/versioned-local-surface-regression.json",
  "artifacts/compatibility/versioned-alias-usage-neutrality.json",
  "artifacts/compatibility/versioned-env-flag-aliases.json",
  "artifacts/compatibility/versioned-code-only-closure.json",
  "artifacts/compatibility/versioned-additive-alias-preservation.json",
  "artifacts/compatibility/versioned-remaining-local-contract-closure.json",
  "artifacts/compatibility/versioned-unchecked-objective-readiness.json",
  "artifacts/compatibility/versioned-final-checklist-reconciliation.json",
  "artifacts/compatibility/removal-queue.json",
  "scripts/versioned-naming-removal-queue.json",
  "artifacts/subprocessors-diff.json",
];

export const GENERATED_ARTIFACT_WRITE_COMMANDS = {
  "artifacts/supabase/migration-manifest.json": "npm run write:migration-manifest",
  "artifacts/supabase/local-catalog-fingerprint.json": "npm run write:supabase:fingerprint-artifact",
  "artifacts/supabase/migration-domain-index.json": "npm run write:migration-organization",
  "artifacts/supabase/data-retention-inventory.json": "npm run write:supabase:retention-inventory",
  "artifacts/supabase/database-backup-restore-evidence.json": "npm run write:database-backup-restore-evidence",
  "artifacts/supabase/sql-object-reference-inventory.json": "npm run write:sql-object-reference-inventory",
  "artifacts/supabase/sql-object-rename-staging.json": "npm run write:sql-object-rename-staging",
  "artifacts/supabase/sql-neutral-table-view-aliases.json": "npm run write:sql-neutral-table-view-aliases",
  "artifacts/supabase/sql-policy-alias-readiness.json": "npm run write:sql-policy-alias-readiness",
  "artifacts/supabase/sql-policy-predicate-equivalence.json": "npm run write:sql-policy-predicate-equivalence",
  "supabase/sql/policy-predicate-equivalence.sql": "npm run write:sql-policy-predicate-equivalence",
  "artifacts/supabase/sql-policy-forward-migration-blueprint.json": "npm run write:sql-policy-forward-migration-blueprint",
  "supabase/sql/policy-forward-migration-blueprint.sql": "npm run write:sql-policy-forward-migration-blueprint",
  "artifacts/supabase/sql-rename-verification-sql.json": "npm run write:sql-rename-verification-sql",
  "artifacts/supabase/sql-security-automation-coverage.json": "npm run write:sql-security-automation-coverage",
  "artifacts/supabase/migration-history-version-exceptions.json": "npm run write:migration-history-version-exceptions",
  "artifacts/supabase/seed-versioned-name-queue-coverage.json": "npm run write:seed-versioned-name-queue-coverage",
  "artifacts/compatibility/versioned-naming-safe-rename-manifest.json": "npm run write:versioned-naming-safe-renames",
  "artifacts/compatibility/versioned-exported-symbol-inventory.json": "npm run write:versioned-exported-symbols",
  "artifacts/compatibility/versioned-content-contract-inventory.json": "npm run write:versioned-content-contracts",
  "artifacts/compatibility/versioned-export-download-contracts.json": "npm run write:versioned-export-download-contracts",
  "artifacts/compatibility/versioned-local-content-rewrite-manifest.json": "npm run write:versioned-local-content-rewrites",
  "artifacts/compatibility/versioned-content-surface-coverage.json": "npm run write:versioned-content-surface-coverage",
  "artifacts/compatibility/versioned-remaining-surface-coverage.json": "npm run write:versioned-remaining-surface-coverage",
  "artifacts/compatibility/versioned-detailed-objective-coverage.json": "npm run write:versioned-detailed-objective-coverage",
  "artifacts/compatibility/versioned-public-runtime-dual-read.json": "npm run write:versioned-public-runtime-dual-read",
  "artifacts/compatibility/versioned-forward-migration-readiness.json": "npm run write:versioned-forward-migration-readiness",
  "artifacts/compatibility/versioned-package-script-readiness.json": "npm run write:versioned-package-script-readiness",
  "artifacts/compatibility/neutral-naming-rules.json": "npm run write:neutral-naming-rules",
  "artifacts/compatibility/versioned-manual-surface-closure.json": "npm run write:versioned-manual-surface-closure",
  "artifacts/compatibility/versioned-open-objective-closure.json": "npm run write:versioned-open-objective-closure",
  "artifacts/compatibility/versioned-local-surface-regression.json": "npm run write:versioned-local-surface-regression",
  "artifacts/compatibility/versioned-alias-usage-neutrality.json": "npm run write:versioned-alias-usage-neutrality",
  "artifacts/compatibility/versioned-env-flag-aliases.json": "npm run write:versioned-env-flag-aliases",
  "artifacts/compatibility/versioned-code-only-closure.json": "npm run write:versioned-code-only-closure",
  "artifacts/compatibility/versioned-additive-alias-preservation.json": "npm run write:versioned-additive-alias-preservation",
  "artifacts/compatibility/versioned-remaining-local-contract-closure.json": "npm run write:versioned-remaining-local-contract-closure",
  "artifacts/compatibility/versioned-unchecked-objective-readiness.json": "npm run write:versioned-unchecked-objective-readiness",
  "artifacts/compatibility/versioned-final-checklist-reconciliation.json": "npm run write:versioned-final-checklist-reconciliation",
  "artifacts/compatibility/removal-queue.json": "npm run write:compatibility-removal-queue",
  "scripts/versioned-naming-removal-queue.json": "npm run write:versioned-naming-removal-queue",
  "artifacts/operational-ci-enforcement.json": "npm run write:operational-ci-enforcement",
  "artifacts/operational-cron-jobs.json": "npm run write:operational-cron-jobs",
  "artifacts/operational-webhooks-callbacks.json": "npm run write:operational-webhooks-callbacks",
  "artifacts/operational-secrets-configuration.json": "npm run write:operational-secrets-configuration",
  "artifacts/operational-authz-session.json": "npm run write:operational-authz-session",
  "artifacts/operational-api-runtime-contracts.json": "npm run write:operational-api-runtime-contracts",
  "artifacts/operational-rate-limits-abuse-bounds.json": "npm run write:operational-rate-limits-abuse-bounds",
  "artifacts/operational-observability-redaction.json": "npm run write:operational-observability-redaction",
  "artifacts/operational-browser-security.json": "npm run write:operational-browser-security",
  "artifacts/operational-uploads-files-extraction.json": "npm run write:operational-uploads-files-extraction",
  "artifacts/operational-provider-integrations.json": "npm run write:operational-provider-integrations",
  "artifacts/operational-privacy-auditability.json": "npm run write:operational-privacy-auditability",
  "artifacts/operational-supply-chain-risk.json": "npm run write:operational-supply-chain-risk",
  "artifacts/operational-frontend-resilience.json": "npm run write:operational-frontend-resilience",
  "artifacts/operational-performance-load-chaos.json": "npm run write:operational-performance-load-chaos",
  "artifacts/operational-dr-incident-readiness.json": "npm run write:incident-readiness",
  "artifacts/operational-incident-follow-up-template.json": "npm run write:incident-readiness",
  "artifacts/operational-waivers-ratchets.json": "npm run write:operational-waivers-ratchets",
  "artifacts/operational-feature-flags-rollout.json": "npm run write:operational-feature-flags-rollout",
  "artifacts/operational-schema-compatibility.json": "npm run write:operational-schema-compatibility",
  "artifacts/operational-data-quality-invariants.json": "npm run write:operational-data-quality-invariants",
  "artifacts/operational-support-operations.json": "npm run write:operational-support-operations",
  "artifacts/operational-edge-readiness.json": "npm run write:operational-edge-readiness",
  "artifacts/operational-legal-trust-compliance.json": "npm run write:operational-legal-trust-compliance",
  "artifacts/operational-static-architecture-code-health.json": "npm run write:operational-static-architecture-code-health",
  "artifacts/operational-test-reliability-governance.json": "npm run write:operational-test-reliability-governance",
  "artifacts/operational-platform-variant-coverage.json": "npm run write:operational-platform-variant-coverage",
  "artifacts/operational-search-reporting-analytics-exports.json": "npm run write:operational-search-reporting-analytics-exports",
  "artifacts/operational-notifications-messaging.json": "npm run write:operational-notifications-messaging",
  "artifacts/operational-billing-entitlements.json": "npm run write:operational-billing-entitlements",
  "artifacts/operational-oauth-integration-sync.json": "npm run write:operational-oauth-integration-sync",
  "artifacts/operational-public-launch-positioning.json": "npm run write:operational-public-launch-positioning",
  "artifacts/operational-repository-artifact-hygiene.json": "npm run write:operational-repository-artifact-hygiene",
  "artifacts/operational-threat-model-control-traceability.json": "npm run write:control-traceability",
  "artifacts/stride-dread-threat-model.json": "npm run write:control-traceability",
  "artifacts/operational-environment-isolation.json": "npm run write:operational-environment-isolation",
  "artifacts/operational-governance-ownership.json": "npm run write:operational-governance-ownership",
  "artifacts/subprocessors-diff.json": "npm run write:subprocessors-drift",
  "artifacts/sbom-dual-format-evidence.json": "npm run write:sbom-dual-format-evidence",
  "artifacts/spdx-sbom.json": "npm run write:sbom-dual-format-evidence",
  "artifacts/operational-hardening-closure.json": "npm run write:operational-hardening-objectives",
  "artifacts/operational-package-pipelines.json": "npm run write:operational-package-pipelines",
  "artifacts/operational-release-readiness.json": "npm run write:operational-release-readiness",
  "artifacts/operational-supabase-database.json": "npm run write:operational-supabase-database",
};

const SENSITIVE_KEY_PATTERNS = [
  {
    issue: "generated_artifact_secret_key",
    pattern:
      /^(?:api[_-]?key|access[_-]?token|refresh[_-]?token|service[_-]?role[_-]?key|secret|password|authorization|cookie|set-cookie|private[_-]?key)$/i,
  },
  {
    issue: "generated_artifact_raw_content_key",
    pattern:
      /^(?:raw|rawBody|raw_body|requestBody|request_body|responseBody|response_body|rawUpload|rawUploadedContent|uploadedContent|uploadedFile|fileContent|documentText|rawText|rawHtml|rawMarkdown|rawCsv|rawXml|bodyBytes)$/i,
  },
  {
    issue: "generated_artifact_provider_payload_key",
    pattern:
      /^(?:providerPayload|rawProviderPayload|stripeEvent|stripePayload|slackPayload|openaiResponse|resendResponse|sendgridResponse|webhookPayload|providerResponse)$/i,
  },
];

const SENSITIVE_VALUE_PATTERNS = [
  { issue: "generated_artifact_private_key_block", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |)?PRIVATE KEY-----/ },
  { issue: "generated_artifact_aws_access_key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { issue: "generated_artifact_github_token", pattern: /\b(?:gh[pousr]_[A-Za-z0-9_]{36,}|github_pat_[A-Za-z0-9_]{80,})\b/ },
  { issue: "generated_artifact_openai_key", pattern: /\b(?:sk-proj-[A-Za-z0-9_-]{48,}|sk-[A-Za-z0-9]{48,})\b/ },
  { issue: "generated_artifact_stripe_secret_key", pattern: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/ },
  { issue: "generated_artifact_stripe_webhook_secret", pattern: /\bwhsec_[A-Za-z0-9]{16,}\b/ },
  { issue: "generated_artifact_slack_token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
  { issue: "generated_artifact_jwt_value", pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/ },
  { issue: "generated_artifact_url_embeds_credentials", pattern: /\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^@\s]+@/i },
  { issue: "generated_artifact_email_address", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
  { issue: "generated_artifact_ssn_value", pattern: /\b\d{3}-\d{2}-\d{4}\b/ },
  { issue: "generated_artifact_long_base64_blob", pattern: /\b[A-Za-z0-9+/]{360,}={0,2}\b/ },
];

function pointerFor(parent, key) {
  return `${parent}/${String(key).replace(/~/g, "~0").replace(/\//g, "~1")}`;
}

function redactEvidence(value) {
  const text = String(value);
  if (text.length <= 16) return "[redacted]";
  return `${text.slice(0, 8)}[redacted]${text.slice(-4)}`;
}

function scanValue(value, issues, context) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanValue(entry, issues, { ...context, pointer: pointerFor(context.pointer, index) }));
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      const childPointer = pointerFor(context.pointer, key);
      for (const { issue, pattern } of SENSITIVE_KEY_PATTERNS) {
        if (pattern.test(key) && child != null && child !== "") {
          issues.push({ issue, path: context.path, pointer: childPointer, key });
        }
      }
      scanValue(child, issues, { ...context, pointer: childPointer });
    }
    return;
  }

  if (typeof value !== "string") return;
  for (const { issue, pattern } of SENSITIVE_VALUE_PATTERNS) {
    if (pattern.test(value)) {
      issues.push({
        issue,
        path: context.path,
        pointer: context.pointer,
        evidence: redactEvidence(value),
      });
    }
  }
}

function scanDeterministicValue(value, issues, context) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanDeterministicValue(entry, issues, { ...context, pointer: pointerFor(context.pointer, index) }));
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      const childPointer = pointerFor(context.pointer, key);
      if (/^(?:generatedAt|createdAt|updatedAt|timestamp)$/u.test(key)) {
        issues.push({ issue: "deterministic_artifact_timestamp_key", path: context.path, pointer: childPointer, key });
      }
      scanDeterministicValue(child, issues, { ...context, pointer: childPointer });
    }
    return;
  }

  if (typeof value !== "string") return;
  if (/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/u.test(value)) {
    issues.push({ issue: "deterministic_artifact_timestamp_value", path: context.path, pointer: context.pointer });
  }
}

export function analyzeGeneratedArtifactHygiene(root = process.cwd(), options = {}) {
  const artifactPaths = options.artifactPaths ?? GENERATED_ARTIFACT_HYGIENE_PATHS;
  const deterministicArtifactPaths = new Set(options.deterministicArtifactPaths ?? DETERMINISTIC_GENERATED_ARTIFACT_PATHS);
  const writeCommands = options.writeCommands ?? GENERATED_ARTIFACT_WRITE_COMMANDS;
  const issues = [];
  const artifactMetadata = [];

  for (const rel of artifactPaths) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) {
      issues.push({ issue: "missing_generated_artifact", path: rel });
      continue;
    }

    const content = fs.readFileSync(abs, "utf8");
    let parsed = content;
    if (rel.endsWith(".json")) {
      try {
        parsed = JSON.parse(content);
      } catch (error) {
        issues.push({ issue: "invalid_generated_artifact_json", path: rel, message: error.message });
        continue;
      }
    }

    scanValue(parsed, issues, { path: rel, pointer: "" });
    if (deterministicArtifactPaths.has(rel)) {
      scanDeterministicValue(parsed, issues, { path: rel, pointer: "" });
      if (typeof writeCommands[rel] !== "string" || writeCommands[rel].trim() === "") {
        issues.push({ issue: "deterministic_artifact_missing_write_command", path: rel });
      }
    }
    artifactMetadata.push({
      path: rel,
      deterministic: deterministicArtifactPaths.has(rel),
      writeCommand: writeCommands[rel] ?? null,
      safeToRegenerate: Boolean(writeCommands[rel]),
    });
  }

  return issueReport("generated-artifact-hygiene", issues, {
    artifactCount: artifactPaths.length,
    deterministicArtifactCount: artifactMetadata.filter((entry) => entry.deterministic).length,
    safeToRegenerateCount: artifactMetadata.filter((entry) => entry.safeToRegenerate).length,
    artifactMetadata,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeGeneratedArtifactHygiene();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
