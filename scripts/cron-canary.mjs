import process from "node:process";

function env(name) {
  return (process.env[name] ?? "").trim();
}

function requireEnv(name) {
  const value = env(name);
  if (!value) {
    throw new Error(`missing required env: ${name}`);
  }
  return value;
}

function ok(msg) {
  console.log(`PASS ${msg}`);
}

function warn(msg) {
  console.warn(`WARN ${msg}`);
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
]);

async function run() {
  const baseUrl = await resolveReachableBaseUrl();
  const cronSecret = requireEnv("CRON_SECRET");

  for (const [route, expectedKeys] of CRON_ROUTE_EXPECTED_KEYS.entries()) {
    const unsigned = await safeFetch(`${baseUrl}${route}`);
    if (unsigned.status !== 401) {
      throw new Error(`${route}: expected unsigned 401, got ${unsigned.status}`);
    }
    ok(`${route} unsigned check`);

    const signed = await safeFetch(`${baseUrl}${route}`, {
      headers: { "x-cron-secret": cronSecret },
    });
    if (signed.status >= 400) {
      const bodyText = await signed.text();
      throw new Error(`${route}: signed request failed ${signed.status} ${bodyText.slice(0, 300)}`);
    }
    const body = await signed.json();
    for (const key of expectedKeys) {
      if (!(key in body)) {
        throw new Error(`${route}: missing expected key "${key}"`);
      }
    }
    if ("ok" in body && body.ok !== true) {
      warn(`${route}: ok=false (degraded business outcome)`);
    }
    ok(`${route} signed check`);
  }
}

run().catch((error) => {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
