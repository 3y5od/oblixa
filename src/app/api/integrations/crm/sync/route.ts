import { withCronRoute } from "@/lib/cron/route-runner";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { isKillIntegrationSync, killSwitchJsonResponse } from "@/lib/security/kill-switches";
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
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => PromiseLike<{ error: { message: string } | null }>;
      };
    };
  };
};

type RenewalScenarioRow = {
  contract_id: string | null;
  scenario: unknown;
  workspace_status: unknown;
};

function appendRouteError(
  errors: Array<Record<string, unknown>>,
  input: {
    diagnosticId: string;
    phase: string;
    message: string;
    organizationId?: string;
    connectionId?: string;
    contractId?: string;
    status?: number;
  }
) {
  errors.push({
    diagnostic_id: input.diagnosticId,
    phase: input.phase,
    message: input.message,
    ...(input.organizationId ? { organization_id: input.organizationId } : {}),
    ...(input.connectionId ? { connection_id: input.connectionId } : {}),
    ...(input.contractId ? { contract_id: input.contractId } : {}),
    ...(typeof input.status === "number" ? { status: input.status } : {}),
  });
}

async function updateConnectionState(
  admin: PersistAdmin,
  connectionId: string,
  payload: Record<string, unknown>,
  errors: Array<Record<string, unknown>>,
  detail: { diagnosticId: string; message: string; organizationId: string }
) {
  const { error } = await admin
    .from("integration_connections")
    .update(payload)
    .eq("id", connectionId)
    .eq("organization_id", detail.organizationId);
  if (error) {
    appendRouteError(errors, {
      diagnosticId: detail.diagnosticId,
      phase: "persist",
      message: detail.message,
      organizationId: detail.organizationId,
      connectionId,
    });
    return false;
  }
  return true;
}

async function updateContractState(
  admin: PersistAdmin,
  contractId: string,
  payload: Record<string, unknown>,
  errors: Array<Record<string, unknown>>,
  detail: { diagnosticId: string; message: string; organizationId: string }
) {
  const { error } = await admin
    .from("contracts")
    .update(payload)
    .eq("id", contractId)
    .eq("organization_id", detail.organizationId);
  if (error) {
    appendRouteError(errors, {
      diagnosticId: detail.diagnosticId,
      phase: "persist",
      message: detail.message,
      organizationId: detail.organizationId,
      contractId,
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
      contractId: typeof detail.contractId === "string" ? detail.contractId : undefined,
    });
  }
}

export const GET = withCronRoute({
  route: "/api/integrations/crm/sync",
  healthcheckRoute: "integrations/crm/sync",
  rateLimitKey: "cron:integrations:crm-sync",
  rateLimit: RATE_LIMITS.integrationCrmSync,
  preflight: () => (isKillIntegrationSync() ? killSwitchJsonResponse("integration_sync") : null),
  handler: async ({ admin }) => {
    const nowIso = new Date().toISOString();
    const errors: Array<Record<string, unknown>> = [];
    const connections: Array<Record<string, unknown>> = [];
    let connectionsScanned = 0;
    let synced = 0;
    let attempted = 0;
    let failed = 0;
    let scanned = 0;
    const connectionPageResult = await forEachSupabaseRangePage(
      (from, to) =>
        admin
          .from("integration_connections")
          .select("id, organization_id, status, config_json")
          .eq("provider", "crm")
          .eq("status", "connected")
          .range(from, to),
      async (chunk) => {
        connectionsScanned += chunk.length;
        connections.push(...chunk);
      },
      { pageSize: 100 }
    );
    if (connectionPageResult.error && connections.length === 0) {
      return {
        status: 500,
        ok: false,
        errorsCount: 1,
        phase: "source_query",
        body: {
          error: "Failed to load CRM integration connections",
          diagnostic_id: "integrations_crm_connections_load_failed",
        },
      };
    }
    if (connectionPageResult.error) {
      appendRouteError(errors, {
        diagnosticId: "integrations_crm_connections_load_failed",
        phase: "source_query",
        message: connectionPageResult.error.message,
      });
    }
    if (connectionPageResult.stoppedByOffsetCap) {
      appendRouteError(errors, {
        diagnosticId: "integrations_crm_connections_scan_truncated",
        phase: "source_query",
        message: "CRM connection scan stopped at pagination offset cap",
      });
    }
    const orgIds = [...new Set(connections.map((c) => String(c.organization_id)))];
    const connectionByOrg = new Map((connections ?? []).map((c) => [c.organization_id, c] as const));
    const contractPageResult =
      orgIds.length === 0
        ? { error: null, stoppedByOffsetCap: false, rowsSeen: 0, nextOffset: null }
        : await forEachSupabaseRangePage(
            (from, to) =>
              admin
                .from("contracts")
                .select(
                  "id, organization_id, title, counterparty, contract_type, status, health_status, required_next_step, annual_value, external_reference_id, source_system, region, updated_at"
                )
                .not("source_system", "is", null)
                .not("external_reference_id", "is", null)
                .in("organization_id", orgIds)
                .range(from, to),
            async (chunk) => {
              scanned += chunk.length;
              const contractIds = chunk.map((row) => String(row.id));
              const [{ data: renewalScenarios, error: renewalError }, { data: openExceptions, error: openExceptionsError }] =
                await Promise.all([
                  contractIds.length === 0
                    ? Promise.resolve({ data: [], error: null })
                    : admin
                        .from("contract_renewal_scenarios")
                        .select("contract_id, scenario, workspace_status")
                        .in("contract_id", contractIds),
                  contractIds.length === 0
                    ? Promise.resolve({ data: [], error: null })
                    : admin
                        .from("exceptions")
                        .select("contract_id, severity")
                        .in("contract_id", contractIds)
                        .in("status", ["open", "in_progress"]),
                ]);

              if (renewalError || openExceptionsError) {
                failed += chunk.length;
                if (renewalError) {
                  appendRouteError(errors, {
                    diagnosticId: "integrations_crm_renewal_signals_load_failed",
                    phase: "source_query",
                    message: renewalError.message,
                  });
                }
                if (openExceptionsError) {
                  appendRouteError(errors, {
                    diagnosticId: "integrations_crm_exception_signals_load_failed",
                    phase: "source_query",
                    message: openExceptionsError.message,
                  });
                }
                return;
              }

              const renewalByContract = new Map(
                (renewalScenarios ?? []).map((row) => {
                  const typedRow = row as RenewalScenarioRow;
                  return [typedRow.contract_id, { scenario: typedRow.scenario, workspace_status: typedRow.workspace_status }] as const;
                })
              );
              const riskByContract = new Map<string, { openExceptions: number; criticalExceptions: number }>();
              for (const row of openExceptions ?? []) {
                if (!row.contract_id) continue;
                const current = riskByContract.get(String(row.contract_id)) ?? { openExceptions: 0, criticalExceptions: 0 };
                current.openExceptions += 1;
                if (row.severity === "critical") current.criticalExceptions += 1;
                riskByContract.set(String(row.contract_id), current);
              }

              for (const contract of chunk) {
                const contractId = String(contract.id);
                const organizationId = String(contract.organization_id);
                const connection = connectionByOrg.get(contract.organization_id as string);
                if (!connection) continue;
                const cfg = (connection.config_json ?? {}) as {
                  endpointUrl?: string;
                  authHeader?: string;
                  timeoutMs?: number;
                };
                if (!cfg.endpointUrl) {
                  failed++;
                  await updateConnectionState(
                    admin,
                    String(connection.id),
                    { status: "error", last_error: "Missing config_json.endpointUrl" },
                    errors,
                    {
                      diagnosticId: "integrations_crm_connection_error_write_failed",
                      message: "Failed to persist missing CRM endpoint state",
                      organizationId,
                    }
                  );
                  await updateContractState(
                    admin,
                    contractId,
                    { crm_sync_status: "error", crm_last_synced_at: nowIso },
                    errors,
                    {
                      diagnosticId: "integrations_crm_contract_error_write_failed",
                      message: "Failed to persist CRM contract error state",
                      organizationId,
                    }
                  );
                  appendRouteError(errors, {
                    diagnosticId: "integrations_crm_missing_endpoint_url",
                    phase: "preflight",
                    message: "Missing config_json.endpointUrl",
                    organizationId,
                    connectionId: String(connection.id),
                    contractId,
                  });
                  await enqueueEventSafely(
                    errors,
                    {
                      diagnosticId: "integrations_crm_failure_event_enqueue_failed",
                      message: "Failed to enqueue CRM failure event",
                      organizationId,
                      connectionId: String(connection.id),
                      contractId,
                    },
                    () =>
                      enqueueOutboundEvent({
                        organizationId,
                        eventType: "crm.sync_failed",
                        entityType: "contract",
                        entityId: contractId,
                        payload: { reason: "missing_endpoint_url" },
                      })
                  );
                  continue;
                }
                const endpointUrl = validateOutboundHttpUrl(cfg.endpointUrl);
                if (!endpointUrl) {
                  failed++;
                  await updateConnectionState(
                    admin,
                    String(connection.id),
                    { status: "error", last_error: "Invalid or unsafe config_json.endpointUrl" },
                    errors,
                    {
                      diagnosticId: "integrations_crm_connection_error_write_failed",
                      message: "Failed to persist invalid CRM endpoint state",
                      organizationId,
                    }
                  );
                  await updateContractState(
                    admin,
                    contractId,
                    { crm_sync_status: "error", crm_last_synced_at: nowIso },
                    errors,
                    {
                      diagnosticId: "integrations_crm_contract_error_write_failed",
                      message: "Failed to persist CRM contract error state",
                      organizationId,
                    }
                  );
                  appendRouteError(errors, {
                    diagnosticId: "integrations_crm_invalid_endpoint_url",
                    phase: "preflight",
                    message: "Invalid or unsafe config_json.endpointUrl",
                    organizationId,
                    connectionId: String(connection.id),
                    contractId,
                  });
                  await enqueueEventSafely(
                    errors,
                    {
                      diagnosticId: "integrations_crm_failure_event_enqueue_failed",
                      message: "Failed to enqueue CRM failure event",
                      organizationId,
                      connectionId: String(connection.id),
                      contractId,
                    },
                    () =>
                      enqueueOutboundEvent({
                        organizationId,
                        eventType: "crm.sync_failed",
                        entityType: "contract",
                        entityId: contractId,
                        payload: { reason: "invalid_endpoint_url" },
                      })
                  );
                  continue;
                }
                attempted++;
                try {
                  const timeoutMs = Math.min(Math.max(Number(cfg.timeoutMs ?? 10000), 2000), 30000);
                  const risk = riskByContract.get(contractId) ?? { openExceptions: 0, criticalExceptions: 0 };
                  const res = await safeFetch(endpointUrl.toString(), {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      ...(cfg.authHeader ? { Authorization: cfg.authHeader } : {}),
                    },
                    body: JSON.stringify({
                      source: "oblixa",
                      event: "contract.sync",
                      synced_at: nowIso,
                      schema_version: "v1",
                      contract,
                      renewal: renewalByContract.get(contractId) ?? null,
                      risk_signals: risk,
                      execution_summary: {
                        health_status: contract.health_status,
                        required_next_step: contract.required_next_step,
                        status: contract.status,
                        risk,
                      },
                    }),
                    timeoutMs,
                  });
                  if (!res.ok) {
                    failed++;
                    await updateContractState(
                      admin,
                      contractId,
                      { crm_sync_status: "error", crm_last_synced_at: nowIso },
                      errors,
                      {
                        diagnosticId: "integrations_crm_contract_error_write_failed",
                        message: "Failed to persist CRM contract HTTP failure",
                        organizationId,
                      }
                    );
                    await updateConnectionState(
                      admin,
                      String(connection.id),
                      { status: "error", last_error: `CRM sync failed: ${res.status}` },
                      errors,
                      {
                        diagnosticId: "integrations_crm_connection_error_write_failed",
                        message: "Failed to persist CRM connection HTTP failure",
                        organizationId,
                      }
                    );
                    appendRouteError(errors, {
                      diagnosticId: "integrations_crm_sync_failed",
                      phase: "source_query",
                      message: `CRM sync failed: ${res.status}`,
                      organizationId,
                      connectionId: String(connection.id),
                      contractId,
                      status: res.status,
                    });
                    await enqueueEventSafely(
                      errors,
                      {
                        diagnosticId: "integrations_crm_failure_event_enqueue_failed",
                        message: "Failed to enqueue CRM failure event",
                        organizationId,
                        connectionId: String(connection.id),
                        contractId,
                      },
                      () =>
                        enqueueOutboundEvent({
                          organizationId,
                          eventType: "crm.sync_failed",
                          entityType: "contract",
                          entityId: contractId,
                          payload: { reason: "http_error", status: res.status },
                        })
                    );
                    continue;
                  }
                  const wroteContract = await updateContractState(
                    admin,
                    contractId,
                    { crm_sync_status: "ok", crm_last_synced_at: nowIso },
                    errors,
                    {
                      diagnosticId: "integrations_crm_contract_success_write_failed",
                      message: "Failed to persist CRM contract success state",
                      organizationId,
                    }
                  );
                  const wroteConnection = await updateConnectionState(
                    admin,
                    String(connection.id),
                    { status: "connected", last_synced_at: nowIso, last_error: null },
                    errors,
                    {
                      diagnosticId: "integrations_crm_connection_success_write_failed",
                      message: "Failed to persist CRM connection success state",
                      organizationId,
                    }
                  );
                  if (wroteContract && wroteConnection) {
                    synced++;
                    const { error: auditError } = await admin.from("audit_events").insert({
                      organization_id: organizationId,
                      contract_id: contractId,
                      user_id: null,
                      action: "crm.sync_ok",
                      details: { synced_at: nowIso },
                    });
                    if (auditError) {
                      appendRouteError(errors, {
                        diagnosticId: "integrations_crm_audit_write_failed",
                        phase: "persist",
                        message: "Failed to persist CRM sync audit event",
                        organizationId,
                        contractId,
                      });
                    }
                    await enqueueEventSafely(
                      errors,
                      {
                        diagnosticId: "integrations_crm_success_event_enqueue_failed",
                        message: "Failed to enqueue CRM success event",
                        organizationId,
                        connectionId: String(connection.id),
                        contractId,
                      },
                      () =>
                        enqueueOutboundEvent({
                          organizationId,
                          eventType: "crm.sync_ok",
                          entityType: "contract",
                          entityId: contractId,
                          payload: {
                            synced_at: nowIso,
                            source_system: contract.source_system,
                            external_reference_id: contract.external_reference_id,
                          },
                          schemaVersion: "v1",
                        })
                    );
                  }
                } catch (err) {
                  failed++;
                  await updateContractState(
                    admin,
                    contractId,
                    { crm_sync_status: "error", crm_last_synced_at: nowIso },
                    errors,
                    {
                      diagnosticId: "integrations_crm_contract_error_write_failed",
                      message: "Failed to persist CRM contract exception state",
                      organizationId,
                    }
                  );
                  await updateConnectionState(
                    admin,
                    String(connection.id),
                    {
                      status: "error",
                      last_error: err instanceof Error ? err.message.slice(0, 500) : "crm_sync_error",
                    },
                    errors,
                    {
                      diagnosticId: "integrations_crm_connection_error_write_failed",
                      message: "Failed to persist CRM connection exception state",
                      organizationId,
                    }
                  );
                  appendRouteError(errors, {
                    diagnosticId: "integrations_crm_sync_failed",
                    phase: "source_query",
                    message: err instanceof Error ? err.message.slice(0, 200) : "crm_sync_error",
                    organizationId,
                    connectionId: String(connection.id),
                    contractId,
                  });
                  await enqueueEventSafely(
                    errors,
                    {
                      diagnosticId: "integrations_crm_failure_event_enqueue_failed",
                      message: "Failed to enqueue CRM failure event",
                      organizationId,
                      connectionId: String(connection.id),
                      contractId,
                    },
                    () =>
                      enqueueOutboundEvent({
                        organizationId,
                        eventType: "crm.sync_failed",
                        entityType: "contract",
                        entityId: contractId,
                        payload: {
                          reason: err instanceof Error ? err.message.slice(0, 200) : "crm_sync_error",
                        },
                      })
                  );
                }
              }
            },
            { pageSize: 500 }
          );

    if (contractPageResult.error && scanned === 0) {
      return {
        status: 500,
        ok: false,
        errorsCount: 1,
        phase: "source_query",
        body: {
          error: "Failed to load CRM sync contracts",
          diagnostic_id: "integrations_crm_contracts_load_failed",
        },
      };
    }
    if (contractPageResult.error) {
      appendRouteError(errors, {
        diagnosticId: "integrations_crm_contracts_load_failed",
        phase: "source_query",
        message: contractPageResult.error.message,
      });
    }
    if (contractPageResult.stoppedByOffsetCap) {
      appendRouteError(errors, {
        diagnosticId: "integrations_crm_contracts_scan_truncated",
        phase: "source_query",
        message: "CRM contract scan stopped at pagination offset cap",
      });
    }

    return {
      ok: failed === 0 && errors.length === 0,
      partial: failed > 0 || errors.length > 0,
      errorsCount: errors.length,
      body: {
        scanned,
        connections_scanned: connectionsScanned,
        attempted,
        synced,
        failed,
        errors,
      },
    };
  },
});
