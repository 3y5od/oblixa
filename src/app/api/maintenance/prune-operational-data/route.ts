import { withCronRoute } from "@/lib/cron/route-runner";
import { RATE_LIMITS } from "@/lib/rate-limit";

const DEFAULT_DELIVERY_RETENTION_DAYS = 120;
const DEFAULT_AUDIT_RETENTION_DAYS = 180;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function cutoffIso(days: number): string {
  const safe = Math.max(7, Math.min(3650, Math.trunc(days)));
  return new Date(Date.now() - safe * 24 * 60 * 60 * 1000).toISOString();
}

export const GET = withCronRoute({
  route: "/api/maintenance/prune-operational-data",
  healthcheckRoute: "maintenance/prune-operational-data",
  rateLimitKey: "cron:maintenance:prune-operational-data",
  rateLimit: RATE_LIMITS.maintenancePruneCron,
  handler: async ({ admin }) => {
  let deliveryDays = Number(
    process.env.OPS_RETENTION_NOTIFICATION_DELIVERIES_DAYS ?? DEFAULT_DELIVERY_RETENTION_DAYS
  );
  if (!Number.isFinite(deliveryDays)) deliveryDays = DEFAULT_DELIVERY_RETENTION_DAYS;
  let auditDays = Number(process.env.OPS_RETENTION_AUDIT_EVENTS_DAYS ?? DEFAULT_AUDIT_RETENTION_DAYS);
  if (!Number.isFinite(auditDays)) auditDays = DEFAULT_AUDIT_RETENTION_DAYS;
  const deliveryCutoff = cutoffIso(deliveryDays);
  const auditCutoff = cutoffIso(auditDays);

  const deliveriesFilter = admin
    .from("notification_deliveries")
    .select("id", { count: "exact", head: true })
    .or("status.eq.delivered,status.eq.failed,status.eq.suppressed")
    .lt("created_at", deliveryCutoff);
  const { count: deliveryCount, error: deliveryCountErr } = await deliveriesFilter;
  if (deliveryCountErr) {
    return {
      status: 500,
      ok: false,
      errorsCount: 1,
      body: { error: deliveryCountErr.message },
    };
  }
  const { error: deliveriesErr } = await admin
    .from("notification_deliveries")
    .delete()
    .or("status.eq.delivered,status.eq.failed,status.eq.suppressed")
    .lt("created_at", deliveryCutoff);
  if (deliveriesErr) {
    return {
      status: 500,
      ok: false,
      errorsCount: 1,
      body: { error: deliveriesErr.message },
    };
  }

  const trackedAuditActions = [
    "notifications.retry_deliveries_run",
    "dashboard.viewed",
    "integration.calendar_sync_run",
    "maintenance.change_events_processed",
    "maintenance.correction_campaign",
  ];
  const { count: auditCount, error: auditCountErr } = await admin
    .from("audit_events")
    .select("id", { count: "exact", head: true })
    .lt("created_at", auditCutoff)
    .in("action", trackedAuditActions);
  if (auditCountErr) {
    return {
      status: 500,
      ok: false,
      errorsCount: 1,
      body: { error: auditCountErr.message },
    };
  }

  const { error: auditErr } = await admin
    .from("audit_events")
    .delete()
    .lt("created_at", auditCutoff)
    .in("action", trackedAuditActions);
  if (auditErr) {
    return {
      status: 500,
      ok: false,
      errorsCount: 1,
      body: { error: auditErr.message },
    };
  }

    return {
      body: {
        deletedNotificationDeliveries: deliveryCount ?? 0,
        deletedAuditEvents: auditCount ?? 0,
        deliveryCutoff,
        auditCutoff,
      },
    };
  },
});
