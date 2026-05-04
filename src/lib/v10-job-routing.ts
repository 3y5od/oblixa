import type { V10WorkItemType } from "@/lib/v10-release-contract";

type V10JobRouteKind = "recovery" | "diagnostics";
type V10JobRecordType = "import_job" | "export_job" | "report_run";

function getV10JobRouteKind(input: { retryAction?: string | null; primaryAction?: string | null }): V10JobRouteKind {
  return input.retryAction === "retry" || input.primaryAction === "retry_failed_job" ? "recovery" : "diagnostics";
}

function getV10JobSurfaceHref(input: {
  recordType: V10JobRecordType;
  recordId?: string | null;
  routeKind: V10JobRouteKind;
}): string {
  switch (input.recordType) {
    case "import_job":
      return input.routeKind === "recovery" ? "/contracts/bulk#recent-imports" : "/settings/health#jobs";
    case "export_job":
      return input.routeKind === "recovery" ? "/contracts" : "/settings/health#exports";
    case "report_run":
      return input.routeKind === "recovery"
        ? "/reports"
        : input.recordId
          ? `/contracts/reports?runId=${input.recordId}`
          : "/contracts/reports";
  }
}

export function getV10CommandJobHref(input: {
  recordType: V10JobRecordType;
  recordId?: string | null;
  retryAction?: string | null;
}): string {
  return getV10JobSurfaceHref({
    recordType: input.recordType,
    recordId: input.recordId,
    routeKind: getV10JobRouteKind({ retryAction: input.retryAction }),
  });
}

export function getV10WorkItemHref(input: {
  type: V10WorkItemType;
  sourceId: string;
  contractId?: string | null;
  primaryAction?: string | null;
  fallbackHref?: string;
}): string {
  if (input.contractId) {
    if (input.type === "approval") return `/contracts/${input.contractId}?tab=overview#renewal-approvals`;
    if (input.type === "obligation") return `/contracts/${input.contractId}?tab=obligations`;
    if (input.type === "evidence_request") return `/contracts/${input.contractId}?tab=overview#contract-evidence`;
    if (input.type === "exception") return `/contracts/exceptions?status=open&contract=${input.contractId}`;
    return `/contracts/${input.contractId}`;
  }

  if (input.type === "report_failure") {
    return getV10JobSurfaceHref({
      recordType: "report_run",
      recordId: input.sourceId,
      routeKind: getV10JobRouteKind({ primaryAction: input.primaryAction }),
    });
  }
  if (input.type === "export_failure") {
    return getV10JobSurfaceHref({
      recordType: "export_job",
      recordId: input.sourceId,
      routeKind: getV10JobRouteKind({ primaryAction: input.primaryAction }),
    });
  }
  if (input.type === "import_failure") {
    return getV10JobSurfaceHref({
      recordType: "import_job",
      recordId: input.sourceId,
      routeKind: getV10JobRouteKind({ primaryAction: input.primaryAction }),
    });
  }
  return input.fallbackHref ?? "/work";
}