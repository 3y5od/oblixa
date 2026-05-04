import { exerciseV6CronRouteShell } from "../route-shell-test-helper";

exerciseV6CronRouteShell({
  route: "/api/cron/v6/scorecard-recompute",
  routeImportPath: "@/app/api/cron/v6/scorecard-recompute/route",
  jobExportName: "recomputeScorecardsForAllOrgs",
  jobResult: { updated: 1 },
  expectedBody: { updated: 1, errors_count: 0 },
});