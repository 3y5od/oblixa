// Pure URL + filter helpers for the Evidence surface. No server/runtime deps so
// this module is safe to import from client components (the apply-live filter
// bar) as well as the server-side model.
import type {
  EvidenceDueFilterKey,
  EvidenceFileFilterKey,
  EvidenceFilterState,
  EvidenceModelSearchInput,
  EvidenceSectionKey,
  EvidenceStatusFilterKey,
} from "./types";

export function buildEvidenceHref(input: {
  section?: EvidenceSectionKey;
  contract?: string | null;
  filters?: Partial<EvidenceFilterState>;
  page?: number;
  create?: boolean;
}) {
  const params = new URLSearchParams();
  // Always emit the section token (including open_requests) so a tab click is a
  // sticky, explicit selection rather than the bare path that re-triggers the
  // auto-pick default.
  if (input.section) params.set("section", input.section);
  const filters = input.filters ?? {};
  // `contract` stays a first-class param for call-site back-compat; the filter
  // state can also supply it.
  const contract = input.contract ?? filters.contract;
  if (contract) params.set("contract", contract);
  if (filters.owner) params.set("owner", filters.owner);
  if (filters.status) params.set("status", filters.status);
  if (filters.due) params.set("due", filters.due);
  if (filters.obligation) params.set("obligation", filters.obligation);
  if (filters.file) params.set("file", filters.file);
  // Page is only emitted by the pager (>1). Tab/filter links omit it, so any
  // navigation that changes the result set resets to page 1.
  if (input.page && input.page > 1) params.set("page", String(input.page));
  if (input.create) params.set("create", "1");
  const qs = params.toString();
  return qs ? `/evidence?${qs}` : "/evidence";
}

const EVIDENCE_DUE_FILTER_KEYS: readonly EvidenceDueFilterKey[] = [
  "overdue",
  "due_today",
  "due_soon",
  "no_due",
];
const EVIDENCE_FILE_FILTER_KEYS: readonly EvidenceFileFilterKey[] = ["has_file", "missing_file"];
const EVIDENCE_STATUS_FILTER_KEYS: readonly EvidenceStatusFilterKey[] = [
  "requested",
  "received",
  "overdue",
  "accepted",
  "rejected",
];

function trim(value: string | null | undefined) {
  return (value ?? "").trim();
}

export function normalizeEvidenceFilters(input: EvidenceModelSearchInput): EvidenceFilterState {
  const status = trim(input.status);
  const due = trim(input.due);
  const file = trim(input.file);
  return {
    owner: trim(input.owner),
    contract: trim(input.contract),
    obligation: trim(input.obligation),
    status: (EVIDENCE_STATUS_FILTER_KEYS as readonly string[]).includes(status)
      ? (status as EvidenceStatusFilterKey)
      : "",
    due: (EVIDENCE_DUE_FILTER_KEYS as readonly string[]).includes(due) ? (due as EvidenceDueFilterKey) : "",
    file: (EVIDENCE_FILE_FILTER_KEYS as readonly string[]).includes(file)
      ? (file as EvidenceFileFilterKey)
      : "",
  };
}

export function hasActiveEvidenceFilters(filters: EvidenceFilterState): boolean {
  return Boolean(
    filters.owner || filters.contract || filters.obligation || filters.status || filters.due || filters.file
  );
}
