export const RENEWALS_EYEBROW = "Renewals";
export const RENEWALS_PAGE_TITLE = "Renewals";
// §2 — the lead frames the surface in the trust-state vocabulary the page
// actually shows (confirmed / calculated / suggested / missing), not a generic
// "before they require action" promise.
export const RENEWALS_PAGE_LEAD =
  "Track upcoming renewal and notice requirements with confirmed, calculated, suggested, and missing date states.";
export const RENEWALS_PRIMARY_CTA = "Create renewal task";
// Section eyebrow above the deadline list. Deliberately NOT "Upcoming
// decisions" — "decisions" collides with the private Decisions product, which
// the release-state contract marks Hide-for-release. Core copy stays in the
// renewal/notice-deadline vocabulary.
export const RENEWALS_SECTION_EYEBROW = "Renewal and notice dates";
// §4 — the summary band's full accessible title. The visible band pairs the
// eyebrow above with the scoped count ("N dates in view"); this string is the
// band's composed accessible name.
export const RENEWALS_SECTION_TITLE = "Renewal and notice dates in view";
// §42 — distinguishes "the workspace has no contracts yet" (upload/import) from
// "contracts exist but none carry a date in this window" (confirm/adjust).
export const RENEWALS_EMPTY_NO_CONTRACTS = "Add renewal and notice dates to track upcoming deadlines.";
export const RENEWALS_EMPTY_NO_DATES_IN_WINDOW = "No renewal or notice dates are in this window.";
export const RENEWALS_EMPTY_NO_DATES_HINT =
  "Confirm renewal dates or adjust the date window to find upcoming work.";
// Kept for compatibility with the model's empty-state export; the page now
// chooses the contextual copy above.
export const RENEWALS_EMPTY_STATE = RENEWALS_EMPTY_NO_CONTRACTS;
export const RENEWALS_FILTERED_EMPTY_STATE = "No renewal or notice dates match these filters.";
export const RENEWALS_PARTIAL_DATA_TITLE = "Renewals data is partially unavailable";
// §44 — degraded copy phrased in the renewal/notice vocabulary, naming why the
// data may be incomplete (review still in progress) rather than a generic
// "partial results" line.
export const RENEWALS_PARTIAL_DATA_REASON =
  "Some renewal and notice dates may be incomplete while contract details are still being reviewed.";
// §58 — trust note shown where suggested/calculated dates appear, so a reader
// never treats an unconfirmed date as operational truth.
export const RENEWALS_TRUST_NOTE =
  "Suggested and calculated dates should be confirmed before they drive reminders or reports.";
// §45 — contracts with neither a renewal nor a notice date never enter a date
// window, so they would be invisible here without an explicit affordance.
export const RENEWALS_MISSING_DATES_TITLE = "Contracts missing renewal or notice dates";
export const RENEWALS_MISSING_DATES_ACTION = "Review date details";
// §47 / §48 — export rides the live window + filters; when the view is empty
// there is nothing to export, so the action disables with a concrete reason.
export const RENEWALS_EXPORT_FILTER_HELPER = "Export uses the selected window and filters.";
export const RENEWALS_EXPORT_EMPTY_REASON = "No renewal or notice dates in the current view to export.";

export const RENEWAL_WINDOW_LABELS = {
  "30": "30 days",
  "60": "60 days",
  "90": "90 days",
  "180": "180 days",
} as const;

export const RENEWAL_FILTER_LABELS = {
  owner: "Owner",
  counterparty: "Counterparty",
  // §51 — "Status" alone was ambiguous (contract status? task status?). This
  // dimension filters the renewal row's operational status, so it is named for
  // that object.
  status: "Renewal status",
  // Extends the release-state doc's prescribed filter list (owner/counterparty/
  // status) — added to let users triage by date provenance, which serves the
  // source-backed/human-confirmed trust thesis.
  review: "Date status",
} as const;

export const RENEWAL_ROW_LABELS = {
  contract: "Contract",
  counterparty: "Counterparty",
  renewalDate: "Renewal date",
  noticeDate: "Notice deadline",
  owner: "Owner",
  // §51 — column header matches the filter dimension: it is the renewal row's
  // status, not a generic "Status".
  status: "Renewal status",
  nextAction: "Next action",
} as const;

// §53 — sort options for the ledger. "urgent" is the default (the existing
// status-weighted order that groups by urgency band); the rest flatten the list
// into a single sorted run keyed on the named field.
export const RENEWAL_SORT_LABELS = {
  urgent: "Most urgent",
  notice: "Soonest notice deadline",
  renewal: "Soonest renewal date",
  owner: "Owner",
  needs_confirmation: "Needs confirmation",
} as const;
export const RENEWAL_SORT_DIMENSION_LABEL = "Sort";

// §54 — urgency section headers shown only under the default ("Most urgent")
// sort. `renewalWindow` interpolates the active window so the band names the
// exact horizon in view.
export const RENEWAL_GROUP_LABELS = {
  notice_30: "Notice deadline within 30 days",
  renewal_window: (windowDays: string | number) => `Renewal within ${windowDays} days`,
  unconfirmed: "Missing or unconfirmed dates",
  later: "Later in this window",
} as const;

export const RENEWAL_STATUS_LABELS = {
  needs_owner: "Needs owner",
  needs_review: "Needs confirmation",
  notice_window_open: "Notice window open",
  in_progress: "Renewal task active",
  completed: "Completed",
  no_renewal_action_needed: "No notice action needed",
} as const;

// The model-derived row-action capabilities. Keys here drive RenewalActionKey
// and the row-action state machine, so this set stays exactly the five the model
// produces; page-only secondary actions live in RENEWAL_SECONDARY_ACTION_LABELS.
export const RENEWAL_ACTION_LABELS = {
  mark_reviewed: "Mark confirmed",
  // Row-level action label. The page's primary CTA stays "Create renewal task"
  // (RENEWALS_PRIMARY_CTA); this shorter form keeps the inline next-action chip
  // on one line in the narrow action column.
  create_renewal_task: "Create task",
  // §22 — names the object that gets completed; the bare "Complete" / "Complete
  // task" was ambiguous about what closes.
  complete: "Complete renewal task",
  reopen: "Reopen renewal task",
  export_renewal_report: "Export renewal report",
} as const;

// §23 / §57 — secondary, page-level row actions that name their object. Not part
// of the model's row-action capabilities, so they live apart from
// RENEWAL_ACTION_LABELS / RenewalActionKey.
export const RENEWAL_SECONDARY_ACTION_LABELS = {
  open_contract: "Open contract",
  assign_owner: "Assign owner",
  review_source: "Review against source",
} as const;

// Per-date confirmation/source provenance, surfaced as a chip beside each date so a
// reader can tell a human-confirmed date from a suggested or computed one. The
// release-state contract requires confirmation/source state on the date fields.
// Trust ladder: confirmed (success) > computed (neutral) > suggested (warning,
// extracted but unconfirmed) > missing (warning, no date on file).
export const RENEWAL_DATE_REVIEW_LABELS = {
  reviewed: "Confirmed",
  suggested: "Suggested",
  computed: "Calculated",
  // State label (matches the Date status filter option). The "add or confirm one"
  // nudge lives in the hover hint, not the chip text.
  missing: "Missing",
} as const;

// Hover/title explanations so each provenance chip is self-describing — in
// particular "Calculated" must read as derived, not human-trusted like "Confirmed".
export const RENEWAL_DATE_REVIEW_HINTS = {
  reviewed: "A person confirmed this suggested date.",
  suggested: "Suggested from the document but not yet confirmed.",
  computed: "Calculated from the renewal date and notice window.",
  missing: "No date on file yet. Add or confirm one.",
} as const;

// §26 — owner-gap helper shown beside the "Unassigned" owner state.
export const RENEWAL_OWNER_MISSING_HELP = "Assign an owner before reminders can be routed.";

// §14 / §20 / §21 / §27 / §28 — the plain-language operational consequence shown
// beneath the contract name. Templates live here (spec-string contract); the
// model picks which to call and supplies the interpolated date label.
export const RENEWAL_CONSEQUENCE = {
  needs_owner: () => "Assign an owner before renewal reminders can be routed.",
  needs_review: () =>
    "Confirm the renewal and notice dates before reminders and reports rely on them.",
  notice_open: (renewalDateLabel: string) =>
    renewalDateLabel && renewalDateLabel !== "—"
      ? `Notice period open. Give notice before the ${renewalDateLabel} renewal.`
      : "Notice period open. Give notice before the renewal.",
  in_progress: () => "Renewal task in progress.",
  completed: () => "Renewal reviewed and complete.",
  no_action: (dateLabel: string) =>
    dateLabel && dateLabel !== "—"
      ? `No action needed before ${dateLabel}.`
      : "No renewal task needed yet.",
  // §28 — overdue language names the exact object, never generic urgency.
  notice_passed: (dateLabel: string) =>
    dateLabel && dateLabel !== "—" ? `Notice deadline passed ${dateLabel}.` : "Notice deadline passed.",
  renewal_passed: (dateLabel: string) =>
    dateLabel && dateLabel !== "—" ? `Renewal date passed ${dateLabel}.` : "Renewal date passed.",
} as const;

// §18 — basis text for a calculated notice deadline.
export const renewalNoticeBasis = (noticeWindowDays: number | null) =>
  noticeWindowDays && noticeWindowDays > 0
    ? `Calculated from the renewal date and ${noticeWindowDays}-day notice window.`
    : "Calculated from the renewal date and notice window.";

// §11 — active-filter summary line beneath the filter rail.
export const renewalActiveFilterSummary = (windowDays: string | number) =>
  `Showing renewal and notice dates inside the next ${windowDays} days.`;

// §61 — ledger footer descriptors.
export const renewalFooterWindow = (windowDays: string | number) => `Window: next ${windowDays} days`;
export const RENEWALS_FOOTER_NO_FILTERS = "Filtered by: none";
export const renewalFooterFilteredBy = (parts: string[]) =>
  parts.length > 0 ? `Filtered by: ${parts.join(", ")}` : RENEWALS_FOOTER_NO_FILTERS;
