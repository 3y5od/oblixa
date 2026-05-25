import { buildV6CronRouteResult, withV6CronRoute } from "@/lib/assurance/cron-route-runner";
import { reevaluateControlPolicies } from "@/lib/assurance/cron-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withV6CronRoute({
  route: "/api/cron/v6/control-policy-reevaluation",
  feature: "v6ControlPolicies",
  handler: async ({ admin, orgDiscovery, startedAtMs }) => {
    const result = await reevaluateControlPolicies(admin, orgDiscovery.orgIds);
    return buildV6CronRouteResult({
      startedAtMs,
      orgDiscovery,
      result,
      body: {
        evaluations: result.evaluations,
      },
    });
  },
});
