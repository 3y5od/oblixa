import { logV6Cron } from "@/lib/assurance/cron";
import { buildV6CronRouteResult, withV6CronRoute } from "@/lib/assurance/cron-route-runner";
import { runAssuranceChecksForAllOrgs } from "@/lib/assurance/cron-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withV6CronRoute({
  route: "/api/cron/v6/assurance-checks",
  feature: "v6AssuranceCore",
  handler: async ({ admin, orgIds, orgDiscovery, startedAtMs }) => {
    logV6Cron("assurance-checks", "batch_start", { orgs: orgIds.length });
    const result = await runAssuranceChecksForAllOrgs(admin, orgIds);
    logV6Cron("assurance-checks", "batch_complete", {
      checkRuns: result.checkRuns,
      orgs_succeeded: result.orgsSucceeded,
      orgs_failed: result.orgsFailed,
      errors_count: result.errors?.length ?? 0,
    });
    return buildV6CronRouteResult({
      startedAtMs,
      orgDiscovery,
      result,
      body: {
        checkRuns: result.checkRuns,
      },
    });
  },
});
