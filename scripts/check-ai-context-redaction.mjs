#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:ai-context-redaction"];
const REQUIRED_CI_COMMANDS = ["npm run check:ai-context-redaction"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:ai-context-redaction"'];

const REQUIRED_MARKERS = {
  "src/lib/extraction/model-context-redaction.ts": [
    "redactModelBoundContractText",
    "prepareModelBoundContractText",
    "MODEL_CONTEXT_REDACTION_REPLACEMENT",
    "AUTH_HEADER_LINE_RE",
    "SIGNED_MODEL_CONTEXT_URL_PARAM_RE",
    "PROVIDER_TOKEN_RE",
    "SENSITIVE_MODEL_CONTEXT_ASSIGNMENT_RE",
    "UNRELATED_ORG_IDENTIFIER_RE",
    "X-Goog-Signature",
    "GoogleAccessId",
    "AWSAccessKeyId",
    "sk-proj-",
    "gh[pousr]_",
  ],
  "src/lib/extraction/model-context-redaction.test.ts": [
    "redacts provider tokens, cookies, private URLs, and unrelated org ids",
    "constructs prompts without sensitive fields present",
    "normalizes and redacts before chunking model-bound text",
    "OPENAI_API_KEY=sk-proj-",
    "github_token=gho_",
    "X-Goog-Signature",
  ],
  "src/lib/extraction/extract-fields.ts": [
    "redactModelBoundContractText(contractText)",
    "prepareModelBoundContractText(text)",
    "slice(0, 200)",
    "formatUnknownForServerLog",
  ],
  "src/lib/extraction/extraction.test.ts": [
    "redacts sensitive model-bound context while preserving useful contract text",
    "keeps model-returned source snippets bounded",
  ],
  "src/lib/extraction/openai-pdf-text.ts": [
    "redactModelBoundContractText",
    "Replace provider tokens, cookies, private URLs, signed URL secret parameters, and unrelated tenant identifiers",
    "formatUnknownForServerLog",
  ],
  "src/lib/extraction/run-pipeline.ts": [
    "prepareModelBoundContractText(combinedText)",
    "applyGroundingToFields(modelBoundGroundingText, extraction.fields)",
    "formatUnknownForServerLog(err)",
  ],
  "src/lib/observability/log-redaction.ts": [
    "redactSensitiveLogString",
    "formatUnknownForServerLog",
    "X-Goog-Signature",
    "sk-proj-",
    "gh[pousr]_",
  ],
  "src/lib/observability/log-redaction.test.ts": [
    "OPENAI_API_KEY=sk-proj-",
    "github_token=gho_",
    "X-Goog-Signature",
  ],
  "src/lib/observability/sentry-scrub.ts": ["redact", "scrub", "rawMessage", "raw_message"],
  "scripts/check-ai-context-redaction.test.mjs": [
    "rejects missing model-context redaction helper",
    "rejects raw model output logging regressions",
  ],
};

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

export function analyzeAiContextRedaction(root = ROOT) {
  const issues = [];

  const pkg = JSON.parse(read(root, "package.json"));
  for (const script of REQUIRED_PACKAGE_SCRIPTS) {
    if (!pkg.scripts?.[script]) issues.push({ issue: "missing_package_script", script });
  }

  const ci = read(root, ".github/workflows/ci.yml");
  for (const cmd of REQUIRED_CI_COMMANDS) {
    if (!ci.includes(cmd)) issues.push({ issue: "missing_ci_reference", cmd });
  }

  const securityPipeline = read(root, "scripts/pipelines/pipeline-security-comprehensive.mjs");
  for (const step of REQUIRED_SECURITY_PIPELINE_STEPS) {
    if (!securityPipeline.includes(step)) {
      issues.push({ issue: "missing_security_pipeline_step", step: step.replaceAll('"', "") });
    }
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

  if (exists(root, "src/lib/extraction/extract-fields.ts")) {
    const text = read(root, "src/lib/extraction/extract-fields.ts");
    if (/slice\(0,\s*2000\)/.test(text)) {
      issues.push({ rel: "src/lib/extraction/extract-fields.ts", issue: "raw_model_output_logged" });
    }
  }

  if (exists(root, "src/lib/extraction/run-pipeline.ts")) {
    const text = read(root, "src/lib/extraction/run-pipeline.ts");
    if (/rawMessage/.test(text)) {
      issues.push({ rel: "src/lib/extraction/run-pipeline.ts", issue: "raw_ai_error_forwarded_to_telemetry" });
    }
    if (/console\.error\([^;\n]*OpenAI[^;\n]*,\s*err\s*\)/s.test(text)) {
      issues.push({ rel: "src/lib/extraction/run-pipeline.ts", issue: "raw_ai_error_logged" });
    }
  }

  for (const rel of ["src/lib/extraction/extract-fields.ts", "src/lib/extraction/openai-pdf-text.ts"]) {
    if (!exists(root, rel)) continue;
    const text = read(root, rel);
    if (/e\s+instanceof\s+Error\s*\?\s*e\.message\s*:\s*e/.test(text)) {
      issues.push({ rel, issue: "raw_ai_error_logged" });
    }
  }

  return { checkId: "ai-context-redaction", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeAiContextRedaction();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
