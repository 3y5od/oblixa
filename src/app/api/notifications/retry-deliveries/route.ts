import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/security/cron-auth";
import { createAdminClient } from "@/lib/supabase/server";
import { pingCronHealthcheck } from "@/lib/observability/cron-healthcheck";
import { RATE_LIMITS, rateLimitCheck } from "@/lib/rate-limit";
import { processNotificationDeliveryRetries } from "@/lib/notification-delivery";

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return false;
  return authorizeCronRequest(request, cronSecret);
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  if (!isAuthorized(request)) {
    pingCronHealthcheck("notifications/retry-deliveries", {
      ok: false,
      status: 401,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cronRate = await rateLimitCheck(
    "cron:notifications:retry-deliveries",
    RATE_LIMITS.notificationsRetryCron
  );
  if (!cronRate.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterMs: cronRate.retryAfterMs },
      { status: 429 }
    );
  }

  const admin = await createAdminClient();
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
  const payload = {
    scanned: summary.scanned,
    delivered: summary.delivered,
    failed: summary.failed,
    retried: summary.retried,
    skipped: summary.skipped,
    organizations: summary.organizationIds.length,
    heartbeatOrganizations: heartbeatOrgIds.length,
    ok: true,
    durationMs: Date.now() - startedAt,
  };
  pingCronHealthcheck("notifications/retry-deliveries", payload);
  return NextResponse.json(payload);
}
