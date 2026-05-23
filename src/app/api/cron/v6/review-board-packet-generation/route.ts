import { buildV6CronRouteResult, withV6CronRoute } from "@/lib/v6/cron-route-runner";
import { generateReviewBoardPackets } from "@/lib/v6/cron-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withV6CronRoute({
  route: "/api/cron/v6/review-board-packet-generation",
  feature: "v6ReviewBoards",
  handler: async ({ admin, orgDiscovery, startedAtMs }) => {
    const result = await generateReviewBoardPackets(admin, orgDiscovery.orgIds);
    return buildV6CronRouteResult({
      startedAtMs,
      orgDiscovery,
      result,
      body: {
        generated: result.generated,
        duplicateRunsSkipped: result.duplicateRunsSkipped,
        boardsScanned: result.boardsScanned,
        notificationsAttempted: result.notificationsAttempted,
        notificationsDelivered: result.notificationsDelivered,
      },
    });
  },
});
