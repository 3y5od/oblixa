#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const strict = process.env.SBOM_DIFF_STRICT === "1" || process.env.SBOM_DIFF_STRICT === "true";
const baselinePath = process.env.SBOM_BASELINE_PATH || path.join(ROOT, "cyclonedx-sbom.json");
const currentPath = path.join(ROOT, "cyclonedx-sbom.json");

function sha256File(p) {
  const h = crypto.createHash("sha256");
  h.update(fs.readFileSync(p));
  return h.digest("hex");
}

const outDir = path.join(ROOT, "artifacts");
fs.mkdirSync(outDir, { recursive: true });

if (!strict) {
  const out = {
    ok: true,
    mode: "stub",
    hint: "Set SBOM_DIFF_STRICT=1 and SBOM_BASELINE_PATH to compare cyclonedx-sbom.json hashes.",
  };
  fs.writeFileSync(path.join(outDir, "sbom-diff-report.json"), `${JSON.stringify(out, null, 2)}\n`);
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

if (!fs.existsSync(currentPath)) {
  const out = { ok: false, error: "missing_current_sbom", currentPath };
  console.error(JSON.stringify(out, null, 2));
  process.exit(1);
}
if (!fs.existsSync(baselinePath)) {
  const out = { ok: false, error: "missing_baseline_sbom", baselinePath };
  console.error(JSON.stringify(out, null, 2));
  process.exit(1);
}

const cur = sha256File(currentPath);
const base = sha256File(baselinePath);
const ok = cur === base;
const report = {
  ok,
  mode: "strict_hash",
  currentPath,
  baselinePath,
  currentSha256: cur,
  baselineSha256: base,
};
fs.writeFileSync(path.join(outDir, "sbom-diff-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
process.exit(ok ? 0 : 1);
