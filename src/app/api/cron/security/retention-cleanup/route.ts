import { withCronRoute } from "@/lib/cron/route-runner";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { CODE_OWNED_RETENTION_POLICIES } from "@/lib/security/retention-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withCronRoute({
  route: "/api/cron/security/retention-cleanup",
  healthcheckRoute: "cron/security/retention-cleanup",
  rateLimitKey: "cron:security:retention-cleanup",
  rateLimit: RATE_LIMITS.maintenancePruneCron,
  handler: async ({ admin }) => {
    const retentionCutoff = new Date().toISOString();
    const { data, error } = await admin.rpc("cleanup_code_owned_transient_data", {
      retention_cutoff: retentionCutoff,
    });

    if (error) {
      console.error("[cron/security/retention-cleanup]", error.message);
      return {
        status: 500,
        ok: false,
        errorsCount: 1,
        pingReason: "cleanup_failed",
        body: {
          error: "Retention cleanup failed",
          diagnostic_id: "security_retention_cleanup_failed",
        },
      };
    }

    const counts = data && typeof data === "object" && !Array.isArray(data) ? data : {};
    return {
      body: {
        retention_cutoff: retentionCutoff,
        policy_count: CODE_OWNED_RETENTION_POLICIES.length,
        cleanup_counts: counts,
      },
    };
  },
});
