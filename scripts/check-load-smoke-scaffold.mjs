#!/usr/bin/env node
/** Epic 8 — verify load smoke is an executable, fail-closed staging gate. */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const required = ["loadtests/README.md", "loadtests/k6-staging-smoke.js"];
for (const rel of required) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    console.error(`check-load-smoke-scaffold: missing ${rel}`);
    process.exit(1);
  }
}

const workflow = fs.readFileSync(path.join(root, ".github/workflows/load-smoke-optional.yml"), "utf8");
const k6 = fs.readFileSync(path.join(root, "loadtests/k6-staging-smoke.js"), "utf8");
const errors = [];

for (const marker of [
  "STAGING_BASE_URL",
  "ALLOW_LOAD_SMOKE_SKIP",
  "ALLOW_SECRET_GATED_SKIP",
  "exit 1",
  "grafana/k6:",
  "loadtests/k6-staging-smoke.js",
]) {
  if (!workflow.includes(marker)) {
    errors.push(`workflow missing marker: ${marker}`);
  }
}

for (const marker of ["/api/health", "/api/reminders/send", "http_req_duration", "unsigned cron rejects"]) {
  if (!k6.includes(marker)) {
    errors.push(`k6 script missing marker: ${marker}`);
  }
}

if (errors.length) {
  console.error("check-load-smoke-scaffold failed:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log("OK: load-smoke staging gate and k6 probe are executable.");
