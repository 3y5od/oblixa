import { withCronRoute } from "@/lib/cron/route-runner";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { buildOrganizationCalendarIcs } from "@/lib/integrations/calendar";
import { validateOutboundHttpUrl } from "@/lib/security/url-policy";
import { safeFetch } from "@/lib/security/safe-fetch";
import { enqueueOutboundEvent } from "@/lib/integrations/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withCronRoute({
  route: "/api/integrations/calendar/sync",
  healthcheckRoute: "integrations/calendar/sync",
  rateLimitKey: "cron:integrations:calendar-sync",
  rateLimit: RATE_LIMITS.integrationCalendarSync,
  handler: async ({ admin, startedAtMs }) => {
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
        const timeoutMs = Math.min(Math.max(Number(cfg.timeoutMs ?? 10000), 2000), 30000);
        const res = await safeFetch(pushUrl.toString(), {
          method: "POST",
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            ...(cfg.authHeader ? { Authorization: cfg.authHeader } : {}),
          },
          body: ics,
          timeoutMs,
        });
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

    const auditPayload = {
      scanned: rows?.length ?? 0,
      attempted,
      updated,
      failed,
      ok: failed === 0,
      durationMs: Date.now() - startedAtMs,
    };
    const orgIds = [...new Set((rows ?? []).map((row) => row.organization_id))];
    if (orgIds.length > 0) {
      await admin.from("audit_events").insert(
        orgIds.map((organizationId) => ({
          organization_id: organizationId,
          contract_id: null,
          user_id: null,
          action: "integration.calendar_sync_run",
          details: auditPayload,
        }))
      );
    }

    return {
      ok: failed === 0,
      partial: failed > 0,
      errorsCount: failed,
      body: {
        scanned: rows?.length ?? 0,
        attempted,
        updated,
        failed,
      },
    };
  },
});
