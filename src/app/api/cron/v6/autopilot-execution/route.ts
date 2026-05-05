import { buildV6CronRouteResult, withV6CronRoute } from "@/lib/v6/cron-route-runner";
import { runAutopilotExecution } from "@/lib/v6/cron-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withV6CronRoute({
  route: "/api/cron/v6/autopilot-execution",
  feature: "v6Autopilot",
  handler: async ({ admin, orgDiscovery, startedAtMs }) => {
    const result = await runAutopilotExecution(admin, orgDiscovery.orgIds);
    return buildV6CronRouteResult({
      startedAtMs,
      orgDiscovery,
      result,
      body: {
        executed: result.executed,
        blocked: result.blocked,
        failedActions: result.failedActions,
        rulesScanned: result.rulesScanned,
      },
    });
  },
});
