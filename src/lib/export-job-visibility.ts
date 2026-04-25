import { v9OutcomeLabel } from "./v9-outcome-semantics";

export type ExportJobVisibilityInput = {
  status: string;
  selected_contract_count: number | null;
  exported_rows: number | null;
  truncated?: boolean | null;
  error_message?: string | null;
};

export type ExportJobTone = "healthy" | "neutral" | "attention" | "risk";

export function getExportJobTone(input: ExportJobVisibilityInput): ExportJobTone {
  if (input.status === "failed") return "risk";
  if (input.status === "partial" || input.truncated) return "attention";
  if (input.status === "processing" || input.status === "queued") return "attention";
  if ((input.exported_rows ?? 0) > 0) return "healthy";
  return "neutral";
}

export function getExportJobHeadline(input: ExportJobVisibilityInput): string {
  if (input.status === "queued") return "Export is queued";
  if (input.status === "processing") return "Export is building";
  if (input.status === "failed") return "Export failed";
  if (input.status === "partial" || input.truncated) {
    return `Export finished — ${v9OutcomeLabel("partial")}`;
  }
  return "Export completed";
}

export function getExportJobDetail(input: ExportJobVisibilityInput): string {
  if (input.status === "failed") {
    return input.error_message?.trim() || "The export did not complete.";
  }

  const rows = input.exported_rows ?? 0;
  const scope =
    (input.selected_contract_count ?? 0) > 0
      ? `${input.selected_contract_count} selected contract${input.selected_contract_count === 1 ? "" : "s"}`
      : "workspace scope";

  if (input.status === "queued") {
    return `Export queued for ${scope}. Revisit this status shortly if you need confirmation before sharing the file.`;
  }
  if (input.status === "processing") {
    return `Building the export for ${scope}. Refresh this status if you need confirmation before sharing the file.`;
  }
  if (input.status === "partial" || input.truncated) {
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
