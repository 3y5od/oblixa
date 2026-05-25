#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

export const CI_BUILD_E2E_LOCAL_STEPS = ["build", "test:e2e:smoke", "test:e2e:current-product", "test:e2e:a11y", "test:e2e:visual"];
export const CI_BUILD_E2E_ONBOARDING_STEPS = ["test:e2e:onboarding-deep", "test:e2e:multi-browser"];

function evaluateGate(label, strictVariable, requiredKeys) {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-secret-gate-"));
  const outputPath = path.join(outputDir, "gate.out");
  fs.writeFileSync(outputPath, "", "utf8");
  const result = spawnSync("bash", ["scripts/github-actions/secret-gate.sh", label, strictVariable, requiredKeys.join(",")], {
    cwd: process.cwd(),
    env: { ...process.env, GITHUB_OUTPUT: outputPath },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const outputs = Object.fromEntries(
    fs.readFileSync(outputPath, "utf8").split("\n").filter(Boolean).map((line) => line.split("=", 2))
  );
  fs.rmSync(outputDir, { recursive: true, force: true });
  return { code: result.status ?? 1, stdout: result.stdout, stderr: result.stderr, outputs };
}

function runNpmScript(scriptName) {
  console.log(`==> npm run ${scriptName}`);
  return spawnSync("npm", ["run", scriptName], { cwd: process.cwd(), stdio: "inherit" }).status ?? 1;
}

export function runPipelineCiBuildE2eLocal() {
  const gate = evaluateGate("quality_build_e2e", "REQUIRE_CI_E2E_AUTH", ["E2E_TEST_EMAIL", "E2E_TEST_PASSWORD"]);
  if (gate.stdout) process.stdout.write(gate.stdout);
  if (gate.stderr) process.stderr.write(gate.stderr);
  if (gate.code !== 0) return gate.code;
  if (gate.outputs.run !== "true") {
    console.log("Skipping local build/E2E parity because authenticated credentials are unavailable.");
    return 0;
  }

  for (const step of CI_BUILD_E2E_LOCAL_STEPS) {
    const code = runNpmScript(step);
    if (code !== 0) return code;
  }

  if (!process.env.E2E_ONBOARDING_FULL) return 0;

  const onboardingGate = evaluateGate("quality_e2e_onboarding_full", "REQUIRE_CI_E2E_AUTH", ["E2E_TEST_EMAIL", "E2E_TEST_PASSWORD"]);
  if (onboardingGate.stdout) process.stdout.write(onboardingGate.stdout);
  if (onboardingGate.stderr) process.stderr.write(onboardingGate.stderr);
  if (onboardingGate.code !== 0) return onboardingGate.code;
  if (onboardingGate.outputs.run !== "true") {
    console.log("Skipping local onboarding E2E parity because authenticated credentials are unavailable.");
    return 0;
  }

  for (const step of CI_BUILD_E2E_ONBOARDING_STEPS) {
    const code = runNpmScript(step);
    if (code !== 0) return code;
  }

  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runPipelineCiBuildE2eLocal());
}
