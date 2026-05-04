import { exerciseV6CronRouteShell } from "../route-shell-test-helper";

exerciseV6CronRouteShell({
  route: "/api/cron/v6/finding-refresh",
  routeImportPath: "@/app/api/cron/v6/finding-refresh/route",
  jobExportName: "refreshFindingsAging",
  jobResult: { updated: 6 },
  expectedBody: { updated: 6, errors_count: 0 },
});