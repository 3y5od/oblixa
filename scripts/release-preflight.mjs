const required = [
  "CRON_SECRET",
  "INTEGRATION_TOKEN_ENCRYPTION_KEY",
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

