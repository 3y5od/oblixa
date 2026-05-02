#!/usr/bin/env node
/**
 * Parity check for merge-queue canary workflow artifact contract (see qa-merge-queue-canary.yml).
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const wf = path.join(root, ".github", "workflows", "qa-merge-queue-canary.yml");
const text = fs.readFileSync(wf, "utf8");
const problems = [];
if (!text.includes("expected-checks.json")) problems.push("missing_expected_checks_json_reference");
if (!text.includes("expected-checks")) problems.push("missing_expected_checks_artifact_name");
if (!/upload-artifact/i.test(text)) problems.push("missing_upload_artifact_step");
const ok = problems.length === 0;
console.log(JSON.stringify({ checkId: "merge-queue-canary-parity", ok, problems, workflow: "qa-merge-queue-canary.yml" }, null, 2));
process.exit(ok ? 0 : 1);
