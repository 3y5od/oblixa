import { v6CronMeta, withV6CronRoute } from "@/lib/v6/cron-route-runner";
import { reevaluateControlPolicies } from "@/lib/v6/cron-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withV6CronRoute({
  route: "/api/cron/v6/control-policy-reevaluation",
  feature: "v6ControlPolicies",
  handler: async ({ admin, orgIds, startedAtMs }) => {
    const result = await reevaluateControlPolicies(admin);
    return {
      ok: true,
      body: {
        evaluations: result.evaluations,
        ...v6CronMeta(orgIds, startedAtMs, Math.max(0, orgIds.length - result.evaluations)),
      },
    };
  },
});
