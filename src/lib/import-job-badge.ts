import type { SemanticStatus } from "@/components/ui/status-badge";
import type { ImportJobVisibilityInput } from "@/lib/import-job-visibility";
import { normalizeV10JobStatus } from "@/lib/job-visibility";

export type ImportJobBadge = { status: SemanticStatus; label: string; active: boolean };

/**
 * Map an import job to a semantic status badge + short label, and whether it is
 * still in progress (so running imports can be grouped above completed ones).
 * Shared by the import workbench history list and the job-details page.
 */
export function importJobBadge(job: ImportJobVisibilityInput): ImportJobBadge {
  if (job.superseded_by_job_id) return { status: "empty", label: "Replaced", active: false };
  const status = normalizeV10JobStatus(job.status, {
    failed: job.error_rows ?? 0,
    retryable: job.error_rows ?? 0,
  });
  switch (status) {
    case "queued":
      return { status: "info", label: "Queued", active: true };
    case "running":
      return { status: "in_review", label: "Creating", active: true };
    case "retrying":
      return { status: "in_review", label: "Retrying", active: true };
    case "partial":
      return { status: "warning", label: "Partial", active: false };
    case "succeeded":
      return { status: "healthy", label: "Ready", active: false };
    case "canceled":
      return { status: "empty", label: "Canceled", active: false };
    default:
      return { status: "critical", label: "Failed", active: false };
  }
}
