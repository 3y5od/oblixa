// Used by `npm run preflight:release` / `release:checklist` before production-style runs.
// Stricter than minimal local dev: crons and absolute URLs need these in deployed environments.
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const required = [
  "CRON_SECRET",
  "INTEGRATION_TOKEN_ENCRYPTION_KEY",
  "NEXT_PUBLIC_APP_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "OPENAI_API_KEY",
];

const missing = required.filter((key) => !process.env[key]?.trim());
console.log(
  JSON.stringify(
    {
      requiredCount: required.length,
      missingCount: missing.length,
      missing,
    },
    null,
    2
  )
);
if (missing.length > 0) {
  console.error("Missing required env vars:");
  for (const key of missing) console.error(`- ${key}`);
  process.exit(1);
}

console.log("Release preflight env check passed.");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cwd = path.join(__dirname, "..");
execSync("npm run check:onboarding-qa-matrix", { stdio: "inherit", cwd });
execSync("npm run check:onboarding-stale-env-parity", { stdio: "inherit", cwd });
execSync("npm run check:performance-static:strict", { stdio: "inherit", cwd });
execSync("npm run check:bundle-budget", { stdio: "inherit", cwd });
execSync("npm run check:incident-readiness:strict", { stdio: "inherit", cwd });
execSync("npm run check:artifact-integrity", { stdio: "inherit", cwd });
execSync("npm run check:v10-migration-smoke", { stdio: "inherit", cwd });
execSync("npm run check:v10-release-evidence", { stdio: "inherit", cwd });
execSync("npm run check:v10-privacy-scan", { stdio: "inherit", cwd });
execSync("npm run check:v10-zero-exclusion-report", { stdio: "inherit", cwd });
execSync("npm run check:v10-suite", { stdio: "inherit", cwd });
execSync("npm run report:ci-provenance", { stdio: "inherit", cwd });

console.log("Release preflight includes V10 release evidence, privacy, and suite checks.");

