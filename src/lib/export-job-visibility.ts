import { v9OutcomeLabel } from "./v9-outcome-semantics";
import { normalizeV10JobStatus } from "./v10-job-visibility";

export type ExportJobVisibilityInput = {
  status: string;
  selected_contract_count: number | null;
  exported_rows: number | null;
  truncated?: boolean | null;
  error_message?: string | null;
};

export type ExportJobTone = "healthy" | "neutral" | "attention" | "risk";

export function getExportJobTone(input: ExportJobVisibilityInput): ExportJobTone {
  const status = normalizeV10JobStatus(input.status, { failed: input.truncated ? 1 : 0, retryable: input.truncated ? 1 : 0 });
  if (status === "failed_retryable" || status === "failed_terminal") return "risk";
  if (status === "partial" || input.truncated) return "attention";
  if (status === "running" || status === "retrying" || status === "queued") return "attention";
  if ((input.exported_rows ?? 0) > 0) return "healthy";
  return "neutral";
}

export function getExportJobHeadline(input: ExportJobVisibilityInput): string {
  const status = normalizeV10JobStatus(input.status, { failed: input.truncated ? 1 : 0, retryable: input.truncated ? 1 : 0 });
  if (status === "queued") return "Export is queued";
  if (status === "running") return "Export is building";
  if (status === "retrying") return "Export retry is running";
  if (status === "failed_retryable" || status === "failed_terminal") return "Export failed";
  if (status === "partial" || input.truncated) {
    return `Export finished — ${v9OutcomeLabel("partial")}`;
  }
  return "Export completed";
}

export function getExportJobDetail(input: ExportJobVisibilityInput): string {
  const status = normalizeV10JobStatus(input.status, { failed: input.truncated ? 1 : 0, retryable: input.truncated ? 1 : 0 });
  if (status === "failed_retryable" || status === "failed_terminal") {
    return input.error_message?.trim() || "The export did not complete.";
  }

  const rows = input.exported_rows ?? 0;
  const scope =
    (input.selected_contract_count ?? 0) > 0
      ? `${input.selected_contract_count} selected contract${input.selected_contract_count === 1 ? "" : "s"}`
      : "workspace scope";

  if (status === "queued") {
    return `Export queued for ${scope}. Revisit this status shortly if you need confirmation before sharing the file.`;
  }
  if (status === "running" || status === "retrying") {
    return `Building the export for ${scope}. Refresh this status if you need confirmation before sharing the file.`;
  }
  if (status === "partial" || input.truncated) {
    const reason = input.error_message?.trim();
    if (input.truncated) {
      return `${rows} row${rows === 1 ? "" : "s"} exported before the row budget was reached.${reason ? ` ${reason}` : ""} Narrow filters or selection and retry if you need the full set.`;
    }
    return `${rows} row${rows === 1 ? "" : "s"} exported, but the result was limited.${reason ? ` ${reason}` : ""} Narrow scope and retry if you need the full set.`;
  }
  if (rows === 0) {
    return `The export completed for ${scope}, but no rows matched the final selection.`;
  }
  return `${rows} row${rows === 1 ? "" : "s"} exported from ${scope}.`;
}
