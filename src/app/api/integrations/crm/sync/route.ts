import { NextResponse } from "next/server";
import { gateCronRequest } from "@/lib/security/cron-route-gate";
import { RATE_LIMITS, rateLimitCheck } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/server";
import { validateOutboundHttpUrl } from "@/lib/security/url-policy";
import { safeFetch } from "@/lib/security/safe-fetch";
import { pingCronHealthcheck } from "@/lib/observability/cron-healthcheck";
import { enqueueOutboundEvent } from "@/lib/integrations/events";

export async function GET(request: Request) {
  const startedAt = Date.now();
  const deny = gateCronRequest(request);
  if (deny) {
    pingCronHealthcheck("integrations/crm/sync", {
      ok: false,
      status: deny.status,
      durationMs: Date.now() - startedAt,
    });
    return deny;
  }
  const rate = await rateLimitCheck("cron:integrations:crm-sync", RATE_LIMITS.integrationCrmSync);
  if (!rate.ok) {
    return NextResponse.json({ error: "Too many requests", retryAfterMs: rate.retryAfterMs }, { status: 429 });
  }
  const admin = await createAdminClient();
  const { data: connections } = await admin
    .from("integration_connections")
    .select("id, organization_id, status, config_json")
    .eq("provider", "crm")
    .eq("status", "connected")
    .limit(100);
  const orgIds = [...new Set((connections ?? []).map((c) => c.organization_id))];
  const { data: contracts } =
    orgIds.length === 0
      ? { data: [] as Array<Record<string, unknown>> }
      : await admin
    .from("contracts")
    .select(
      "id, organization_id, title, counterparty, contract_type, status, health_status, required_next_step, annual_value, external_reference_id, source_system, region, updated_at"
    )
    .not("source_system", "is", null)
    .not("external_reference_id", "is", null)
    .in("organization_id", orgIds)
    .limit(500);
  const contractIds = (contracts ?? []).map((row) => row.id as string);
  const [{ data: renewalScenarios }, { data: openExceptions }] = await Promise.all([
    contractIds.length === 0
      ? Promise.resolve({ data: [] as Array<{ contract_id: string; scenario: string | null; workspace_status: string | null }> })
      : admin
          .from("contract_renewal_scenarios")
          .select("contract_id, scenario, workspace_status")
          .in("contract_id", contractIds),
    contractIds.length === 0
      ? Promise.resolve({ data: [] as Array<{ contract_id: string; severity: string }> })
      : admin
          .from("exceptions")
          .select("contract_id, severity")
          .in("contract_id", contractIds)
          .in("status", ["open", "in_progress"]),
  ]);
  const renewalByContract = new Map(
    (renewalScenarios ?? []).map((row) => [row.contract_id, { scenario: row.scenario, workspace_status: row.workspace_status }])
  );
  const riskByContract = new Map<string, { openExceptions: number; criticalExceptions: number }>();
  for (const row of openExceptions ?? []) {
    if (!row.contract_id) continue;
    const current = riskByContract.get(row.contract_id) ?? { openExceptions: 0, criticalExceptions: 0 };
    current.openExceptions += 1;
    if (row.severity === "critical") current.criticalExceptions += 1;
    riskByContract.set(row.contract_id, current);
  }

  const nowIso = new Date().toISOString();
  let synced = 0;
  let attempted = 0;
  let failed = 0;
  const connectionByOrg = new Map(
    (connections ?? []).map((c) => [c.organization_id, c] as const)
  );
  for (const contract of contracts ?? []) {
    const connection = connectionByOrg.get(contract.organization_id as string);
    if (!connection) continue;
    const cfg = (connection.config_json ?? {}) as {
      endpointUrl?: string;
      authHeader?: string;
      timeoutMs?: number;
    };
    if (!cfg.endpointUrl) {
      failed++;
      await admin
        .from("integration_connections")
        .update({ status: "error", last_error: "Missing config_json.endpointUrl" })
        .eq("id", connection.id);
      await admin
        .from("contracts")
        .update({ crm_sync_status: "error", crm_last_synced_at: nowIso })
        .eq("id", contract.id as string);
      await enqueueOutboundEvent({
        organizationId: contract.organization_id as string,
        eventType: "crm.sync_failed",
        entityType: "contract",
        entityId: contract.id as string,
        payload: { reason: "missing_endpoint_url" },
      });
      continue;
    }
    const endpointUrl = validateOutboundHttpUrl(cfg.endpointUrl);
    if (!endpointUrl) {
      failed++;
      await admin
        .from("integration_connections")
        .update({ status: "error", last_error: "Invalid or unsafe config_json.endpointUrl" })
        .eq("id", connection.id);
      await admin
        .from("contracts")
        .update({ crm_sync_status: "error", crm_last_synced_at: nowIso })
        .eq("id", contract.id as string);
      await enqueueOutboundEvent({
        organizationId: contract.organization_id as string,
        eventType: "crm.sync_failed",
        entityType: "contract",
        entityId: contract.id as string,
        payload: { reason: "invalid_endpoint_url" },
      });
      continue;
    }
    attempted++;
    try {
      const timeoutMs = Math.min(Math.max(Number(cfg.timeoutMs ?? 10000), 2000), 30000);
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
          renewal: renewalByContract.get(contract.id as string) ?? null,
          risk_signals: riskByContract.get(contract.id as string) ?? { openExceptions: 0, criticalExceptions: 0 },
          execution_summary: {
            health_status: contract.health_status,
            required_next_step: contract.required_next_step,
            status: contract.status,
            risk: riskByContract.get(contract.id as string) ?? { openExceptions: 0, criticalExceptions: 0 },
          },
        }),
        timeoutMs,
      });
      if (!res.ok) {
        failed++;
        await admin
          .from("contracts")
          .update({ crm_sync_status: "error", crm_last_synced_at: nowIso })
          .eq("id", contract.id as string);
        await admin
          .from("integration_connections")
          .update({ status: "error", last_error: `CRM sync failed: ${res.status}` })
          .eq("id", connection.id);
        await enqueueOutboundEvent({
          organizationId: contract.organization_id as string,
          eventType: "crm.sync_failed",
          entityType: "contract",
          entityId: contract.id as string,
          payload: { reason: "http_error", status: res.status },
        });
        continue;
      }
      const { error } = await admin
        .from("contracts")
        .update({ crm_sync_status: "ok", crm_last_synced_at: nowIso })
        .eq("id", contract.id as string);
      if (!error) {
        synced++;
        await admin
          .from("integration_connections")
          .update({ status: "connected", last_synced_at: nowIso, last_error: null })
          .eq("id", connection.id);
        await admin.from("audit_events").insert({
          organization_id: contract.organization_id as string,
          contract_id: contract.id as string,
          user_id: null,
          action: "crm.sync_ok",
          details: { synced_at: nowIso },
        });
        await enqueueOutboundEvent({
          organizationId: contract.organization_id as string,
          eventType: "crm.sync_ok",
          entityType: "contract",
          entityId: contract.id as string,
          payload: {
            synced_at: nowIso,
            source_system: contract.source_system,
            external_reference_id: contract.external_reference_id,
          },
          schemaVersion: "v1",
        });
      }
    } catch (err) {
      failed++;
      await admin
        .from("contracts")
        .update({ crm_sync_status: "error", crm_last_synced_at: nowIso })
        .eq("id", contract.id as string);
      await admin
        .from("integration_connections")
        .update({
          status: "error",
          last_error: err instanceof Error ? err.message.slice(0, 500) : "crm_sync_error",
        })
        .eq("id", connection.id);
      await enqueueOutboundEvent({
        organizationId: contract.organization_id as string,
        eventType: "crm.sync_failed",
        entityType: "contract",
        entityId: contract.id as string,
        payload: {
          reason: err instanceof Error ? err.message.slice(0, 200) : "crm_sync_error",
        },
      });
    }
  }

  const payload = {
    scanned: contracts?.length ?? 0,
    attempted,
    synced,
    failed,
    ok: failed === 0,
    durationMs: Date.now() - startedAt,
  };
  pingCronHealthcheck("integrations/crm/sync", payload);
  return NextResponse.json(payload);
}
