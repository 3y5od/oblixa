#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const allowPath = path.join(__dirname, "..", "artifacts", "license-allowlist.json");
const sbomPath = path.join(__dirname, "..", "cyclonedx-sbom.json");

if (!fs.existsSync(allowPath)) {
  console.error("missing artifacts/license-allowlist.json");
  process.exit(1);
}
const { families } = JSON.parse(fs.readFileSync(allowPath, "utf8"));
if (!Array.isArray(families) || families.length === 0) {
  console.error("license allowlist: families[] required");
  process.exit(1);
}
if (!fs.existsSync(sbomPath)) {
  console.log("OK: no cyclonedx-sbom.json (run npm run sbom locally / CI artifact).");
  process.exit(0);
}
const sbom = JSON.parse(fs.readFileSync(sbomPath, "utf8"));
const comps = sbom.components ?? [];
const bad = [];
for (const c of comps) {
  const lic = c.licenses?.[0]?.license?.id || c.licenses?.[0]?.expression;
  if (!lic) continue;
  if (!families.includes(lic)) bad.push(`${c.name}@${c.version}: ${lic}`);
}
if (bad.length) {
  console.error("Non-allowlisted licenses:\n" + bad.slice(0, 20).join("\n"));
  process.exit(1);
}
console.log(`OK: SBOM license spot-check (${comps.length} component(s)).`);
