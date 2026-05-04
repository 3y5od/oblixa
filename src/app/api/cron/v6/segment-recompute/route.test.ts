import { exerciseV6CronRouteShell } from "../route-shell-test-helper";

exerciseV6CronRouteShell({
  route: "/api/cron/v6/segment-recompute",
  routeImportPath: "@/app/api/cron/v6/segment-recompute/route",
  jobExportName: "recomputeSegmentMembershipsForAll",
  jobResult: { recomputed: 7 },
  expectedBody: { recomputed: 7, errors_count: 0 },
});