import type { V10MutationResponse } from "@/lib/v10-mutation-envelope";

export type V10RetryableJobWorkItemType = "import_failure" | "export_failure" | "report_failure";

export function statusForV10JobRetryOutcome(outcome: V10MutationResponse["outcome"]): number {
  switch (outcome) {
    case "not_found":
      return 404;
    case "dependency_blocked":
      return 424;
    case "conflict":
    case "job_not_retryable":
      return 409;
    case "validation_failed":
      return 400;
    case "audit_write_failed":
    case "server_error":
      return 500;
    default:
      return 400;
  }
}

export function getV10JobRetryUrl(input: {
  type: V10RetryableJobWorkItemType;
  sourceId: string;
}): string {
  switch (input.type) {
    case "import_failure":
      return `/api/import/contracts/${input.sourceId}`;
    case "export_failure":
      return `/api/export/contracts/${input.sourceId}`;
    case "report_failure":
      return `/api/report-runs/${input.sourceId}/retry`;
  }
}