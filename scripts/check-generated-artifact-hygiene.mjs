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
  "artifacts/sbom-diff-report.json",
  "artifacts/reproducible-build-report.json",
];

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

export function analyzeGeneratedArtifactHygiene(root = process.cwd(), options = {}) {
  const artifactPaths = options.artifactPaths ?? GENERATED_ARTIFACT_HYGIENE_PATHS;
  const issues = [];

  for (const rel of artifactPaths) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) {
      issues.push({ issue: "missing_generated_artifact", path: rel });
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(abs, "utf8"));
    } catch (error) {
      issues.push({ issue: "invalid_generated_artifact_json", path: rel, message: error.message });
      continue;
    }

    scanValue(parsed, issues, { path: rel, pointer: "" });
  }

  return issueReport("generated-artifact-hygiene", issues, { artifactCount: artifactPaths.length });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeGeneratedArtifactHygiene();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
