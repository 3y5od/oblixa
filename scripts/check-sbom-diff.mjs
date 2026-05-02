#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const report = path.join(__dirname, "..", "artifacts", "sbom-diff-report.json");
const baselinePath = process.env.SBOM_BASELINE_PATH || "";
const strict = process.env.SBOM_DIFF_STRICT === "1";

function main() {
  if (!fs.existsSync(report)) {
    console.log("OK: no sbom-diff-report.json (optional gate).");
    process.exit(0);
  }
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(report, "utf8"));
  } catch {
    console.error("Invalid sbom-diff-report.json");
    process.exit(strict ? 1 : 0);
  }
  if (doc.ok === false) {
    console.error("SBOM diff report marks ok:false");
    process.exit(strict ? 1 : 0);
  }
  if (Array.isArray(doc.blocking_cves) && doc.blocking_cves.length > 0 && strict) {
    console.error("Blocking CVEs in SBOM diff:", doc.blocking_cves.join(", "));
    process.exit(1);
  }
  if (strict && baselinePath) {
    const sbom = path.join(__dirname, "..", "cyclonedx-sbom.json");
    if (!fs.existsSync(sbom) || !fs.existsSync(baselinePath)) {
      console.error("SBOM_DIFF_STRICT: missing cyclonedx-sbom.json or baseline file");
      process.exit(1);
    }
    const h = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
    if (h(sbom) !== h(baselinePath)) {
      console.error("SBOM_DIFF_STRICT: cyclonedx-sbom.json hash differs from baseline");
      process.exit(1);
    }
    console.log("OK: SBOM hash matches baseline.");
    process.exit(0);
  }
  console.log("OK: sbom diff report present (stub or non-strict).");
}

main();
