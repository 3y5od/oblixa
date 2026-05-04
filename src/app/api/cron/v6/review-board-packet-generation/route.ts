import { v6CronMeta, withV6CronRoute } from "@/lib/v6/cron-route-runner";
import { generateReviewBoardPackets } from "@/lib/v6/cron-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withV6CronRoute({
  route: "/api/cron/v6/review-board-packet-generation",
  feature: "v6ReviewBoards",
  handler: async ({ admin, orgIds, startedAtMs }) => {
    const result = await generateReviewBoardPackets(admin);
    return {
      ok: true,
      body: {
        generated: result.generated,
        ...v6CronMeta(orgIds, startedAtMs, 0),
      },
    };
  },
});
