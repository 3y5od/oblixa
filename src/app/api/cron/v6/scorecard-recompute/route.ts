import { buildV6CronRouteResult, withV6CronRoute } from "@/lib/v6/cron-route-runner";
import { recomputeScorecardsForAllOrgs } from "@/lib/v6/cron-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withV6CronRoute({
  route: "/api/cron/v6/scorecard-recompute",
  feature: "v6AssuranceCore",
  handler: async ({ admin, orgDiscovery, startedAtMs }) => {
    const result = await recomputeScorecardsForAllOrgs(admin, orgDiscovery.orgIds);
    return buildV6CronRouteResult({
      startedAtMs,
      orgDiscovery,
      result,
      body: {
        updated: result.updated,
      },
    });
  },
});
