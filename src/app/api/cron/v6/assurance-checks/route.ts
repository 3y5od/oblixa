import { logV6Cron } from "@/lib/v6/cron";
import { v6CronMeta, withV6CronRoute } from "@/lib/v6/cron-route-runner";
import { runAssuranceChecksForAllOrgs } from "@/lib/v6/cron-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withV6CronRoute({
  route: "/api/cron/v6/assurance-checks",
  feature: "v6AssuranceCore",
  handler: async ({ admin, orgIds, startedAtMs }) => {
    logV6Cron("assurance-checks", "batch_start", { orgs: orgIds.length });
    const result = await runAssuranceChecksForAllOrgs(admin);
    const meta = v6CronMeta(orgIds, startedAtMs, Math.max(0, orgIds.length - result.checkRuns));
    logV6Cron("assurance-checks", "batch_complete", { checkRuns: result.checkRuns, ...meta });
    return {
      ok: true,
      body: {
        checkRuns: result.checkRuns,
        ...meta,
      },
    };
  },
});
