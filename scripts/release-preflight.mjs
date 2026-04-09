// Used by `npm run preflight:release` / `release:checklist` before production-style runs.
// Stricter than minimal local dev: crons and absolute URLs need these in deployed environments.
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
if (missing.length > 0) {
  console.error("Missing required env vars:");
  for (const key of missing) console.error(`- ${key}`);
  process.exit(1);
}

console.log("Release preflight env check passed.");

