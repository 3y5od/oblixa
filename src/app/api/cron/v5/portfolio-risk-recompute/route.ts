import { withCronRoute } from "@/lib/cron/route-runner";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { requireV5CronFeature } from "@/lib/decision-intelligence/feature-guards";
import { listOrganizationIds } from "@/lib/decision-intelligence/cron";

/**
 * Writes org-level risk proxies into capacity_snapshots (by_role_json / by_program_json).
 * Name is historical: these rows feed capacity-adjacent reporting, not a separate portfolio_risk table.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withCronRoute({
  route: "/api/cron/v5/portfolio-risk-recompute",
  rateLimitKey: "cron:v5:portfolio-risk-recompute",
  rateLimit: RATE_LIMITS.v5CronDefault,
  preflight: () => requireV5CronFeature("v5SimulationAndIntelligence"),
  handler: async ({ admin }) => {
    const orgIds = await listOrganizationIds(admin);

    let snapshots = 0;
    for (const orgId of orgIds) {
      const [{ count: overdueObligations }, { count: openExceptions }, { count: stalledDecisions }] =
        await Promise.all([
          admin
            .from("contract_obligations")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", orgId)
            .in("status", ["open", "in_progress"])
            .lt("due_date", new Date().toISOString().slice(0, 10)),
          admin
            .from("exceptions")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", orgId)
            .eq("status", "open"),
          admin
            .from("decision_workspaces")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", orgId)
            .in("status", ["open", "in_review"]),
        ]);

      await admin.from("capacity_snapshots").upsert(
        {
          organization_id: orgId,
          snapshot_date: new Date().toISOString().slice(0, 10),
          by_role_json: {
            overdue_operational_risk: overdueObligations ?? 0,
            evidence_deficit_risk: openExceptions ?? 0,
          },
          by_program_json: {
            stalled_decision_risk: stalledDecisions ?? 0,
            refreshed_at: new Date().toISOString(),
          },
        },
        { onConflict: "organization_id,snapshot_date" }
      );
      snapshots += 1;
    }

    return {
      body: {
        riskSnapshotsUpserted: snapshots,
      },
    };
  },
});

