import { v6CronMeta, withV6CronRoute } from "@/lib/v6/cron-route-runner";
import { recomputeOutcomeEffectiveness } from "@/lib/v6/cron-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withV6CronRoute({
  route: "/api/cron/v6/outcome-effectiveness",
  feature: "v6OutcomeIntelligence",
  handler: async ({ admin, orgIds, startedAtMs }) => {
    const result = await recomputeOutcomeEffectiveness(admin);
    return {
      ok: true,
      body: {
        analyzed: result.analyzed,
        ...v6CronMeta(orgIds, startedAtMs, 0),
      },
    };
  },
});
