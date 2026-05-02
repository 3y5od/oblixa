import { v9OutcomeLabel } from "./v9-outcome-semantics";
import { normalizeV10JobStatus } from "./v10-job-visibility";

export type ImportJobVisibilityInput = {
  status: string;
  total_rows: number | null;
  inserted_rows: number | null;
  error_rows: number | null;
  failure_reason?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
  retry_of_job_id?: string | null;
  superseded_by_job_id?: string | null;
};

export type ImportJobTone = "healthy" | "neutral" | "attention" | "risk";

export function getImportJobTone(input: ImportJobVisibilityInput): ImportJobTone {
  const status = normalizeV10JobStatus(input.status, { failed: input.error_rows ?? 0, retryable: input.error_rows ?? 0 });
  if (status === "failed_retryable" || status === "failed_terminal") return "risk";
  if (input.superseded_by_job_id) return "neutral";
  if (status === "queued") return "neutral";
  if (status === "running" || status === "retrying") return "attention";
  if (status === "partial") return "attention";
  if ((input.error_rows ?? 0) > 0) return "attention";
  if ((input.inserted_rows ?? 0) > 0) return "healthy";
  return "neutral";
}

export function getImportJobHeadline(input: ImportJobVisibilityInput): string {
  const status = normalizeV10JobStatus(input.status, { failed: input.error_rows ?? 0, retryable: input.error_rows ?? 0 });
  if (input.superseded_by_job_id) return "Import replaced by newer retry";
  if (status === "queued") return "Import is queued";
  if (status === "running") return "Import is creating records";
  if (status === "retrying") return "Import retry is running";
  if (status === "failed_retryable" || status === "failed_terminal") return "Import failed";
  if ((input.error_rows ?? 0) > 0) {
    return `Import finished — ${v9OutcomeLabel("partial")}`;
  }
  if ((input.inserted_rows ?? 0) > 0) return "Import is ready for review";
  return "Import completed";
}

export function getImportJobDetail(input: ImportJobVisibilityInput): string {
  const status = normalizeV10JobStatus(input.status, { failed: input.error_rows ?? 0, retryable: input.error_rows ?? 0 });
  if (status === "failed_retryable" || status === "failed_terminal") {
    return input.failure_reason?.trim() || "The import stopped before contracts were created.";
  }

  if (input.superseded_by_job_id) {
    return "A newer retry replaced this import attempt as the version you should act on.";
  }
  if (status === "queued") {
    return "The import is queued and will start shortly. Return to recent imports if you need to confirm when row creation begins.";
  }

  const inserted = input.inserted_rows ?? 0;
  const total = input.total_rows ?? 0;
  const errors = input.error_rows ?? 0;
  const parts =
    total > 0 ? [`${inserted}/${total} rows created`] : ["Import finished with no source rows recorded"];
  if (errors > 0) {
    parts.push(`${errors} ${errors === 1 ? "row needs" : "rows need"} correction`);
  }
  if (status === "running" || status === "retrying") {
    parts.push("Valid contracts will appear as rows finish creating");
  }
  if (inserted === 0 && errors === 0 && input.status === "completed") {
    parts.push("No contracts were created from this attempt");
  }
  return parts.join(" · ");
}

export function importJobCanRetry(input: ImportJobVisibilityInput): boolean {
  const status = normalizeV10JobStatus(input.status, { failed: input.error_rows ?? 0, retryable: input.error_rows ?? 0 });
  if (input.superseded_by_job_id) return false;
  if (status === "running" || status === "retrying") return false;
  if (status === "failed_terminal") return false;
  return status === "failed_retryable" || status === "partial" || (input.error_rows ?? 0) > 0;
}
