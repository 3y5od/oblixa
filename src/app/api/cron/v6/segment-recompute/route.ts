import { buildV6CronRouteResult, withV6CronRoute } from "@/lib/v6/cron-route-runner";
import { recomputeSegmentMembershipsForAll } from "@/lib/v6/cron-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withV6CronRoute({
  route: "/api/cron/v6/segment-recompute",
  feature: "v6Segments",
  handler: async ({ admin, orgDiscovery, startedAtMs }) => {
    const result = await recomputeSegmentMembershipsForAll(admin, orgDiscovery.orgIds);
    return buildV6CronRouteResult({
      startedAtMs,
      orgDiscovery,
      result,
      body: {
        recomputed: result.recomputed,
        segmentsScanned: result.segmentsScanned,
      },
    });
  },
});
