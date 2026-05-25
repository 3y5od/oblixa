import { withCronRoute } from "@/lib/cron/route-runner";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { recordAutomationEvent } from "@/lib/contract-operations/automation-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withCronRoute({
  route: "/api/cron/v4/renewals-recompute-signals",
  healthcheckRoute: "cron/v4/renewals-recompute-signals",
  rateLimitKey: "cron:v4:renewals-recompute-signals",
  rateLimit: RATE_LIMITS.v4RenewalSignalsCron,
  handler: async ({ admin }) => {
    const today = new Date().toISOString().slice(0, 10);
    const { data: rows } = await admin
      .from("contract_renewal_checkpoints")
      .select("id, organization_id, contract_id")
      .eq("status", "pending")
      .lt("due_date", today)
      .limit(1000);

    if ((rows?.length ?? 0) > 0) {
      await admin
        .from("contract_renewal_checkpoints")
        .update({ renewal_state: "slipped" })
        .in("id", (rows ?? []).map((r) => r.id));
      for (const row of rows ?? []) {
        await recordAutomationEvent({
          admin,
          organizationId: row.organization_id,
          contractId: row.contract_id,
          action: "renewal_signals_recompute",
          entityType: "renewal_checkpoint",
          entityId: row.id,
          details: { renewal_state: "slipped" },
        });
      }
    }

    return {
      body: {
        updatedSignals: rows?.length ?? 0,
      },
    };
  },
});
