#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { fileExists, issueReport, readJson } from "./lib/static-check-utils.mjs";

const RISKY_SCRIPT_PATTERNS = [
  { issue: "remote_shell_download", pattern: /\b(?:curl|wget)\b|https?:\/\//i },
  { issue: "shell_passthrough_command", pattern: /\b(?:bash|sh)\s+-c\b/i },
  { issue: "unreviewed_npx_yes", pattern: /\bnpx\s+--yes\b/i },
  { issue: "powershell_network_bootstrap", pattern: /\b(?:powershell|pwsh|Invoke-WebRequest)\b/i },
];

const ALLOWED_RISKY_SCRIPTS = new Map([
  [
    "sbom",
    /^npx --yes @cyclonedx\/cyclonedx-npm@4\.2\.1 --output-file cyclonedx-sbom\.json --package-lock-only --ignore-npm-errors$/,
  ],
]);

function isAllowedRisk(script, command) {
  return ALLOWED_RISKY_SCRIPTS.get(script)?.test(command) ?? false;
}

function extractNodeScriptRefs(command) {
  return [...command.matchAll(/\bnode\s+(scripts\/[^\s'"&|;]+\.mjs)\b/g)].map((match) => match[1]);
}

export function analyzeNpmScriptIntegrity(root = process.cwd()) {
  const pkg = readJson(root, "package.json");
  const scripts = pkg.scripts ?? {};
  const issues = [];

  for (const [script, command] of Object.entries(scripts)) {
    if (typeof command !== "string") {
      issues.push({ issue: "non_string_npm_script", file: "package.json", script });
      continue;
    }

    if (!isAllowedRisk(script, command)) {
      for (const { issue, pattern } of RISKY_SCRIPT_PATTERNS) {
        if (pattern.test(command)) {
          issues.push({ issue, file: "package.json", script });
        }
      }
    }

    for (const rel of extractNodeScriptRefs(command)) {
      if (!fileExists(root, rel)) {
        issues.push({ issue: "missing_node_script_file", file: "package.json", script, target: rel });
      }
    }

    if (/^check:/.test(script) && /\|\s*(?:bash|sh)\b|\b(?:bash|sh)\s+-/.test(command)) {
      issues.push({ issue: "check_script_uses_shell_pipe", file: "package.json", script });
    }
  }

  for (const rel of ["scripts/security-check-generic.mjs"]) {
    if (fs.existsSync(path.join(root, rel))) continue;
    issues.push({ issue: "missing_generic_reporter_for_informational_checks", file: rel });
  }

  return issueReport("npm-script-integrity", issues, { scriptCount: Object.keys(scripts).length });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeNpmScriptIntegrity();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
