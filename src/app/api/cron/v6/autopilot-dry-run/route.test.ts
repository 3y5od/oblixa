import { exerciseV6CronRouteShell } from "../route-shell-test-helper";

exerciseV6CronRouteShell({
  route: "/api/cron/v6/autopilot-dry-run",
  routeImportPath: "@/app/api/cron/v6/autopilot-dry-run/route",
  jobExportName: "runAutopilotDryRun",
  jobResult: { logs: ["dry-run complete"] },
  expectedBody: { logs: ["dry-run complete"], duration_ms: 1, errors_count: 0 },
});