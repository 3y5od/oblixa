import { exerciseV6CronRouteShell } from "../route-shell-test-helper";

exerciseV6CronRouteShell({
  route: "/api/cron/v6/autopilot-execution",
  routeImportPath: "@/app/api/cron/v6/autopilot-execution/route",
  jobExportName: "runAutopilotExecution",
  jobResult: { executed: 3 },
  expectedBody: { executed: 3, duration_ms: 1, errors_count: 0 },
});