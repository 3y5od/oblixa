import { v6CronMeta, withV6CronRoute } from "@/lib/v6/cron-route-runner";
import { recomputeSegmentMembershipsForAll } from "@/lib/v6/cron-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withV6CronRoute({
  route: "/api/cron/v6/segment-recompute",
  feature: "v6Segments",
  handler: async ({ admin, orgIds, startedAtMs }) => {
    const result = await recomputeSegmentMembershipsForAll(admin);
    return {
      ok: true,
      body: {
        recomputed: result.recomputed,
        ...v6CronMeta(orgIds, startedAtMs, 0),
      },
    };
  },
});
