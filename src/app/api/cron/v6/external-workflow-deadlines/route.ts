import { buildV6CronRouteResult, withV6CronRoute } from "@/lib/assurance/cron-route-runner";
import { scanExternalWorkflowDeadlines } from "@/lib/assurance/cron-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withV6CronRoute({
  route: "/api/cron/v6/external-workflow-deadlines",
  feature: "v6AssuranceCore",
  handler: async ({ admin, orgDiscovery, startedAtMs }) => {
    const result = await scanExternalWorkflowDeadlines(admin, orgDiscovery.orgIds);
    return buildV6CronRouteResult({
      startedAtMs,
      orgDiscovery,
      result,
      body: {
        escalated: result.escalated,
        linksScanned: result.linksScanned,
        orgsTouched: result.orgsTouched,
      },
    });
  },
});
