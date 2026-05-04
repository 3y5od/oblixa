import { exerciseV6CronRouteShell } from "../route-shell-test-helper";

exerciseV6CronRouteShell({
  route: "/api/cron/v6/control-policy-reevaluation",
  routeImportPath: "@/app/api/cron/v6/control-policy-reevaluation/route",
  jobExportName: "reevaluateControlPolicies",
  jobResult: { evaluations: 1 },
  expectedBody: { evaluations: 1, duration_ms: 1, errors_count: 0 },
  orgIds: ["org-a"],
});