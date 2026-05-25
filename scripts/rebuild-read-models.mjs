#!/usr/bin/env node

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const scopeArg = process.argv.find((arg) => arg.startsWith("--scope="));
const afterArg = process.argv.find((arg) => arg.startsWith("--after="));
const reasonArg = process.argv.find((arg) => arg.startsWith("--reason="));
const contractIdArg = process.argv.find((arg) => arg.startsWith("--contract-id="));
const modelKeysArg = process.argv.find((arg) => arg.startsWith("--model-keys="));
const changedSinceArg = process.argv.find((arg) => arg.startsWith("--changed-since="));
const rawLimit = limitArg?.split("=")[1] ?? "100";
const rawScope = scopeArg?.split("=")[1] ?? "repair";
const after = afterArg?.split("=")[1] ?? null;
const reason = reasonArg?.split("=")[1] ?? "operator_v10_read_model_rebuild";
const contractId = contractIdArg?.split("=")[1] ?? null;
const modelKeys = modelKeysArg?.split("=")[1] ?? null;
const changedSince = changedSinceArg?.split("=")[1] ?? null;
const baseUrl = process.env.V10_REBUILD_READ_MODEL_URL ?? process.env.NEXT_PUBLIC_APP_URL;
const cronSecret = process.env.CRON_SECRET;
const allowedScopes = new Set(["full", "full_org", "incremental", "repair", "dry_run", "one_org", "one_contract", "one_model"]);
const parsedLimit = Number(rawLimit);
const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(Math.floor(parsedLimit), 250) : 100;
const scope = allowedScopes.has(rawScope) ? rawScope : "repair";
const search = new URLSearchParams({
  limit: String(limit),
  scope: dryRun ? "dry_run" : scope,
});
if (after && /^[0-9a-f-]{8,}$/i.test(after)) search.set("after", after);
if (reason && /^[a-z0-9_:-]{1,80}$/i.test(reason)) search.set("reason", reason);
if (contractId && /^[a-zA-Z0-9_-]{3,80}$/.test(contractId)) search.set("contract_id", contractId);
if (modelKeys) {
  const safeModelKeys = modelKeys
    .split(",")
    .map((value) => value.trim())
    .filter((value) => /^[a-z0-9_]+$/i.test(value))
    .join(",");
  if (safeModelKeys) search.set("model_keys", safeModelKeys);
}
if (changedSince && Number.isFinite(Date.parse(changedSince))) search.set("changed_since", new Date(changedSince).toISOString());

const targetUrl = baseUrl
  ? `${baseUrl.replace(/\/$/, "")}/api/cron/v10/read-model-refresh?${search.toString()}`
  : null;

const plan = {
  runbook: "scripts/rebuild-read-models.mjs",
  purpose: "Rebuild V10 read models from source tables through the authorized scheduled refresh route.",
  dryRun,
  scope: dryRun ? "dry_run" : scope,
  limit,
  after,
  reason,
  contractId: search.get("contract_id"),
  modelKeys: search.get("model_keys")?.split(",") ?? null,
  changedSince: search.get("changed_since"),
  targetUrl: targetUrl ? targetUrl.replace(/([?&]after=)[^&]+/i, "$1redacted") : null,
  supportedScopes: [...allowedScopes],
  requiredEnv: ["CRON_SECRET", "V10_REBUILD_READ_MODEL_URL or NEXT_PUBLIC_APP_URL"],
  verificationCommands: [
    "npm run check:release-suite-current",
    "npm run check:release-evidence",
    "npm run check:migration-smoke:current",
  ],
  rollbackNotes: [
    "Archive rows by refresh_job_id through the read-model repair workflow.",
    "Restore previous visible rows before promoting refreshed evidence.",
    "Run idempotency cleanup separately with /api/cron/v10/idempotency-cleanup.",
  ],
  safety: {
    boundedOrgLimit: 250,
    usesAuthorizedCronRoute: true,
    supportSafeOutput: true,
    directDatabaseMutation: false,
  },
};

if (dryRun) {
  console.log(JSON.stringify(plan, null, 2));
  process.exit(0);
}

if (!targetUrl || !cronSecret) {
  console.error(JSON.stringify({ ...plan, ok: false, error: "missing_required_environment" }, null, 2));
  process.exit(1);
}

const response = await fetch(targetUrl, {
  headers: {
    Authorization: `Bearer ${cronSecret}`,
  },
});
const body = await response.text();
console.log(body);
if (!response.ok) process.exit(1);
