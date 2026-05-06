#!/usr/bin/env node
import process from "node:process";
import { pathToFileURL } from "node:url";
import { runSequential } from "./lib/scheduler.mjs";
import {
  USER_FACING_INTERACTION_ARTIFACT,
  assertUserFacingInteractionReport,
  writeUserFacingInteractionReport,
} from "./report-user-facing-interactions.mjs";

export const USER_FACING_INTERACTION_PROFILES = {
  pr: [
    "check:ui-surface-consistency",
    "check:route-state-coverage",
    "check:authenticated-a11y-matrix",
    "check:page-heading-contract",
    "check:shell-landmarks",
    "check:e2e-generated-drift",
    "check:security-fetch-sinks:strict",
    "test:ui:a11y",
    "test:e2e:smoke",
  ],
  nightly: [
    "check:ui-surface-consistency",
    "check:route-state-coverage",
    "check:authenticated-a11y-matrix",
    "check:page-heading-contract",
    "check:shell-landmarks",
    "check:e2e-generated-drift",
    "check:security-fetch-sinks:strict",
    "test:ui:a11y",
    "test:e2e:smoke",
    "test:e2e:a11y",
    "test:e2e:visual:full",
    "test:e2e:multi-browser",
  ],
  release: [
    "check:ui-surface-consistency",
    "check:route-state-coverage",
    "check:authenticated-a11y-matrix",
    "check:page-heading-contract",
    "check:shell-landmarks",
    "check:e2e-generated-drift",
    "check:security-fetch-sinks:strict",
    "check:coverage-completeness",
    "test:ui:a11y",
    "test:e2e:smoke",
    "test:e2e:a11y",
    "test:e2e:visual:full",
    "test:e2e:multi-browser",
  ],
};

export function getUserFacingInteractionProfile(profile = "pr") {
  return USER_FACING_INTERACTION_PROFILES[profile] ?? USER_FACING_INTERACTION_PROFILES.pr;
}

function parseProfile(argv = process.argv.slice(2)) {
  const flagIndex = argv.indexOf("--profile");
  if (flagIndex >= 0 && argv[flagIndex + 1]) return argv[flagIndex + 1];
  const inline = argv.find((value) => value.startsWith("--profile="));
  return inline?.split("=")[1] ?? "pr";
}

export async function runUserFacingInteractionChecks(profile = "pr") {
  const report = writeUserFacingInteractionReport();
  const blockingFailures = assertUserFacingInteractionReport(report);
  if (blockingFailures.length) {
    return {
      pipeline: "user-facing-interactions",
      profile,
      artifact: USER_FACING_INTERACTION_ARTIFACT,
      blockingFailures,
      results: [],
      exitCode: 1,
    };
  }

  const steps = getUserFacingInteractionProfile(profile);
  const results = await runSequential(steps);
  const failed = results.find((result) => !result.ok && result.required);
  return {
    pipeline: "user-facing-interactions",
    profile,
    artifact: USER_FACING_INTERACTION_ARTIFACT,
    blockingFailures,
    results,
    exitCode: failed ? failed.code : 0,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const profile = parseProfile();
  const result = await runUserFacingInteractionChecks(profile);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.exitCode);
}