import { withCronRoute } from "@/lib/cron/route-runner";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { enqueueOutboundEvent } from "@/lib/integrations/events";
import { recordAutomationEvent } from "@/lib/contract-operations/automation-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withCronRoute({
  route: "/api/cron/v4/escalations-dispatch",
  healthcheckRoute: "cron/v4/escalations-dispatch",
  rateLimitKey: "cron:v4:escalations-dispatch",
  rateLimit: RATE_LIMITS.v4EscalationDispatchCron,
  handler: async ({ admin }) => {
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

    return {
      body: {
        dispatched: escalatedIds.length,
      },
    };
  },
});
