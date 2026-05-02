#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const junitPath =
  process.env.PLAYWRIGHT_JUNIT_OUTPUT ||
  path.join(ROOT, "test-results", "junit.xml");

if (!fs.existsSync(junitPath)) {
  const payload = { ok: true, mode: "no_junit", junitPath };
  fs.mkdirSync(path.join(ROOT, "artifacts"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "artifacts", "flake-summary.json"), `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

const xml = fs.readFileSync(junitPath, "utf8");
const flaky = [];
for (const m of xml.matchAll(/<testcase([^>]*)\/>/g)) {
  if (/\bflaky=["']true["']/.test(m[1])) flaky.push(m[1]);
}

const payload = { ok: true, flakyHeuristicCount: flaky.length };
fs.mkdirSync(path.join(ROOT, "artifacts"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "artifacts", "flake-summary.json"), `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));
process.exit(0);
