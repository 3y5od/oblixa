#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const regPath = path.join(root, "config", "qa-external-waiver-registry.json");

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function main() {
  if (!fs.existsSync(regPath)) fail("missing config/qa-external-waiver-registry.json");
  const data = JSON.parse(fs.readFileSync(regPath, "utf8"));
  if (!Array.isArray(data.waivers)) fail("registry: waivers[] required");
  const now = Date.now();
  for (const w of data.waivers) {
    if (!w.id || !w.owner || !w.expiry) fail(`waiver missing id/owner/expiry: ${JSON.stringify(w)}`);
    const t = Date.parse(w.expiry);
    if (!Number.isNaN(t) && t < now) fail(`waiver expired: ${w.id} (${w.expiry})`);
    if (w.policy_path) {
      const p = path.join(root, w.policy_path);
      if (!fs.existsSync(p)) fail(`waiver ${w.id}: missing policy_path ${w.policy_path}`);
    }
    if (w.workflow_path) {
      const p = path.join(root, w.workflow_path);
      if (!fs.existsSync(p)) fail(`waiver ${w.id}: missing workflow_path ${w.workflow_path}`);
    }
  }
  console.log(`OK: supply-chain waiver registry (${data.waivers.length} waiver(s)).`);
}

main();
