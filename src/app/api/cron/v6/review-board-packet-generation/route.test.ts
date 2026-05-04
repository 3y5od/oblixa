import { exerciseV6CronRouteShell } from "../route-shell-test-helper";

exerciseV6CronRouteShell({
  route: "/api/cron/v6/review-board-packet-generation",
  routeImportPath: "@/app/api/cron/v6/review-board-packet-generation/route",
  jobExportName: "generateReviewBoardPackets",
  jobResult: { generated: 3 },
  expectedBody: { generated: 3, errors_count: 0 },
});