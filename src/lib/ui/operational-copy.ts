export type OperationalActionKey =
  | "accept_evidence"
  | "approve_approval"
  | "assign_owner"
  | "browse"
  | "configure"
  | "continue_review"
  | "export"
  | "import"
  | "inspect_health"
  | "mark_done"
  | "open_contract"
  | "open_source_object"
  | "reject_approval"
  | "reject_evidence"
  | "request_evidence"
  | "resolve_exception"
  | "retry_failed_job"
  | "retry_report"
  | "review_dates";

const ACTION_LABELS: Record<OperationalActionKey, string> = {
  accept_evidence: "Accept evidence",
  approve_approval: "Approve request",
  assign_owner: "Assign owner",
  browse: "Browse",
  configure: "Configure",
  continue_review: "Continue review",
  export: "Export",
  import: "Import",
  inspect_health: "Inspect health",
  mark_done: "Mark done",
  open_contract: "Review contract",
  open_source_object: "Review source record",
  reject_approval: "Reject request",
  reject_evidence: "Reject evidence",
  request_evidence: "Request evidence",
  resolve_exception: "Resolve exception",
  retry_failed_job: "Retry job",
  retry_report: "Retry report",
  review_dates: "Review dates",
};

const TERM_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bdurable work index\b/gi, "work queue"],
  [/\bworkspace index\b/gi, "work queue"],
  [/\bread[- ]model diagnostics\b/gi, "data freshness checks"],
  [/\bread[- ]model health\b/gi, "data freshness"],
  [/\bread[- ]model\b/gi, "data freshness"],
  [/\bsource object\b/gi, "source record"],
  [/\brenewal posture\b/gi, "renewal risk"],
  [/\bcompatible action group\b/gi, "bulk-compatible group"],
];

export function humanizeOperationalToken(value: string | null | undefined, fallback = "Not recorded") {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function operationalActionLabel(
  action: string | null | undefined,
  fallback: OperationalActionKey | string = "open_source_object"
) {
  const key = String(action ?? fallback).trim() as OperationalActionKey;
  return ACTION_LABELS[key] ?? humanizeOperationalToken(key, "Review details");
}

export function operationalizeCopy(copy: string) {
  return TERM_REPLACEMENTS.reduce(
    (next, [pattern, replacement]) => next.replace(pattern, replacement),
    copy
  );
}

export function containsDefaultSurfaceInternalTerm(copy: string) {
  return (
    TERM_REPLACEMENTS.some(([pattern]) => new RegExp(pattern.source, pattern.flags).test(copy)) ||
    /\b[a-z]+_[a-z_]+\b/.test(copy)
  );
}
