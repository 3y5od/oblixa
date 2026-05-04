import { exerciseV6CronRouteShell } from "../route-shell-test-helper";

exerciseV6CronRouteShell({
  route: "/api/cron/v6/health-graph-rollups",
  routeImportPath: "@/app/api/cron/v6/health-graph-rollups/route",
  jobExportName: "rebuildHealthGraph",
  jobResult: { nodes: 5, edges: 8 },
  expectedBody: { nodes: 5, edges: 8, errors_count: 0 },
});