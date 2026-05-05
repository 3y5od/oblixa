import { buildV6CronRouteResult, withV6CronRoute } from "@/lib/v6/cron-route-runner";
import { rebuildHealthGraph } from "@/lib/v6/cron-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withV6CronRoute({
  route: "/api/cron/v6/health-graph-rollups",
  feature: "v6AssuranceCore",
  handler: async ({ admin, orgDiscovery, startedAtMs }) => {
    const result = await rebuildHealthGraph(admin, orgDiscovery.orgIds);
    return buildV6CronRouteResult({
      startedAtMs,
      orgDiscovery,
      result,
      body: {
        nodes: result.nodes,
        edges: result.edges,
        attemptedNodes: result.attemptedNodes,
        attemptedEdges: result.attemptedEdges,
      },
    });
  },
});
