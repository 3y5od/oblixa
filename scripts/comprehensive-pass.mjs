import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import nextEnv from "@next/env";

const cwd = process.cwd();
const { loadEnvConfig } = nextEnv;
loadEnvConfig(cwd);

function env(name) {
  return (process.env[name] ?? "").trim();
}

function ok(msg) {
  console.log(`PASS ${msg}`);
}

function fail(msg) {
  console.error(`FAIL ${msg}`);
}

function warn(msg) {
  console.warn(`WARN ${msg}`);
}

function requireEnv(name) {
  const value = env(name);
  if (!value) {
    throw new Error(`missing required env: ${name}`);
  }
  return value;
}

function normalizeBaseUrl(url) {
  return url.replace(/\/+$/, "");
}

function isLocalhostUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

async function safeFetch(url, init) {
  try {
    return await fetch(url, init);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`fetch failed for ${url}: ${message}`);
  }
}

async function resolveReachableBaseUrl() {
  const configured = normalizeBaseUrl(requireEnv("COMPREHENSIVE_PASS_BASE_URL"));
  const fallback = normalizeBaseUrl(env("NEXT_PUBLIC_APP_URL"));
  const probeRoute = "/api/reminders/send";

  try {
    await safeFetch(`${configured}${probeRoute}`);
    return configured;
  } catch (error) {
    if (!fallback || fallback === configured || !isLocalhostUrl(configured)) {
      throw error;
    }
    warn(`base url ${configured} unreachable; retrying with NEXT_PUBLIC_APP_URL=${fallback}`);
    await safeFetch(`${fallback}${probeRoute}`);
    return fallback;
  }
}

// Keep in sync with scripts/cron-canary.mjs CRON_ROUTE_EXPECTED_KEYS.
const CRON_ROUTE_EXPECTED_KEYS = new Map([
  ["/api/reminders/send", ["sent", "candidates", "skipped_no_email"]],
  ["/api/reports/send-summaries", ["durationMs"]],
  ["/api/reports/capture-metrics", ["durationMs", "updated"]],
  ["/api/webhooks/dispatch", ["durationMs"]],
  ["/api/tasks/run-rules", ["durationMs"]],
  ["/api/contracts/recompute-signals", ["durationMs"]],
  ["/api/integrations/calendar/sync", ["durationMs"]],
  ["/api/integrations/crm/sync", ["durationMs"]],
  ["/api/integrations/refresh-tokens", ["durationMs"]],
  ["/api/notifications/retry-deliveries", ["durationMs", "scanned"]],
  ["/api/maintenance/prune-operational-data", ["durationMs"]],
  ["/api/cron/stripe-webhook-events", ["durationMs"]],
  ["/api/cron/v4/approvals-sla", ["durationMs", "evaluated", "breaches"]],
  ["/api/cron/v4/attestations-issue", ["durationMs", "issued"]],
  ["/api/cron/v4/escalations-dispatch", ["durationMs", "dispatched"]],
  ["/api/cron/v4/evidence-followup", ["durationMs", "reviewed", "exceptionsCreated"]],
  ["/api/cron/v4/exceptions-detect", ["durationMs", "detected"]],
  ["/api/cron/v4/programs-reconcile", ["durationMs", "reconciledPrograms"]],
  ["/api/cron/v4/renewals-recompute-signals", ["durationMs", "updatedSignals"]],
  ["/api/cron/v4/report-packs-generate", ["durationMs", "generated"]],
]);

async function getLocalLatestMigration() {
  const dir = path.join(cwd, "supabase", "migrations");
  const entries = await fs.readdir(dir);
  const versions = entries
    .map((name) => name.match(/^(\d+)_/))
    .filter(Boolean)
    .map((match) => Number(match[1]));
  return Math.max(...versions);
}

async function getRemoteLatestMigration(url, serviceRoleKey) {
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const candidates = [
    { schema: "supabase_migrations", table: "schema_migrations" },
    { schema: "auth", table: "schema_migrations" },
    { schema: "realtime", table: "schema_migrations" },
  ];
  const errors = [];

  for (const source of candidates) {
    const { data, error } = await admin
      .schema(source.schema)
      .from(source.table)
      .select("version")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      errors.push(`${source.schema}.${source.table}: ${error.message}`);
      continue;
    }
    const version = Number(data?.version ?? 0);
    if (Number.isFinite(version)) return version;
  }

  throw new Error(`unable to read remote migration version: ${errors.join(" | ")}`);
}

function isSchemaExposureError(message) {
  const normalized = message.toLowerCase();
  return normalized.includes("invalid schema");
}

async function checkCronAuthAndHealth(baseUrl, cronSecret) {
  const cronRoutes = [...CRON_ROUTE_EXPECTED_KEYS.keys()];

  for (const route of cronRoutes) {
    const isV4Route = route.startsWith("/api/cron/v4/");
    const unsigned = await safeFetch(`${baseUrl}${route}`);
    if (isV4Route && unsigned.status === 404) {
      warn(`${route}: route unavailable on target base URL; skipping V4 route check`);
      continue;
    }
    if (unsigned.status !== 401) {
      throw new Error(`${route}: expected unsigned 401, got ${unsigned.status}`);
    }
    ok(`${route} rejects unsigned access`);

    const signed = await safeFetch(`${baseUrl}${route}`, {
      headers: { "x-cron-secret": cronSecret },
    });
    if (isV4Route && signed.status === 404) {
      warn(`${route}: route unavailable on target base URL; skipping V4 route check`);
      continue;
    }
    if (signed.status >= 400) {
      const bodyText = await signed.text();
      throw new Error(`${route}: signed request failed ${signed.status} ${bodyText.slice(0, 300)}`);
    }
    const contentType = signed.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      throw new Error(`${route}: expected JSON response, got content-type ${contentType}`);
    }
    const body = await signed.json();
    const expectedKeys = CRON_ROUTE_EXPECTED_KEYS.get(route) ?? [];
    for (const key of expectedKeys) {
      if (!(key in body)) {
        throw new Error(`${route}: response missing expected key "${key}"`);
      }
    }
    if ("ok" in body && body.ok !== true) {
      warn(`${route}: response reported ok=false (degraded business outcome)`);
    }
    ok(`${route} signed run is healthy (${signed.status})`);
  }
}

async function checkRlsSanity(url, anonKey, email, password) {
  const userClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authErr } = await userClient.auth.signInWithPassword({
    email,
    password,
  });
  if (authErr) throw new Error(`RLS sanity auth failed: ${authErr.message}`);
  const userId = authData.user?.id;
  if (!userId) throw new Error("RLS sanity auth failed: missing user id");

  const checks = [
    {
      label: "organization_members",
      run: () => userClient.from("organization_members").select("id").eq("user_id", userId).limit(1),
    },
    {
      label: "notification_deliveries",
      run: () => userClient.from("notification_deliveries").select("id, status").limit(1),
    },
    {
      label: "contract_tasks",
      run: () => userClient.from("contract_tasks").select("id, status").limit(1),
    },
    {
      label: "contract_obligations",
      run: () => userClient.from("contract_obligations").select("id, status").limit(1),
    },
    {
      label: "contract_approvals",
      run: () => userClient.from("contract_approvals").select("id, status").limit(1),
    },
  ];

  for (const check of checks) {
    const { error } = await check.run();
    if (error) {
      throw new Error(`RLS sanity ${check.label} failed: ${error.code ?? ""} ${error.message}`);
    }
    ok(`RLS sanity ${check.label} query succeeded`);
  }
}

async function main() {
  const localLatest = await getLocalLatestMigration();
  ok(`local migration head ${localLatest}`);

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  try {
    const remoteLatest = await getRemoteLatestMigration(supabaseUrl, serviceRole);
    if (remoteLatest < localLatest) {
      throw new Error(`remote migration head ${remoteLatest} is behind local ${localLatest}`);
    }
    ok(`remote migration head ${remoteLatest} is at/above local ${localLatest}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!isSchemaExposureError(message)) {
      throw error;
    }
    // Some Supabase projects do not expose migration schemas through PostgREST.
    // Keep the release gate running other checks instead of hard failing here.
    warn(`skipping remote migration head check (${message})`);
  }

  const baseUrl = await resolveReachableBaseUrl();
  const cronSecret = requireEnv("CRON_SECRET");
  await checkCronAuthAndHealth(baseUrl, cronSecret);

  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const rlsEmail = requireEnv("COMPREHENSIVE_PASS_EMAIL");
  const rlsPassword = requireEnv("COMPREHENSIVE_PASS_PASSWORD");
  await checkRlsSanity(supabaseUrl, anonKey, rlsEmail, rlsPassword);

  ok("comprehensive pass checks finished");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
