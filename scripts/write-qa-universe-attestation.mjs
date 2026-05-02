#!/usr/bin/env node
/**
 * P210 stub: emit a lightweight attestation artifact for QA universe closure.
 * Extend with cosign/SLSA when signing keys are available in CI.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const outDir = path.join(root, "artifacts");
const outPath = path.join(outDir, "qa-universe-attestation.json");

function gitSha() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", cwd: root }).trim();
  } catch {
    return null;
  }
}

const payload = {
  version: 1,
  generatedAt: new Date().toISOString(),
  gitSha: gitSha(),
  note: "Stub attestation — replace with signed bundle when cosign credentials are wired (plan P210).",
  inputs: {
    qaTierManifest: "config/qa-tier-manifest.json",
    qaTierCoverageAllowlist: "config/qa-tier-coverage-allowlist.json",
  },
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, wrote: path.relative(root, outPath) }, null, 2));
