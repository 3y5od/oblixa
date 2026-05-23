#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import {
  buildSecurityRouteMatrix,
  findSecurityRouteMatrixFailures,
  findSecurityRouteMatrixUniverseFailures,
} from "./report-security-route-matrix.mjs";

const root = process.cwd();

function stripVolatile(value) {
  if (Array.isArray(value)) return value.map(stripVolatile);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, nested] of Object.entries(value)) out[key] = stripVolatile(nested);
    return out;
  }
  return value;
}

export function findSecurityRouteMatrixDriftFailures(rootDir = root) {
  const expected = buildSecurityRouteMatrix(rootDir);
  const failures = [
    ...findSecurityRouteMatrixFailures(expected),
    ...findSecurityRouteMatrixUniverseFailures(rootDir, expected),
  ];
  const file = path.join(rootDir, "artifacts", "security-route-matrix.json");
  if (!fs.existsSync(file)) {
    failures.push("artifacts/security-route-matrix.json:missing");
    return { expected, failures };
  }
  let actual;
  try {
    actual = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    failures.push(`artifacts/security-route-matrix.json:invalid_json:${error.message}`);
    return { expected, failures };
  }
  failures.push(...findSecurityRouteMatrixFailures(actual));
  failures.push(...findSecurityRouteMatrixUniverseFailures(rootDir, actual));
  if (JSON.stringify(stripVolatile(actual)) !== JSON.stringify(stripVolatile(expected))) {
    failures.push("artifacts/security-route-matrix.json:drift");
  }
  return { expected, failures };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { expected, failures } = findSecurityRouteMatrixDriftFailures(root);
  if (failures.length > 0) {
    console.error("check-security-route-matrix failed:");
    for (const failure of failures.slice(0, 80)) console.error(`  - ${failure}`);
    if (failures.length > 80) console.error(`  ... ${failures.length - 80} more`);
    console.error("Run: npm run report:security-route-matrix");
    process.exit(1);
  }
  console.log(`check-security-route-matrix: OK (${expected.length} method rows)`);
}
