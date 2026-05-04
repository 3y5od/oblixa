import { exerciseV6CronRouteShell } from "../route-shell-test-helper";

exerciseV6CronRouteShell({
  route: "/api/cron/v6/external-workflow-deadlines",
  routeImportPath: "@/app/api/cron/v6/external-workflow-deadlines/route",
  jobExportName: "scanExternalWorkflowDeadlines",
  jobResult: { escalated: 2 },
  expectedBody: { escalated: 2, duration_ms: 1, errors_count: 0 },
});