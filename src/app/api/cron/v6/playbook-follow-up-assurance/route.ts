import { buildV6CronRouteResult, withV6CronRoute } from "@/lib/v6/cron-route-runner";
import { runPlaybookFollowUpAssurancePasses } from "@/lib/v6/cron-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withV6CronRoute({
  route: "/api/cron/v6/playbook-follow-up-assurance",
  feature: "v6AssuranceCore",
  handler: async ({ admin, orgDiscovery, startedAtMs }) => {
    const result = await runPlaybookFollowUpAssurancePasses(admin, orgDiscovery.orgIds);
    return buildV6CronRouteResult({
      startedAtMs,
      orgDiscovery,
      result,
      body: {
        assuranceRuns: result.assuranceRuns,
      },
    });
  },
});
