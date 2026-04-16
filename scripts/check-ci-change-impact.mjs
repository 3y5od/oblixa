#!/usr/bin/env node
import { execSync } from "node:child_process";
import process from "node:process";

const strict = process.argv.includes("--strict");
const baseRef = process.env.CI_CHANGE_IMPACT_BASE_REF?.trim() || "HEAD~1";
let changed = [];

try {
  const raw = execSync(`git diff --name-only ${baseRef}...HEAD`, {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
  changed = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
} catch {
  // Fallback: when base ref is unavailable, inspect staged+unstaged paths.
  const raw = execSync("git diff --name-only", {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
  changed = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

const requiredChecks = new Set();
const addChecksForPath = (file) => {
  if (file.startsWith("src/app/api/")) {
    requiredChecks.add("check:api-route-tests");
    requiredChecks.add("check:api-route-rate-limit-coverage");
    requiredChecks.add("check:cron-route-auth");
  }
  if (file.startsWith("src/lib/product-surface/") || file.includes("(dashboard)/")) {
    requiredChecks.add("check:v8-suite");
  }
  if (file.startsWith("e2e/") || file === "playwright.config.ts") {
    requiredChecks.add("report:e2e:stability");
    requiredChecks.add("check:e2e:stability-threshold");
    requiredChecks.add("check:e2e:skip-baseline");
  }
  if (file.startsWith("scripts/") || file === "package.json") {
    requiredChecks.add("check:checks-integrity-meta");
    requiredChecks.add("check:config-drift");
  }
  if (file.startsWith(".github/workflows/")) {
    requiredChecks.add("check:github-workflows-security");
    requiredChecks.add("check:checks-integrity-meta");
  }
};

for (const file of changed) addChecksForPath(file);

const payload = {
  strict,
  baseRef,
  changedCount: changed.length,
  changed,
  requiredChecks: Array.from(requiredChecks).sort(),
};
console.log(JSON.stringify(payload, null, 2));

if (strict && changed.length === 0) {
  process.exit(1);
}
