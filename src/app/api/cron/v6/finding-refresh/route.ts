import { v6CronMeta, withV6CronRoute } from "@/lib/v6/cron-route-runner";
import { refreshFindingsAging } from "@/lib/v6/cron-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withV6CronRoute({
  route: "/api/cron/v6/finding-refresh",
  feature: "v6AssuranceCore",
  handler: async ({ admin, orgIds, startedAtMs }) => {
    const result = await refreshFindingsAging(admin);
    return {
      ok: true,
      body: {
        updated: result.updated,
        ...v6CronMeta(orgIds, startedAtMs, 0),
      },
    };
  },
});
