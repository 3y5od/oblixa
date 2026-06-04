#!/usr/bin/env node

import { runCommand } from "./lib/process.mjs";

const firstSegmentFiles = [
  "e2e/smoke.spec.ts",
  "e2e/auth-flow.spec.ts",
  "e2e/marketing-public.spec.ts",
  "e2e/external-public.spec.ts",
  "e2e/security-api.spec.ts",
  "e2e/cron-routes-smoke.spec.ts",
  "e2e/security-headers-smoke.spec.ts",
  "e2e/public-token-route-states.spec.ts",
  "e2e/ui-resilience.spec.ts",
  "e2e/ui-resilience-api.spec.ts",
  "e2e/frontend-operational-resilience.spec.ts",
];

const authenticatedSegmentFiles = [
  "e2e/current-product-core-smoke.spec.ts",
  "e2e/settings-security.spec.ts",
];

const baseEnv = {
  ...process.env,
  PLAYWRIGHT_MULTI_BROWSER: "1",
};

async function runPlaywright(label, args, env = baseEnv) {
  process.stdout.write(`\n[multi-browser-smoke] ${label}\n`);
  const result = await runCommand("npx", ["playwright", "test", ...args], { env });
  if (!result.ok) {
    process.stderr.write(`[multi-browser-smoke] ${label} failed with exit code ${result.code}\n`);
    process.exit(result.code);
  }
}

for (const project of ["chromium", "firefox"]) {
  await runPlaywright(`${project} smoke segment`, [...firstSegmentFiles, `--project=${project}`]);
}

for (const file of firstSegmentFiles) {
  await runPlaywright(`webkit smoke segment: ${file}`, [file, "--project=webkit"]);
}

for (const project of ["chromium", "firefox", "webkit"]) {
  await runPlaywright(
    `${project} authenticated smoke segment`,
    [...authenticatedSegmentFiles, `--project=${project}`],
    {
      ...baseEnv,
      PLAYWRIGHT_REUSE_AUTH_STORAGE: "1",
    },
  );
}
