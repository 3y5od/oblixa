import { withCronRoute } from "@/lib/cron/route-runner";
import { RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withCronRoute({
  route: "/api/cron/v10/idempotency-cleanup",
  healthcheckRoute: "cron/v10/idempotency-cleanup",
  rateLimitKey: "cron:v10:idempotency-cleanup",
  rateLimit: RATE_LIMITS.maintenancePruneCron,
  handler: async ({ admin }) => {
    const retentionCutoff = new Date().toISOString();
    const { data, error } = await admin.rpc("cleanup_expired_v10_mutation_idempotency", {
      retention_cutoff: retentionCutoff,
    });

    if (error) {
      console.error("[cron/v10/idempotency-cleanup]", error.message);
      return {
        status: 500,
        ok: false,
        errorsCount: 1,
        pingReason: "cleanup_failed",
        body: {
          error: "V10 idempotency cleanup failed",
          diagnostic_id: "v10_idempotency_cleanup_failed",
        },
      };
    }

    const deletedCount = typeof data === "number" ? data : Number(data ?? 0);
    return {
      body: {
        deleted_count: Number.isFinite(deletedCount) ? deletedCount : 0,
        retention_cutoff: retentionCutoff,
      },
    };
  },
});
