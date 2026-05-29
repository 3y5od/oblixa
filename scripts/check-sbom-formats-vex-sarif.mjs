#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { analyzeSbomDualFormatEvidence } from "./check-sbom-dual-format-evidence.mjs";

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

export function analyzeSbomFormatsVexSarif(root = process.cwd()) {
  const issues = [];
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const semgrepSarif = fs.existsSync(path.join(root, ".github", "workflows", "semgrep-sarif.yml"))
    ? fs.readFileSync(path.join(root, ".github", "workflows", "semgrep-sarif.yml"), "utf8")
    : "";
  const scorecardWorkflow = fs.existsSync(path.join(root, ".github", "workflows", "openssf-scorecard.yml"))
    ? fs.readFileSync(path.join(root, ".github", "workflows", "openssf-scorecard.yml"), "utf8")
    : "";
  const sbomEvidence = analyzeSbomDualFormatEvidence(root);

  if (!String(pkg.scripts?.sbom ?? "").includes("@cyclonedx/cyclonedx-npm")) {
    issues.push(issue("missing_cyclonedx_sbom_generator_script", { script: "sbom" }));
  }
  for (const script of ["check:sbom-dual-format-evidence", "write:sbom-dual-format-evidence", "check:sbom-integrity"]) {
    if (typeof pkg.scripts?.[script] !== "string") issues.push(issue("missing_package_script", { script }));
  }
  if (!sbomEvidence.ok) {
    issues.push(issue("dual_format_sbom_evidence_failed", { issueCount: sbomEvidence.issueCount }));
  }
  if (!semgrepSarif.includes("--sarif") || !semgrepSarif.includes("semgrep.sarif") || !semgrepSarif.includes("actions/upload-artifact")) {
    issues.push(issue("semgrep_sarif_artifact_not_enforced", { path: ".github/workflows/semgrep-sarif.yml" }));
  }
  if (!scorecardWorkflow.includes("results_format: sarif") || !scorecardWorkflow.includes("results_file: results.sarif")) {
    issues.push(issue("scorecard_sarif_output_not_enforced", { path: ".github/workflows/openssf-scorecard.yml" }));
  }
  if (!fs.existsSync(path.join(root, "artifacts", "sbom-diff-report.json"))) {
    issues.push(issue("missing_vex_or_sbom_diff_artifact", { path: "artifacts/sbom-diff-report.json" }));
  }

  return {
    checkId: "sbom-formats-vex-sarif",
    ok: issues.length === 0,
    cyclonedxScript: Boolean(pkg.scripts?.sbom),
    dualFormatEvidence: {
      ok: sbomEvidence.ok,
      formatCount: sbomEvidence.formats?.length ?? 0,
      countComparison: sbomEvidence.countComparison ?? null,
    },
    semgrepSarif: semgrepSarif.length > 0,
    scorecardSarif: scorecardWorkflow.length > 0,
    vexOrDiffArtifact: fs.existsSync(path.join(root, "artifacts", "sbom-diff-report.json")),
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeSbomFormatsVexSarif();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
