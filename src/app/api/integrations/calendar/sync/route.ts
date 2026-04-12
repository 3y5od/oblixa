import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/security/cron-auth";
import { RATE_LIMITS, rateLimitCheck } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/server";
import { buildOrganizationCalendarIcs } from "@/lib/integrations/calendar";
import { validateOutboundHttpUrl } from "@/lib/security/url-policy";
import { pingCronHealthcheck } from "@/lib/observability/cron-healthcheck";
import { enqueueOutboundEvent } from "@/lib/integrations/events";

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return false;
  return authorizeCronRequest(request, cronSecret);
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  if (!isAuthorized(request)) {
    pingCronHealthcheck("integrations/calendar/sync", {
      ok: false,
      status: 401,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rate = await rateLimitCheck("cron:integrations:calendar-sync", RATE_LIMITS.integrationCalendarSync);
  if (!rate.ok) {
    return NextResponse.json({ error: "Too many requests", retryAfterMs: rate.retryAfterMs }, { status: 429 });
  }
  const admin = await createAdminClient();
  const { data: rows } = await admin
    .from("integration_connections")
    .select("id, organization_id, provider, status, config_json")
    .in("provider", ["google_calendar", "outlook_calendar"])
    .limit(100);

  const nowIso = new Date().toISOString();
  let updated = 0;
  let attempted = 0;
  let failed = 0;
  for (const row of rows ?? []) {
    if (row.status !== "connected") continue;
    attempted++;
    const cfg = (row.config_json ?? {}) as {
      pushUrl?: string;
      authHeader?: string;
      timeoutMs?: number;
      includeReminders?: boolean;
      includeObligations?: boolean;
      includeRenewalCheckpoints?: boolean;
      includeRenewalDecisions?: boolean;
    };
    if (!cfg.pushUrl) {
      failed++;
      await admin
        .from("integration_connections")
        .update({ status: "error", last_error: "Missing config_json.pushUrl" })
        .eq("id", row.id);
      await enqueueOutboundEvent({
        organizationId: row.organization_id,
        eventType: "calendar.sync_failed",
        entityType: "integration_connection",
        entityId: row.id,
        payload: { reason: "missing_push_url" },
      });
      continue;
    }
    const pushUrl = validateOutboundHttpUrl(cfg.pushUrl);
    if (!pushUrl) {
      failed++;
      await admin
        .from("integration_connections")
        .update({ status: "error", last_error: "Invalid or unsafe config_json.pushUrl" })
        .eq("id", row.id);
      await enqueueOutboundEvent({
        organizationId: row.organization_id,
        eventType: "calendar.sync_failed",
        entityType: "integration_connection",
        entityId: row.id,
        payload: { reason: "invalid_push_url" },
      });
      continue;
    }
    try {
      const ics = await buildOrganizationCalendarIcs(admin, row.organization_id, {
        includeReminders: cfg.includeReminders ?? true,
        includeObligations: cfg.includeObligations ?? true,
        includeRenewalCheckpoints: cfg.includeRenewalCheckpoints ?? true,
        includeRenewalDecisions: cfg.includeRenewalDecisions ?? true,
      });
      const controller = new AbortController();
      const timeoutMs = Math.min(Math.max(Number(cfg.timeoutMs ?? 10000), 2000), 30000);
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(pushUrl.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "text/calendar; charset=utf-8",
          ...(cfg.authHeader ? { Authorization: cfg.authHeader } : {}),
        },
        body: ics,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        failed++;
        await admin
          .from("integration_connections")
          .update({
            status: "error",
            last_error: `Calendar push failed: ${res.status}`,
          })
          .eq("id", row.id);
        await enqueueOutboundEvent({
          organizationId: row.organization_id,
          eventType: "calendar.sync_failed",
          entityType: "integration_connection",
          entityId: row.id,
          payload: { reason: "http_error", status: res.status },
        });
        continue;
      }
      const { error } = await admin
        .from("integration_connections")
        .update({ status: "connected", last_synced_at: nowIso, last_error: null })
        .eq("id", row.id);
      if (!error) updated++;
      if (!error) {
        await enqueueOutboundEvent({
          organizationId: row.organization_id,
          eventType: "calendar.sync_ok",
          entityType: "integration_connection",
          entityId: row.id,
          payload: { synced_at: nowIso },
          schemaVersion: "v1",
        });
      }
    } catch (err) {
      failed++;
      await admin
        .from("integration_connections")
        .update({
          status: "error",
          last_error: err instanceof Error ? err.message.slice(0, 500) : "calendar_sync_error",
        })
        .eq("id", row.id);
      await enqueueOutboundEvent({
        organizationId: row.organization_id,
        eventType: "calendar.sync_failed",
        entityType: "integration_connection",
        entityId: row.id,
        payload: {
          reason: err instanceof Error ? err.message.slice(0, 200) : "calendar_sync_error",
        },
      });
    }
  }

  const payload = {
    scanned: rows?.length ?? 0,
    attempted,
    updated,
    failed,
    ok: failed === 0,
    durationMs: Date.now() - startedAt,
  };
  const orgIds = [...new Set((rows ?? []).map((row) => row.organization_id))];
  if (orgIds.length > 0) {
    await admin.from("audit_events").insert(
      orgIds.map((organizationId) => ({
        organization_id: organizationId,
        contract_id: null,
        user_id: null,
        action: "integration.calendar_sync_run",
        details: payload,
      }))
    );
  }
  pingCronHealthcheck("integrations/calendar/sync", payload);
  return NextResponse.json(payload);
}
