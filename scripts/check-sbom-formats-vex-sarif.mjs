#!/usr/bin/env node
/**
 * SPDX/CycloneDX SBOM script present; SARIF workflows optional (plan: sbom-formats-vex-sarif).
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const sbom = pkg.scripts?.sbom;
const semgrepSarif = fs.existsSync(path.join(root, ".github", "workflows", "semgrep-sarif.yml"));
const ok = typeof sbom === "string" && sbom.includes("cyclonedx");
console.log(JSON.stringify({ checkId: "sbom-formats-vex-sarif", ok, semgrepSarif, sbom: !!sbom }, null, 2));
process.exit(ok ? 0 : 1);
