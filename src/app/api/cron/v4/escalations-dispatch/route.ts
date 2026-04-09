import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { ensureCronAuthorized } from "@/lib/v4/cron";
import { RATE_LIMITS, rateLimitCheck } from "@/lib/rate-limit";
import { pingCronHealthcheck } from "@/lib/observability/cron-healthcheck";
import { enqueueOutboundEvent } from "@/lib/integrations/events";
import { recordAutomationEvent } from "@/lib/v4/automation-audit";

export async function GET(request: Request) {
  const startedAt = Date.now();
  const unauthorized = ensureCronAuthorized(request);
  if (unauthorized) return unauthorized;
  const rate = await rateLimitCheck("cron:v4:escalations-dispatch", RATE_LIMITS.v4EscalationDispatchCron);
  if (!rate.ok) {
    return NextResponse.json({ error: "Too many requests", retryAfterMs: rate.retryAfterMs }, { status: 429 });
  }

  const admin = await createAdminClient();
  const escalationCutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: rows } = await admin
    .from("exceptions")
    .select("id, organization_id, contract_id")
    .in("status", ["open", "in_progress"])
    .eq("severity", "critical")
    .or(`last_escalated_at.is.null,last_escalated_at.lt.${escalationCutoffIso}`)
    .limit(300);

  const escalatedIds: string[] = [];
  for (const row of rows ?? []) {
    const enqueued = await enqueueOutboundEvent({
      organizationId: row.organization_id,
      eventType: "exception.escalated",
      entityType: "exception",
      entityId: row.id,
      payload: { contract_id: row.contract_id, reason: "critical_exception" },
      schemaVersion: "v1",
    });
    if (!enqueued) continue;
    await recordAutomationEvent({
      admin,
      organizationId: row.organization_id,
      contractId: row.contract_id,
      action: "escalation_dispatch",
      entityType: "exception",
      entityId: row.id,
      details: { reason: "critical_exception" },
    });
    escalatedIds.push(row.id);
  }

  if (escalatedIds.length > 0) {
    await admin.from("exceptions").update({ last_escalated_at: new Date().toISOString() }).in("id", escalatedIds);
  }

  const payload = { dispatched: escalatedIds.length, ok: true, durationMs: Date.now() - startedAt };
  pingCronHealthcheck("cron/v4/escalations-dispatch", payload);
  return NextResponse.json(payload);
}
