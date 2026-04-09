import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/security/cron-auth";
import { createAdminClient } from "@/lib/supabase/server";
import { pingCronHealthcheck } from "@/lib/observability/cron-healthcheck";
import { RATE_LIMITS, rateLimitCheck } from "@/lib/rate-limit";

const DEFAULT_DELIVERY_RETENTION_DAYS = 120;
const DEFAULT_AUDIT_RETENTION_DAYS = 180;

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return false;
  return authorizeCronRequest(request, cronSecret);
}

function cutoffIso(days: number): string {
  const safe = Math.max(7, Math.min(3650, Math.trunc(days)));
  return new Date(Date.now() - safe * 24 * 60 * 60 * 1000).toISOString();
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  if (!isAuthorized(request)) {
    pingCronHealthcheck("maintenance/prune-operational-data", {
      ok: false,
      status: 401,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cronRate = await rateLimitCheck(
    "cron:maintenance:prune-operational-data",
    RATE_LIMITS.maintenancePruneCron
  );
  if (!cronRate.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterMs: cronRate.retryAfterMs },
      { status: 429 }
    );
  }

  const deliveryDays = Number(
    process.env.OPS_RETENTION_NOTIFICATION_DELIVERIES_DAYS ?? DEFAULT_DELIVERY_RETENTION_DAYS
  );
  const auditDays = Number(process.env.OPS_RETENTION_AUDIT_EVENTS_DAYS ?? DEFAULT_AUDIT_RETENTION_DAYS);
  const deliveryCutoff = cutoffIso(deliveryDays);
  const auditCutoff = cutoffIso(auditDays);
  const admin = await createAdminClient();

  const deliveriesFilter = admin
    .from("notification_deliveries")
    .select("id", { count: "exact", head: true })
    .or("status.eq.delivered,status.eq.failed,status.eq.suppressed")
    .lt("created_at", deliveryCutoff);
  const { count: deliveryCount, error: deliveryCountErr } = await deliveriesFilter;
  if (deliveryCountErr) {
    return NextResponse.json({ error: deliveryCountErr.message }, { status: 500 });
  }
  const { error: deliveriesErr } = await admin
    .from("notification_deliveries")
    .delete()
    .or("status.eq.delivered,status.eq.failed,status.eq.suppressed")
    .lt("created_at", deliveryCutoff);
  if (deliveriesErr) {
    return NextResponse.json({ error: deliveriesErr.message }, { status: 500 });
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
    return NextResponse.json({ error: auditCountErr.message }, { status: 500 });
  }

  const { error: auditErr } = await admin
    .from("audit_events")
    .delete()
    .lt("created_at", auditCutoff)
    .in("action", trackedAuditActions);
  if (auditErr) {
    return NextResponse.json({ error: auditErr.message }, { status: 500 });
  }

  const payload = {
    ok: true,
    deletedNotificationDeliveries: deliveryCount ?? 0,
    deletedAuditEvents: auditCount ?? 0,
    deliveryCutoff,
    auditCutoff,
    durationMs: Date.now() - startedAt,
  };
  pingCronHealthcheck("maintenance/prune-operational-data", payload);
  return NextResponse.json(payload);
}
