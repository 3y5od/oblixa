import { buildV6CronRouteResult, withV6CronRoute } from "@/lib/v6/cron-route-runner";
import { recomputeOutcomeEffectiveness } from "@/lib/v6/cron-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withV6CronRoute({
  route: "/api/cron/v6/outcome-effectiveness",
  feature: "v6OutcomeIntelligence",
  handler: async ({ admin, orgDiscovery, startedAtMs }) => {
    const result = await recomputeOutcomeEffectiveness(admin, orgDiscovery.orgIds);
    return buildV6CronRouteResult({
      startedAtMs,
      orgDiscovery,
      result,
      body: {
        analyzed: result.analyzed,
        backfilledRuns: result.backfilledRuns,
        viewRows: result.viewRows,
      },
    });
  },
});
