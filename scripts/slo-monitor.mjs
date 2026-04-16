import process from "node:process";
import { createClient } from "@supabase/supabase-js";

function env(name) {
  return (process.env[name] ?? "").trim();
}

function requireEnv(name) {
  const value = env(name);
  if (!value) throw new Error(`missing required env: ${name}`);
  return value;
}

function pass(msg) {
  console.log(`PASS ${msg}`);
}

function warn(msg) {
  console.warn(`WARN ${msg}`);
}

function fail(msg) {
  console.error(`FAIL ${msg}`);
}

const diagnostics = {
  generatedAt: new Date().toISOString(),
  checks: [],
};

async function main() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = Date.now();
  const since24hIso = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  // 1) Delivery success-rate (24h)
  const [{ count: delivered24h, error: deliveredErr }, { count: failed24h, error: failedErr }] =
    await Promise.all([
      admin
        .from("notification_deliveries")
        .select("id", { count: "exact", head: true })
        .eq("status", "delivered")
        .gte("created_at", since24hIso),
      admin
        .from("notification_deliveries")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed")
        .gte("created_at", since24hIso),
    ]);

  if (deliveredErr) throw new Error(`delivered24h query failed: ${deliveredErr.message}`);
  if (failedErr) throw new Error(`failed24h query failed: ${failedErr.message}`);

  const delivered = delivered24h ?? 0;
  const failed = failed24h ?? 0;
  const total = delivered + failed;
  const successRate = total === 0 ? 100 : (delivered / total) * 100;

  pass(`delivery 24h: delivered=${delivered}, failed=${failed}, successRate=${successRate.toFixed(1)}%`);
  diagnostics.checks.push({
    name: "delivery_success_rate_24h",
    delivered,
    failed,
    successRate: Number(successRate.toFixed(2)),
  });

  // Thresholds from docs.
  if (total >= 20 && successRate < 80) {
    throw new Error(`critical: delivery success rate below 80% (${successRate.toFixed(1)}%)`);
  }
  if (total >= 20 && successRate < 90) {
    warn(`warning: delivery success rate below 90% (${successRate.toFixed(1)}%)`);
  }

  // 2) Retry queue depth
  const [{ count: pending, error: pendingErr }, { count: retrying, error: retryingErr }] = await Promise.all([
    admin
      .from("notification_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    admin
      .from("notification_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("status", "retrying"),
  ]);

  if (pendingErr) throw new Error(`pending query failed: ${pendingErr.message}`);
  if (retryingErr) throw new Error(`retrying query failed: ${retryingErr.message}`);

  const queueDepth = (pending ?? 0) + (retrying ?? 0);
  pass(`retry queue depth=${queueDepth} (pending=${pending ?? 0}, retrying=${retrying ?? 0})`);
  diagnostics.checks.push({
    name: "retry_queue_depth",
    pending: pending ?? 0,
    retrying: retrying ?? 0,
    queueDepth,
  });

  if (queueDepth >= 50) {
    throw new Error(`critical: retry queue depth too high (${queueDepth})`);
  }
  if (queueDepth >= 25) {
    warn(`warning: retry queue elevated (${queueDepth})`);
  }

  // 3) Retry worker heartbeat freshness
  const { data: heartbeatRow, error: heartbeatErr } = await admin
    .from("audit_events")
    .select("created_at")
    .eq("action", "notifications.retry_deliveries_run")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (heartbeatErr) throw new Error(`heartbeat query failed: ${heartbeatErr.message}`);
  if (!heartbeatRow?.created_at) throw new Error("critical: no retry-worker heartbeat found");

  const heartbeatAgeMin = Math.round((now - new Date(heartbeatRow.created_at).getTime()) / 60000);
  pass(`retry heartbeat age=${heartbeatAgeMin}m`);
  diagnostics.checks.push({
    name: "retry_worker_heartbeat_age_minutes",
    heartbeatAgeMin,
  });

  if (heartbeatAgeMin > 30) {
    throw new Error(`critical: retry-worker heartbeat stale (${heartbeatAgeMin}m)`);
  }

  pass("slo-monitor completed");
  console.log(JSON.stringify({ ok: true, ...diagnostics }, null, 2));
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  diagnostics.checks.push({ name: "failure", message });
  console.log(JSON.stringify({ ok: false, ...diagnostics }, null, 2));
  fail(message);
  process.exit(1);
});
