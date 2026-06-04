export const RENEWALS_EYEBROW = "Renewals";
export const RENEWALS_PAGE_TITLE = "Renewals";
export const RENEWALS_PAGE_LEAD = "Track renewal and notice deadlines before they need action.";
export const RENEWALS_PRIMARY_CTA = "Create renewal task";
// Section eyebrow above the deadline list. Deliberately NOT "Upcoming
// decisions" — "decisions" collides with the private Decisions product, which
// the release-state contract marks Hide-for-release. Core copy stays in the
// renewal/notice-deadline vocabulary.
export const RENEWALS_SECTION_EYEBROW = "Upcoming renewals";
export const RENEWALS_EMPTY_STATE = "Add renewal and notice dates to track upcoming deadlines.";
export const RENEWALS_FILTERED_EMPTY_STATE = "No renewals match the current filters.";
export const RENEWALS_PARTIAL_DATA_TITLE = "Renewals data is partially unavailable";
export const RENEWALS_PARTIAL_DATA_REASON =
  "Some renewal data returned partial results. Visible rows remain available while freshness is restored.";

export const RENEWAL_WINDOW_LABELS = {
  "30": "30 days",
  "60": "60 days",
  "90": "90 days",
  "180": "180 days",
} as const;

export const RENEWAL_FILTER_LABELS = {
  owner: "Owner",
  counterparty: "Counterparty",
  status: "Status",
  // Extends the release-state doc's prescribed filter list (owner/counterparty/
  // status) — added to let users triage by date provenance, which serves the
  // source-backed/human-reviewed trust thesis.
  review: "Review",
} as const;

export const RENEWAL_ROW_LABELS = {
  contract: "Contract",
  counterparty: "Counterparty",
  renewalDate: "Renewal date",
  noticeDate: "Notice date",
  owner: "Owner",
  status: "Status",
  nextAction: "Next action",
} as const;

export const RENEWAL_STATUS_LABELS = {
  needs_owner: "Needs owner",
  needs_review: "Needs review",
  notice_window_open: "Notice window open",
  in_progress: "In progress",
  completed: "Completed",
  no_renewal_action_needed: "No action needed",
} as const;

export const RENEWAL_ACTION_LABELS = {
  mark_reviewed: "Mark reviewed",
  // Row-level action label. The page's primary CTA stays "Create renewal task"
  // (RENEWALS_PRIMARY_CTA); this shorter form keeps the inline next-action chip
  // on one line in the narrow action column.
  create_renewal_task: "Create task",
  // "Complete task" reads as a concrete next action; the bare "Complete" was
  // ambiguous about what gets completed.
  complete: "Complete task",
  reopen: "Reopen",
  export_renewal_report: "Export renewal report",
} as const;

// Per-date review/source provenance, surfaced as a chip beside each date so a
// reader can tell a human-approved date from a suggested or computed one. The
// release-state contract requires reviewed/source state on the date fields.
// Trust ladder: reviewed (success) > computed (neutral) > suggested (warning,
// extracted but unapproved) > missing (warning, no date on file).
export const RENEWAL_DATE_REVIEW_LABELS = {
  reviewed: "Reviewed",
  suggested: "Suggested",
  computed: "Computed",
  // State label (matches the Review filter option). The "add or review one"
  // nudge lives in the hover hint, not the chip text.
  missing: "Missing",
} as const;

// Hover/title explanations so each provenance chip is self-describing — in
// particular "Computed" must read as derived, not human-trusted like "Reviewed".
export const RENEWAL_DATE_REVIEW_HINTS = {
  reviewed: "A person approved this extracted date.",
  suggested: "Extracted from the document but not yet reviewed.",
  computed: "Derived from the renewal date and the notice window — not extracted.",
  missing: "No date on file yet. Add or review one.",
} as const;
