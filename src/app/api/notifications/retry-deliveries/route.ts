import { withCronRoute } from "@/lib/cron/route-runner";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { processNotificationDeliveryRetries } from "@/lib/notification-delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withCronRoute({
  route: "/api/notifications/retry-deliveries",
  healthcheckRoute: "notifications/retry-deliveries",
  rateLimitKey: "cron:notifications:retry-deliveries",
  rateLimit: RATE_LIMITS.notificationsRetryCron,
  handler: async ({ admin }) => {
    const summary = await processNotificationDeliveryRetries(admin, { limit: 100 });
    let heartbeatOrgIds = summary.organizationIds;
    if (heartbeatOrgIds.length === 0) {
      const { data: fallbackOrgs } = await admin
        .from("organizations")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1);
      heartbeatOrgIds = (fallbackOrgs ?? []).map((row) => row.id);
    }
    if (heartbeatOrgIds.length > 0) {
      await admin.from("audit_events").insert(
        heartbeatOrgIds.map((organizationId) => ({
          organization_id: organizationId,
          action: "notifications.retry_deliveries_run",
          details: {
            scanned: summary.scanned,
            delivered: summary.delivered,
            failed: summary.failed,
            retried: summary.retried,
            skipped: summary.skipped,
          },
        }))
      );
    }
    return {
      body: {
        scanned: summary.scanned,
        delivered: summary.delivered,
        failed: summary.failed,
        retried: summary.retried,
        skipped: summary.skipped,
        organizations: summary.organizationIds.length,
        heartbeatOrganizations: heartbeatOrgIds.length,
      },
    };
  },
});
