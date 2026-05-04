import { v6CronMeta, withV6CronRoute } from "@/lib/v6/cron-route-runner";
import { rebuildHealthGraph } from "@/lib/v6/cron-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withV6CronRoute({
  route: "/api/cron/v6/health-graph-rollups",
  feature: "v6AssuranceCore",
  handler: async ({ admin, orgIds, startedAtMs }) => {
    const result = await rebuildHealthGraph(admin);
    return {
      ok: true,
      body: {
        nodes: result.nodes,
        edges: result.edges,
        ...v6CronMeta(orgIds, startedAtMs, 0),
      },
    };
  },
});
