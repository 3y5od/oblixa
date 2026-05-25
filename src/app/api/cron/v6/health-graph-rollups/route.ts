import { buildV6CronRouteResult, withV6CronRoute } from "@/lib/assurance/cron-route-runner";
import { rebuildHealthGraph } from "@/lib/assurance/cron-jobs";
import { recordApiRouteAuditEvent } from "@/lib/security/api-mutation-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withV6CronRoute({
  route: "/api/cron/v6/health-graph-rollups",
  feature: "v6AssuranceCore",
  handler: async ({ admin, orgDiscovery, startedAtMs }) => {
    const result = await rebuildHealthGraph(admin, orgDiscovery.orgIds);
    for (const organizationId of orgDiscovery.orgIds) {
      await recordApiRouteAuditEvent(admin, {
        organizationId,
        actorUserId: null,
        actorType: "system",
        route: "/api/cron/v6/health-graph-rollups",
        method: "GET",
        action: "api.route_authorized",
      }).catch(() => null);
    }
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
