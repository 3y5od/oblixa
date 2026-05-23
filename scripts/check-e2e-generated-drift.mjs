#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { buildAuthenticatedRouteMatrixSource } from "./generate-authenticated-route-matrix.mjs";
import { buildPublicRouteMatrixSource } from "./generate-public-route-matrix.mjs";
import { buildRouteStateMatrixSource } from "./generate-route-state-matrix.mjs";
import { buildVisualRouteMatrixSource } from "./generate-visual-route-matrix.mjs";
import { issueReport } from "./lib/static-check-utils.mjs";

export const E2E_GENERATED_ARTIFACTS = [
  {
    path: "e2e/generated/public-routes.ts",
    source: buildPublicRouteMatrixSource,
  },
  {
    path: "e2e/generated/authenticated-routes.ts",
    source: buildAuthenticatedRouteMatrixSource,
  },
  {
    path: "e2e/generated/route-states.ts",
    source: buildRouteStateMatrixSource,
  },
  {
    path: "e2e/generated/visual-routes.ts",
    source: buildVisualRouteMatrixSource,
  },
];

export function analyzeE2eGeneratedDrift(root = process.cwd()) {
  const issues = [];

  for (const artifact of E2E_GENERATED_ARTIFACTS) {
    const abs = path.join(root, artifact.path);
    const expected = artifact.source();
    if (!fs.existsSync(abs)) {
      issues.push({
        issue: "missing_e2e_generated_artifact",
        path: artifact.path,
        expectedBytes: Buffer.byteLength(expected),
      });
      continue;
    }

    const actual = fs.readFileSync(abs, "utf8");
    if (actual !== expected) {
      issues.push({
        issue: "e2e_generated_artifact_drift",
        path: artifact.path,
        expectedBytes: Buffer.byteLength(expected),
        actualBytes: Buffer.byteLength(actual),
      });
    }
  }

  return issueReport("e2e-generated-drift", issues, {
    artifactCount: E2E_GENERATED_ARTIFACTS.length,
  });
}

function main() {
  const report = analyzeE2eGeneratedDrift();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
