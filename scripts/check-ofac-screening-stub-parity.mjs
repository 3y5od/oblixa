#!/usr/bin/env node
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const HASH_REL = "artifacts/ofac-sdn-sample.sha256";
const SAMPLE_REL = "artifacts/ofac-sdn-sample-placeholder.txt";

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function fileHash(abs) {
  return createHash("sha256").update(fs.readFileSync(abs)).digest("hex");
}

export function analyzeOfacScreeningStubParity(root = ROOT) {
  const hashPath = path.join(root, HASH_REL);
  const samplePath = path.join(root, SAMPLE_REL);
  const issues = [];

  if (!fs.existsSync(hashPath)) issues.push(issue("ofac_sample_hash_missing", { path: HASH_REL }));
  if (!fs.existsSync(samplePath)) issues.push(issue("ofac_sample_placeholder_missing", { path: SAMPLE_REL }));

  let expected = null;
  let actual = null;
  if (fs.existsSync(hashPath) && fs.existsSync(samplePath)) {
    expected = fs.readFileSync(hashPath, "utf8").trim().split(/\s+/u)[0] ?? "";
    actual = fileHash(samplePath);
    if (!/^[a-f0-9]{64}$/u.test(expected)) {
      issues.push(issue("ofac_sample_hash_invalid", { path: HASH_REL }));
    } else if (expected !== actual) {
      issues.push(issue("ofac_sample_hash_mismatch", { expected, actual }));
    }
  }

  return {
    checkId: "ofac-screening-stub-parity",
    ok: issues.length === 0,
    hashPath: HASH_REL,
    samplePath: SAMPLE_REL,
    expected,
    actual,
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeOfacScreeningStubParity();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
