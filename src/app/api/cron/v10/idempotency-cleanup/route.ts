import { NextResponse } from "next/server";
import { RATE_LIMITS, rateLimitCheck } from "@/lib/rate-limit";
import { pingCronHealthcheck } from "@/lib/observability/cron-healthcheck";
import { createAdminClient } from "@/lib/supabase/server";
import { ensureCronAuthorized } from "@/lib/v4/cron";

const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const startedAt = Date.now();
  const unauthorized = ensureCronAuthorized(request);
  if (unauthorized) return unauthorized;

  const rate = await rateLimitCheck("cron:v10:idempotency-cleanup", RATE_LIMITS.maintenancePruneCron);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterMs: rate.retryAfterMs },
      { status: 429, headers: PRIVATE_NO_STORE_HEADERS }
    );
  }

  const admin = await createAdminClient();
  const retentionCutoff = new Date().toISOString();
  const { data, error } = await admin.rpc("cleanup_expired_v10_mutation_idempotency", {
    retention_cutoff: retentionCutoff,
  });

  if (error) {
    console.error("[cron/v10/idempotency-cleanup]", error.message);
    pingCronHealthcheck("cron/v10/idempotency-cleanup", {
      ok: false,
      status: 500,
      reason: "cleanup_failed",
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: "V10 idempotency cleanup failed", diagnostic_id: "v10_idempotency_cleanup_failed" },
      { status: 500, headers: PRIVATE_NO_STORE_HEADERS }
    );
  }

  const deletedCount = typeof data === "number" ? data : Number(data ?? 0);
  pingCronHealthcheck("cron/v10/idempotency-cleanup", {
    ok: true,
    status: 200,
    reason: "ok",
    durationMs: Date.now() - startedAt,
  });

  return NextResponse.json(
    {
      ok: true,
      deleted_count: Number.isFinite(deletedCount) ? deletedCount : 0,
      retention_cutoff: retentionCutoff,
    },
    { headers: PRIVATE_NO_STORE_HEADERS }
  );
}
