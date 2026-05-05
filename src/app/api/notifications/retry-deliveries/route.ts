import { withCronRoute } from "@/lib/cron/route-runner";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { processNotificationDeliveryRetries } from "@/lib/notification-delivery";
import type { BatchItemError } from "@/lib/route-runtime-contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RETRY_BATCH_SIZE = 100;
const RETRY_MAX_DRAIN_ROUNDS = 8;

export const GET = withCronRoute({
  route: "/api/notifications/retry-deliveries",
  healthcheckRoute: "notifications/retry-deliveries",
  rateLimitKey: "cron:notifications:retry-deliveries",
  rateLimit: RATE_LIMITS.notificationsRetryCron,
  handler: async ({ admin }) => {
    let scanned = 0;
    let delivered = 0;
    let failed = 0;
    let retried = 0;
    let skipped = 0;
    let rounds = 0;
    let truncated = false;
    const heartbeatOrgIdsSet = new Set<string>();
    const errors: BatchItemError[] = [];

    for (let round = 0; round < RETRY_MAX_DRAIN_ROUNDS; round += 1) {
      rounds += 1;
      const summary = await processNotificationDeliveryRetries(admin, { limit: RETRY_BATCH_SIZE });
      scanned += summary.scanned;
      delivered += summary.delivered;
      failed += summary.failed;
      retried += summary.retried;
      skipped += summary.skipped;
      for (const organizationId of summary.organizationIds) {
        heartbeatOrgIdsSet.add(organizationId);
      }
      errors.push(...(summary.errors ?? []));
      if (summary.scanned < RETRY_BATCH_SIZE) {
        break;
      }
      if (round === RETRY_MAX_DRAIN_ROUNDS - 1) {
        truncated = true;
      }
    }

    let heartbeatOrgIds = [...heartbeatOrgIdsSet];
    if (heartbeatOrgIds.length === 0) {
      const { data: fallbackOrgs, error: fallbackErr } = await admin
        .from("organizations")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1);
      if (fallbackErr) {
        errors.push({
          scope: "heartbeat_org_lookup",
          phase: "source_query",
          diagnostic_id: "notification_retry_heartbeat_org_lookup_failed",
          message: fallbackErr.message,
        });
      } else {
        heartbeatOrgIds = (fallbackOrgs ?? []).map((row) => row.id);
      }
    }
    if (heartbeatOrgIds.length > 0) {
      const auditResult = await admin.from("audit_events").insert(
        heartbeatOrgIds.map((organizationId) => ({
          organization_id: organizationId,
          action: "notifications.retry_deliveries_run",
          details: {
            scanned,
            delivered,
            failed,
            retried,
            skipped,
            truncated,
            rounds,
          },
        }))
      );
      const auditErr = auditResult?.error ?? null;
      if (auditErr) {
        errors.push({
          scope: "heartbeat_audit_insert",
          phase: "persist",
          diagnostic_id: "notification_retry_heartbeat_audit_failed",
          message: auditErr.message,
        });
      }
    }

    const errorsCount = failed + errors.length;
    return {
      partial: errorsCount > 0 || retried > 0 || truncated,
      errorsCount,
      phase: errors[0]?.phase,
      body: {
        scanned,
        delivered,
        failed,
        retried,
        skipped,
        processed: delivered,
        remaining: truncated ? RETRY_BATCH_SIZE : 0,
        truncated,
        rounds,
        organizations: heartbeatOrgIdsSet.size,
        heartbeatOrganizations: heartbeatOrgIds.length,
        ...(errors.length > 0
          ? {
              errors: errors.map((entry) => `${entry.scope}: ${entry.message}`),
              error_details: errors.slice(0, 10),
            }
          : {}),
      },
    };
  },
});
