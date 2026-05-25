import { buildV6CronRouteResult, withV6CronRoute } from "@/lib/assurance/cron-route-runner";
import { refreshFindingsAging } from "@/lib/assurance/cron-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withV6CronRoute({
  route: "/api/cron/v6/finding-refresh",
  feature: "v6AssuranceCore",
  handler: async ({ admin, orgIds, orgDiscovery, startedAtMs }) => {
    void orgIds;
    const result = await refreshFindingsAging(admin, orgDiscovery.orgIds);
    return buildV6CronRouteResult({
      startedAtMs,
      orgDiscovery,
      result,
      body: {
        updated: result.updated,
        findingsScanned: result.findingsScanned,
      },
    });
  },
});
