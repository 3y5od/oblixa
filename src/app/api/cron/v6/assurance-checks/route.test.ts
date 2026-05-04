import { exerciseV6CronRouteShell } from "../route-shell-test-helper";

exerciseV6CronRouteShell({
  route: "/api/cron/v6/assurance-checks",
  routeImportPath: "@/app/api/cron/v6/assurance-checks/route",
  jobExportName: "runAssuranceChecksForAllOrgs",
  jobResult: { checkRuns: 2 },
  expectedBody: { checkRuns: 2, errors_count: 0 },
  orgIds: ["org-a", "org-b"],
});