#!/usr/bin/env node

import process from "node:process";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

export const CI_SECURITY_LOCAL_STEPS = [
  {
    id: "semgrep",
    command: "semgrep",
    args: [
      "scan",
      "--config",
      "p/ci",
      "--config",
      "p/typescript",
      "--config",
      "semgrep/oblixa-security.yml",
      "--config",
      "semgrep/oblixa-performance.yml",
      "--config",
      "semgrep/oblixa-v7-surface.yml",
      "--config",
      "semgrep/oblixa-v8-surface.yml",
      "--config",
      "semgrep/oblixa-v10-surface.yml",
      "--severity",
      "ERROR",
      "--error",
      ".",
    ],
  },
  { id: "osv-scanner", command: "osv-scanner", args: ["--lockfile=package-lock.json"] },
  { id: "gitleaks", command: "gitleaks", args: ["detect", "--config", ".gitleaks.toml", "--source", ".", "--no-banner", "--redact"] },
];

function isAvailable(command) {
  return spawnSync("which", [command], { encoding: "utf8" }).status === 0;
}

function runStep(step) {
  if (!isAvailable(step.command)) {
    console.error(JSON.stringify({ ok: false, step: step.id, error: `${step.command}_not_on_path` }, null, 2));
    return 1;
  }
  console.log(`==> ${step.id}`);
  const result = spawnSync(step.command, step.args, { cwd: process.cwd(), stdio: "inherit" });
  return result.status ?? 1;
}

export function runPipelineCiSecurityLocal() {
  for (const step of CI_SECURITY_LOCAL_STEPS) {
    const code = runStep(step);
    if (code !== 0) return code;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runPipelineCiSecurityLocal());
}