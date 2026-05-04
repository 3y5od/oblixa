import { v6CronMeta, withV6CronRoute } from "@/lib/v6/cron-route-runner";
import { runAutopilotExecution } from "@/lib/v6/cron-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withV6CronRoute({
  route: "/api/cron/v6/autopilot-execution",
  feature: "v6Autopilot",
  handler: async ({ admin, orgIds, startedAtMs }) => {
    const result = await runAutopilotExecution(admin);
    return {
      ok: true,
      body: {
        executed: result.executed,
        ...v6CronMeta(orgIds, startedAtMs),
      },
    };
  },
});
