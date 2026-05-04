import { v6CronMeta, withV6CronRoute } from "@/lib/v6/cron-route-runner";
import { scanExternalWorkflowDeadlines } from "@/lib/v6/cron-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withV6CronRoute({
  route: "/api/cron/v6/external-workflow-deadlines",
  feature: "v6AssuranceCore",
  handler: async ({ admin, orgIds, startedAtMs }) => {
    const result = await scanExternalWorkflowDeadlines(admin);
    return {
      ok: true,
      body: {
        escalated: result.escalated,
        ...v6CronMeta(orgIds, startedAtMs),
      },
    };
  },
});
