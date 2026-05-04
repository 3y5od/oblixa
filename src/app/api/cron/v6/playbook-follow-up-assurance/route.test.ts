import { exerciseV6CronRouteShell } from "../route-shell-test-helper";

exerciseV6CronRouteShell({
  route: "/api/cron/v6/playbook-follow-up-assurance",
  routeImportPath: "@/app/api/cron/v6/playbook-follow-up-assurance/route",
  jobExportName: "runPlaybookFollowUpAssurancePasses",
  jobResult: { assuranceRuns: 9 },
  expectedBody: { assuranceRuns: 9, errors_count: 0 },
});