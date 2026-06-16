import type { DateProvenanceState } from "@/components/ui/date-provenance-badge";
import type { RenewalDateReviewState, RenewalGroupKey } from "@/lib/renewals/types";

// Shared xl column template + min width for the ledger header and every row, so
// the header labels sit exactly above their values. Below xl the cells reflow
// into a stacked ledger record with per-cell labels.
export const LEDGER_GRID =
  "grid gap-x-4 gap-y-3 xl:min-w-[60rem] xl:grid-cols-[minmax(15rem,1.45fr)_minmax(7.25rem,0.7fr)_minmax(7.25rem,0.7fr)_minmax(8.5rem,0.78fr)_minmax(7.5rem,0.66fr)_minmax(11rem,0.92fr)] xl:items-start";

export const REVIEW_TO_PROVENANCE: Record<RenewalDateReviewState, DateProvenanceState> = {
  reviewed: "confirmed",
  suggested: "suggested",
  computed: "calculated",
  missing: "missing",
};

export const GROUP_ORDER: RenewalGroupKey[] = ["notice_30", "unconfirmed", "renewal_window", "later"];
