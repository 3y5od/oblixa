import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/security/cron-auth";
import { createAdminClient } from "@/lib/supabase/server";
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
    pingCronHealthcheck("integrations/crm/sync", {
      ok: false,
      status: 401,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      "id, organization_id, title, counterparty, contract_type, status, annual_value, external_reference_id, source_system, region, updated_at"
    )
    .not("source_system", "is", null)
    .not("external_reference_id", "is", null)
    .in("organization_id", orgIds)
    .limit(500);

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
      const controller = new AbortController();
      const timeoutMs = Math.min(Math.max(Number(cfg.timeoutMs ?? 10000), 2000), 30000);
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(endpointUrl.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cfg.authHeader ? { Authorization: cfg.authHeader } : {}),
        },
        body: JSON.stringify({
          source: "contractops",
          event: "contract.sync",
          synced_at: nowIso,
          schema_version: "v1",
          contract,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
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
