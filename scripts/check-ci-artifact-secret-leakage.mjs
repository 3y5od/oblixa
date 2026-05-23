#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import YAML from "yaml";

const WORKFLOW_EXT_RE = /\.(ya?ml)$/i;
const MIN_ARTIFACT_RETENTION_DAYS = 1;
const MAX_ARTIFACT_RETENTION_DAYS = 14;

const SECRET_PATH_PATTERNS = [
  { issue: "env_file_artifact_path", re: /(^|\/)\.env(?:[./-]|$)/i },
  { issue: "npmrc_artifact_path", re: /(^|\/)\.npmrc$/i },
  { issue: "ssh_artifact_path", re: /(^|\/)\.ssh(?:\/|$)/i },
  { issue: "cloud_credentials_artifact_path", re: /(^|\/)(?:credentials|config)\.json$/i },
  { issue: "private_key_artifact_path", re: /(^|\/)(?:id_rsa|id_dsa|id_ed25519|.*\.(?:pem|key|p12|pfx))$/i },
  { issue: "playwright_auth_artifact_path", re: /(^|\/)(?:playwright\/\.auth|storageState|auth-state|cookies)(?:\/|\.|$)/i },
  { issue: "secret_named_artifact_path", re: /(^|\/)[^/]*(?:secret|credential|private[_-]?key|access[_-]?token)[^/]*(?:\/|$)/i },
];

function readWorkflowFiles(root) {
  const workflowsDir = path.join(root, ".github", "workflows");
  if (!fs.existsSync(workflowsDir)) return [];
  return fs
    .readdirSync(workflowsDir)
    .filter((name) => WORKFLOW_EXT_RE.test(name))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const fullPath = path.join(workflowsDir, name);
      const text = fs.readFileSync(fullPath, "utf8");
      return { name, fullPath, text, workflow: YAML.parse(text) ?? {} };
    });
}

function asArray(value) {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function parseArtifactPaths(value) {
  return asArray(value)
    .flatMap((entry) => String(entry).split("\n"))
    .map((line) => line.replace(/\s+#.*$/u, "").trim())
    .map((line) => line.replace(/^['"]|['"]$/gu, ""))
    .filter(Boolean);
}

function isUploadArtifactStep(step) {
  return typeof step?.uses === "string" && /^actions\/upload-artifact@/iu.test(step.uses.trim());
}

function isDownloadArtifactStep(step) {
  return typeof step?.uses === "string" && /^actions\/download-artifact@/iu.test(step.uses.trim());
}

function hasGithubExpression(value) {
  return typeof value === "string" && /\$\{\{/u.test(value);
}

function parseStaticRetentionDays(value) {
  if (typeof value === "number") return Number.isInteger(value) ? value : null;
  if (typeof value === "string" && /^\d+$/u.test(value.trim())) return Number(value);
  return null;
}

function checkArtifactRetention(value) {
  if (value == null) return [{ issue: "missing_artifact_retention_days" }];

  const retentionDays = parseStaticRetentionDays(value);
  if (
    retentionDays == null ||
    retentionDays < MIN_ARTIFACT_RETENTION_DAYS ||
    retentionDays > MAX_ARTIFACT_RETENTION_DAYS
  ) {
    return [{
      issue: "invalid_artifact_retention_days",
      retentionDays: value,
      min: MIN_ARTIFACT_RETENTION_DAYS,
      max: MAX_ARTIFACT_RETENTION_DAYS,
    }];
  }

  return [];
}

function checkArtifactHiddenFileExclusion(value) {
  if (value == null) return [{ issue: "missing_artifact_hidden_file_exclusion" }];
  if (value === false || String(value).toLowerCase() === "false") return [];
  return [{ issue: "artifact_hidden_files_not_disabled", includeHiddenFiles: value }];
}

function isTruthy(value) {
  return value === true || String(value).toLowerCase() === "true";
}

function isBroadWorkspacePath(artifactPath) {
  const normalized = artifactPath.replace(/\\/gu, "/").replace(/\/+$/u, "");
  return (
    normalized === "." ||
    normalized === "./" ||
    normalized === "/" ||
    normalized === "~" ||
    normalized === "$HOME" ||
    normalized === "${{ github.workspace }}" ||
    normalized === "${{github.workspace}}" ||
    normalized === "${{ github.workspace }}/**" ||
    normalized === "${{github.workspace}}/**"
  );
}

function isSafeDownloadPath(downloadPath) {
  if (downloadPath == null) return false;
  const normalized = String(downloadPath).replace(/\\/gu, "/").replace(/\/+$/u, "").trim();
  return (
    normalized.length > 0 &&
    !hasGithubExpression(normalized) &&
    normalized !== "." &&
    normalized !== "./" &&
    normalized !== "/" &&
    normalized !== "~" &&
    normalized !== "$HOME" &&
    normalized !== "${{ github.workspace }}" &&
    normalized !== "${{github.workspace}}" &&
    !normalized.startsWith("../") &&
    !normalized.includes("/../")
  );
}

function checkArtifactDownloadScope(step) {
  const issues = [];
  const withBlock = step.with ?? {};
  const name = withBlock.name;
  const pattern = withBlock.pattern;
  const hasName = typeof name === "string" && name.trim().length > 0;
  const hasPattern = typeof pattern === "string" && pattern.trim().length > 0;

  if (!hasName && !hasPattern) {
    issues.push({ issue: "missing_artifact_download_selector" });
  }

  if (hasName && hasPattern) {
    issues.push({ issue: "ambiguous_artifact_download_selector" });
  }

  for (const [selectorType, selectorValue] of [
    ["name", name],
    ["pattern", pattern],
  ]) {
    if (selectorValue == null) continue;
    const value = String(selectorValue).trim();
    if (hasGithubExpression(value)) {
      issues.push({ issue: "dynamic_artifact_download_selector", selectorType, selector: selectorValue });
    }
    if (selectorType === "name" && /[*?[\]]/u.test(value)) {
      issues.push({ issue: "wildcard_artifact_download_name", selector: selectorValue });
    }
    if (selectorType === "pattern" && (value === "*" || value === "**" || value.includes("**"))) {
      issues.push({ issue: "broad_artifact_download_pattern", selector: selectorValue });
    }
    if (selectorType === "pattern" && value.includes("*") && !isTruthy(withBlock["merge-multiple"])) {
      issues.push({ issue: "artifact_download_pattern_without_merge_multiple", selector: selectorValue });
    }
  }

  if (!isSafeDownloadPath(withBlock.path)) {
    issues.push({ issue: "unsafe_artifact_download_path", downloadPath: withBlock.path });
  }

  return issues;
}

function checkArtifactPath(artifactPath) {
  const issues = [];
  const normalized = artifactPath.replace(/\\/gu, "/");

  if (isBroadWorkspacePath(normalized)) {
    issues.push({ issue: "broad_workspace_artifact_path", artifactPath });
  }

  for (const pattern of SECRET_PATH_PATTERNS) {
    if (pattern.re.test(normalized)) {
      issues.push({ issue: pattern.issue, artifactPath });
    }
  }

  return issues;
}

export function analyzeCiArtifactSecretLeakage(root = process.cwd()) {
  const issues = [];
  let uploadStepCount = 0;
  let downloadStepCount = 0;

  for (const file of readWorkflowFiles(root)) {
    for (const [jobName, job] of Object.entries(file.workflow.jobs ?? {})) {
      for (const [index, step] of (job.steps ?? []).entries()) {
        if (isDownloadArtifactStep(step)) {
          downloadStepCount += 1;
          for (const issue of checkArtifactDownloadScope(step)) {
            issues.push({
              file: file.name,
              job: jobName,
              step: step.name ?? `step_${index + 1}`,
              ...issue,
            });
          }
        }

        if (!isUploadArtifactStep(step)) continue;
        uploadStepCount += 1;

        for (const issue of checkArtifactRetention(step.with?.["retention-days"])) {
          issues.push({
            file: file.name,
            job: jobName,
            step: step.name ?? `step_${index + 1}`,
            ...issue,
          });
        }

        for (const issue of checkArtifactHiddenFileExclusion(step.with?.["include-hidden-files"])) {
          issues.push({
            file: file.name,
            job: jobName,
            step: step.name ?? `step_${index + 1}`,
            ...issue,
          });
        }

        const artifactPaths = parseArtifactPaths(step.with?.path);
        if (artifactPaths.length === 0) {
          issues.push({
            file: file.name,
            job: jobName,
            step: step.name ?? `step_${index + 1}`,
            issue: "missing_artifact_path",
          });
          continue;
        }

        for (const artifactPath of artifactPaths) {
          for (const issue of checkArtifactPath(artifactPath)) {
            issues.push({
              file: file.name,
              job: jobName,
              step: step.name ?? `step_${index + 1}`,
              ...issue,
            });
          }
        }
      }
    }
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    workflowCount: readWorkflowFiles(root).length,
    uploadStepCount,
    downloadStepCount,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeCiArtifactSecretLeakage();
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}
