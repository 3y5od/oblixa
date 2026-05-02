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

  const rate = await rateLimitCheck("cron:v10:runtime-artifact-cleanup", RATE_LIMITS.maintenancePruneCron);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterMs: rate.retryAfterMs },
      { status: 429, headers: PRIVATE_NO_STORE_HEADERS }
    );
  }

  const admin = await createAdminClient();
  const retentionCutoff = new Date().toISOString();
  const refreshJobRetentionCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin.rpc("cleanup_expired_v10_runtime_artifacts", {
    retention_cutoff: retentionCutoff,
  });
  const { data: refreshJobData, error: refreshJobError } = await admin.rpc("cleanup_old_v10_read_model_refresh_jobs", {
    retention_cutoff: refreshJobRetentionCutoff,
  });

  if (error || refreshJobError) {
    console.error("[cron/v10/runtime-artifact-cleanup]", error?.message ?? refreshJobError?.message);
    pingCronHealthcheck("cron/v10/runtime-artifact-cleanup", {
      ok: false,
      status: 500,
      reason: "cleanup_failed",
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: "V10 runtime artifact cleanup failed", diagnostic_id: "v10_runtime_artifact_cleanup_failed" },
      { status: 500, headers: PRIVATE_NO_STORE_HEADERS }
    );
  }

  const archivedCount = typeof data === "number" ? data : Number(data ?? 0);
  const refreshJobsDeletedCount = typeof refreshJobData === "number" ? refreshJobData : Number(refreshJobData ?? 0);

  let legalHoldProfileCount: number | null = null;
  try {
    const { count, error: lhErr } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("legal_hold", true);
    if (!lhErr && typeof count === "number") legalHoldProfileCount = count;
  } catch {
    legalHoldProfileCount = null;
  }

  pingCronHealthcheck("cron/v10/runtime-artifact-cleanup", {
    ok: true,
    status: 200,
    reason: "ok",
    durationMs: Date.now() - startedAt,
  });

  return NextResponse.json(
    {
      ok: true,
      archived_count: Number.isFinite(archivedCount) ? archivedCount : 0,
      refresh_jobs_deleted_count: Number.isFinite(refreshJobsDeletedCount) ? refreshJobsDeletedCount : 0,
      retention_cutoff: retentionCutoff,
      refresh_job_retention_cutoff: refreshJobRetentionCutoff,
      legal_hold_profile_count: legalHoldProfileCount,
    },
    { headers: PRIVATE_NO_STORE_HEADERS }
  );
}
