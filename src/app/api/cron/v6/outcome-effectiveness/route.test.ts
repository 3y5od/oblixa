import { exerciseV6CronRouteShell } from "../route-shell-test-helper";

exerciseV6CronRouteShell({
  route: "/api/cron/v6/outcome-effectiveness",
  routeImportPath: "@/app/api/cron/v6/outcome-effectiveness/route",
  jobExportName: "recomputeOutcomeEffectiveness",
  jobResult: { analyzed: 4 },
  expectedBody: { analyzed: 4, errors_count: 0 },
});