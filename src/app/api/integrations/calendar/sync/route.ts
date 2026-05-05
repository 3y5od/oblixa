import { withCronRoute } from "@/lib/cron/route-runner";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { buildOrganizationCalendarIcs } from "@/lib/integrations/calendar";
import { validateOutboundHttpUrl } from "@/lib/security/url-policy";
import { safeFetch } from "@/lib/security/safe-fetch";
import { enqueueOutboundEvent } from "@/lib/integrations/events";
import { forEachSupabaseRangePage } from "@/lib/supabase/range-pagination";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type PersistAdmin = {
  from: (table: string) => {
    update: (payload: Record<string, unknown>) => {
      eq: (column: string, value: string) => PromiseLike<{ error: { message: string } | null }>;
    };
  };
};

function appendRouteError(
  errors: Array<Record<string, unknown>>,
  input: {
    diagnosticId: string;
    phase: string;
    message: string;
    organizationId?: string;
    connectionId?: string;
    provider?: string;
    status?: number;
  }
) {
  errors.push({
    diagnostic_id: input.diagnosticId,
    phase: input.phase,
    message: input.message,
    ...(input.organizationId ? { organization_id: input.organizationId } : {}),
    ...(input.connectionId ? { connection_id: input.connectionId } : {}),
    ...(input.provider ? { provider: input.provider } : {}),
    ...(typeof input.status === "number" ? { status: input.status } : {}),
  });
}

async function updateConnectionState(
  admin: PersistAdmin,
  connectionId: string,
  payload: Record<string, unknown>,
  errors: Array<Record<string, unknown>>,
  detail: { diagnosticId: string; message: string; organizationId?: string; provider?: string }
) {
  const { error } = await admin.from("integration_connections").update(payload).eq("id", connectionId);
  if (error) {
    appendRouteError(errors, {
      diagnosticId: detail.diagnosticId,
      phase: "persist",
      message: detail.message,
      organizationId: detail.organizationId,
      connectionId,
      provider: detail.provider,
    });
    return false;
  }
  return true;
}

async function enqueueEventSafely(errors: Array<Record<string, unknown>>, detail: Record<string, unknown>, work: () => Promise<unknown>) {
  try {
    await work();
  } catch (error) {
    appendRouteError(errors, {
      diagnosticId: String(detail.diagnosticId),
      phase: "notify",
      message: error instanceof Error ? error.message : String(detail.message ?? "notification_failed"),
      organizationId: typeof detail.organizationId === "string" ? detail.organizationId : undefined,
      connectionId: typeof detail.connectionId === "string" ? detail.connectionId : undefined,
      provider: typeof detail.provider === "string" ? detail.provider : undefined,
    });
  }
}

export const GET = withCronRoute({
  route: "/api/integrations/calendar/sync",
  healthcheckRoute: "integrations/calendar/sync",
  rateLimitKey: "cron:integrations:calendar-sync",
  rateLimit: RATE_LIMITS.integrationCalendarSync,
  handler: async ({ admin, startedAtMs }) => {
    const nowIso = new Date().toISOString();
    const errors: Array<Record<string, unknown>> = [];
    const orgIds = new Set<string>();
    let scanned = 0;
    let updated = 0;
    let attempted = 0;
    let failed = 0;
    const pageResult = await forEachSupabaseRangePage(
      (from, to) =>
        admin
          .from("integration_connections")
          .select("id, organization_id, provider, status, config_json")
          .in("provider", ["google_calendar", "outlook_calendar"])
          .range(from, to),
      async (chunk) => {
        scanned += chunk.length;
        for (const row of chunk) {
          if (row.organization_id) orgIds.add(String(row.organization_id));
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
            await updateConnectionState(
              admin,
              String(row.id),
              { status: "error", last_error: "Missing config_json.pushUrl" },
              errors,
              {
                diagnosticId: "integrations_calendar_missing_push_url_write_failed",
                message: "Failed to persist missing pushUrl state",
                organizationId: String(row.organization_id),
                provider: String(row.provider),
              }
            );
            appendRouteError(errors, {
              diagnosticId: "integrations_calendar_missing_push_url",
              phase: "preflight",
              message: "Missing config_json.pushUrl",
              organizationId: String(row.organization_id),
              connectionId: String(row.id),
              provider: String(row.provider),
            });
            await enqueueEventSafely(
              errors,
              {
                diagnosticId: "integrations_calendar_failure_event_enqueue_failed",
                message: "Failed to enqueue calendar failure event",
                organizationId: String(row.organization_id),
                connectionId: String(row.id),
                provider: String(row.provider),
              },
              () =>
                enqueueOutboundEvent({
                  organizationId: String(row.organization_id),
                  eventType: "calendar.sync_failed",
                  entityType: "integration_connection",
                  entityId: String(row.id),
                  payload: { reason: "missing_push_url" },
                })
            );
            continue;
          }
          const pushUrl = validateOutboundHttpUrl(cfg.pushUrl);
          if (!pushUrl) {
            failed++;
            await updateConnectionState(
              admin,
              String(row.id),
              { status: "error", last_error: "Invalid or unsafe config_json.pushUrl" },
              errors,
              {
                diagnosticId: "integrations_calendar_invalid_push_url_write_failed",
                message: "Failed to persist invalid pushUrl state",
                organizationId: String(row.organization_id),
                provider: String(row.provider),
              }
            );
            appendRouteError(errors, {
              diagnosticId: "integrations_calendar_invalid_push_url",
              phase: "preflight",
              message: "Invalid or unsafe config_json.pushUrl",
              organizationId: String(row.organization_id),
              connectionId: String(row.id),
              provider: String(row.provider),
            });
            await enqueueEventSafely(
              errors,
              {
                diagnosticId: "integrations_calendar_failure_event_enqueue_failed",
                message: "Failed to enqueue calendar failure event",
                organizationId: String(row.organization_id),
                connectionId: String(row.id),
                provider: String(row.provider),
              },
              () =>
                enqueueOutboundEvent({
                  organizationId: String(row.organization_id),
                  eventType: "calendar.sync_failed",
                  entityType: "integration_connection",
                  entityId: String(row.id),
                  payload: { reason: "invalid_push_url" },
                })
            );
            continue;
          }
          try {
            const ics = await buildOrganizationCalendarIcs(admin, String(row.organization_id), {
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
              await updateConnectionState(
                admin,
                String(row.id),
                { status: "error", last_error: `Calendar push failed: ${res.status}` },
                errors,
                {
                  diagnosticId: "integrations_calendar_http_failure_write_failed",
                  message: "Failed to persist calendar push HTTP failure",
                  organizationId: String(row.organization_id),
                  provider: String(row.provider),
                }
              );
              appendRouteError(errors, {
                diagnosticId: "integrations_calendar_push_failed",
                phase: "source_query",
                message: `Calendar push failed: ${res.status}`,
                organizationId: String(row.organization_id),
                connectionId: String(row.id),
                provider: String(row.provider),
                status: res.status,
              });
              await enqueueEventSafely(
                errors,
                {
                  diagnosticId: "integrations_calendar_failure_event_enqueue_failed",
                  message: "Failed to enqueue calendar failure event",
                  organizationId: String(row.organization_id),
                  connectionId: String(row.id),
                  provider: String(row.provider),
                },
                () =>
                  enqueueOutboundEvent({
                    organizationId: String(row.organization_id),
                    eventType: "calendar.sync_failed",
                    entityType: "integration_connection",
                    entityId: String(row.id),
                    payload: { reason: "http_error", status: res.status },
                  })
              );
              continue;
            }
            const wroteState = await updateConnectionState(
              admin,
              String(row.id),
              { status: "connected", last_synced_at: nowIso, last_error: null },
              errors,
              {
                diagnosticId: "integrations_calendar_success_write_failed",
                message: "Failed to persist successful calendar sync state",
                organizationId: String(row.organization_id),
                provider: String(row.provider),
              }
            );
            if (wroteState) {
              updated++;
              await enqueueEventSafely(
                errors,
                {
                  diagnosticId: "integrations_calendar_success_event_enqueue_failed",
                  message: "Failed to enqueue calendar success event",
                  organizationId: String(row.organization_id),
                  connectionId: String(row.id),
                  provider: String(row.provider),
                },
                () =>
                  enqueueOutboundEvent({
                    organizationId: String(row.organization_id),
                    eventType: "calendar.sync_ok",
                    entityType: "integration_connection",
                    entityId: String(row.id),
                    payload: { synced_at: nowIso },
                    schemaVersion: "v1",
                  })
              );
            }
          } catch (err) {
            failed++;
            await updateConnectionState(
              admin,
              String(row.id),
              {
                status: "error",
                last_error: err instanceof Error ? err.message.slice(0, 500) : "calendar_sync_error",
              },
              errors,
              {
                diagnosticId: "integrations_calendar_exception_write_failed",
                message: "Failed to persist calendar sync exception state",
                organizationId: String(row.organization_id),
                provider: String(row.provider),
              }
            );
            appendRouteError(errors, {
              diagnosticId: "integrations_calendar_sync_failed",
              phase: "source_query",
              message: err instanceof Error ? err.message.slice(0, 200) : "calendar_sync_error",
              organizationId: String(row.organization_id),
              connectionId: String(row.id),
              provider: String(row.provider),
            });
            await enqueueEventSafely(
              errors,
              {
                diagnosticId: "integrations_calendar_failure_event_enqueue_failed",
                message: "Failed to enqueue calendar failure event",
                organizationId: String(row.organization_id),
                connectionId: String(row.id),
                provider: String(row.provider),
              },
              () =>
                enqueueOutboundEvent({
                  organizationId: String(row.organization_id),
                  eventType: "calendar.sync_failed",
                  entityType: "integration_connection",
                  entityId: String(row.id),
                  payload: {
                    reason: err instanceof Error ? err.message.slice(0, 200) : "calendar_sync_error",
                  },
                })
            );
          }
        }
      },
      { pageSize: 100 }
    );

    if (pageResult.error && scanned === 0) {
      return {
        status: 500,
        ok: false,
        errorsCount: 1,
        phase: "source_query",
        body: {
          error: "Failed to load integration connections",
          diagnostic_id: "integrations_calendar_connections_load_failed",
        },
      };
    }
    if (pageResult.error) {
      appendRouteError(errors, {
        diagnosticId: "integrations_calendar_connections_load_failed",
        phase: "source_query",
        message: pageResult.error.message,
      });
    }
    if (pageResult.stoppedByOffsetCap) {
      appendRouteError(errors, {
        diagnosticId: "integrations_calendar_connections_scan_truncated",
        phase: "source_query",
        message: "Integration connection scan stopped at pagination offset cap",
      });
    }

    const auditPayload = {
      scanned,
      attempted,
      updated,
      failed,
      ok: failed === 0 && errors.length === 0,
      durationMs: Date.now() - startedAtMs,
    };
    const uniqueOrgIds = [...orgIds];
    if (uniqueOrgIds.length > 0) {
      const { error: auditError } = await admin.from("audit_events").insert(
        uniqueOrgIds.map((organizationId) => ({
          organization_id: organizationId,
          contract_id: null,
          user_id: null,
          action: "integration.calendar_sync_run",
          details: auditPayload,
        }))
      );
      if (auditError) {
        appendRouteError(errors, {
          diagnosticId: "integrations_calendar_audit_write_failed",
          phase: "persist",
          message: "Failed to persist calendar sync audit event",
        });
      }
    }

    return {
      ok: failed === 0 && errors.length === 0,
      partial: failed > 0 || errors.length > 0,
      errorsCount: errors.length,
      body: {
        scanned,
        attempted,
        updated,
        failed,
        errors,
      },
    };
  },
});
