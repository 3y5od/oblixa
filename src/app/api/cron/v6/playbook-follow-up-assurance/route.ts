import { v6CronMeta, withV6CronRoute } from "@/lib/v6/cron-route-runner";
import { runPlaybookFollowUpAssurancePasses } from "@/lib/v6/cron-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withV6CronRoute({
  route: "/api/cron/v6/playbook-follow-up-assurance",
  feature: "v6AssuranceCore",
  handler: async ({ admin, orgIds, startedAtMs }) => {
    const { assuranceRuns } = await runPlaybookFollowUpAssurancePasses(admin);
    return {
      ok: true,
      body: {
        assuranceRuns,
        ...v6CronMeta(orgIds, startedAtMs, 0),
      },
    };
  },
});
