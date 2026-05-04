import { withCronRoute } from "@/lib/cron/route-runner";
import { RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withCronRoute({
  route: "/api/cron/v10/runtime-artifact-cleanup",
  healthcheckRoute: "cron/v10/runtime-artifact-cleanup",
  rateLimitKey: "cron:v10:runtime-artifact-cleanup",
  rateLimit: RATE_LIMITS.maintenancePruneCron,
  handler: async ({ admin }) => {
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
      return {
        status: 500,
        ok: false,
        errorsCount: 1,
        pingReason: "cleanup_failed",
        body: {
          error: "V10 runtime artifact cleanup failed",
          diagnostic_id: "v10_runtime_artifact_cleanup_failed",
        },
      };
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

    return {
      body: {
        archived_count: Number.isFinite(archivedCount) ? archivedCount : 0,
        refresh_jobs_deleted_count: Number.isFinite(refreshJobsDeletedCount) ? refreshJobsDeletedCount : 0,
        retention_cutoff: retentionCutoff,
        refresh_job_retention_cutoff: refreshJobRetentionCutoff,
        legal_hold_profile_count: legalHoldProfileCount,
      },
    };
  },
});
