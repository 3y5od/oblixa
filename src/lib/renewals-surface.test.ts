import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  RENEWAL_ACTION_LABELS,
  RENEWAL_DATE_REVIEW_LABELS,
  RENEWAL_FILTER_LABELS,
  RENEWAL_ROW_LABELS,
  RENEWAL_STATUS_LABELS,
  RENEWAL_WINDOW_LABELS,
  RENEWALS_EMPTY_STATE,
  RENEWALS_FILTERED_EMPTY_STATE,
  RENEWALS_PAGE_LEAD,
  RENEWALS_PAGE_TITLE,
  RENEWALS_PRIMARY_CTA,
  RENEWALS_SECTION_EYEBROW,
} from "@/lib/renewals/spec-strings";

describe("Renewals release-state surface", () => {
  const page = readFileSync(
    join(process.cwd(), "src/app/(dashboard)/contracts/renewals/page.tsx"),
    "utf8"
  );
  const loading = readFileSync(
    join(process.cwd(), "src/app/(dashboard)/contracts/renewals/loading.tsx"),
    "utf8"
  );

  it("renders the Core Renewals page identity and CTA", () => {
    expect(page).toContain("DashboardPageHeader");
    expect(page).toContain("loadRenewalsPageModel");
    expect(page).toContain("model.exportHref");
    expect(RENEWALS_PAGE_TITLE).toBe("Renewals");
    expect(RENEWALS_PAGE_LEAD).toBe("Track renewal and notice deadlines before they need action.");
    expect(RENEWALS_PRIMARY_CTA).toBe("Create renewal task");
    expect(page).toContain("model.primaryCta");
  });

  it("keeps the exact filters, columns, statuses, actions, and empty state in spec strings", () => {
    expect(Object.values(RENEWAL_WINDOW_LABELS)).toEqual(["30 days", "60 days", "90 days", "180 days"]);
    expect(Object.values(RENEWAL_FILTER_LABELS)).toEqual(["Owner", "Counterparty", "Status", "Review"]);
    expect(Object.values(RENEWAL_ROW_LABELS)).toEqual([
      "Contract",
      "Counterparty",
      "Renewal date",
      "Notice date",
      "Owner",
      "Status",
      "Next action",
    ]);
    expect(Object.values(RENEWAL_STATUS_LABELS)).toEqual([
      "Needs owner",
      "Needs review",
      "Notice window open",
      "In progress",
      "Completed",
      "No action needed",
    ]);
    expect(Object.values(RENEWAL_ACTION_LABELS)).toEqual([
      "Mark reviewed",
      "Create task",
      "Complete task",
      "Reopen",
      "Export renewal report",
    ]);
    expect(RENEWALS_EMPTY_STATE).toBe("Add renewal and notice dates to track upcoming deadlines.");
  });

  it("uses a responsive list row structure that prevents status and action overlap", () => {
    expect(page).toContain("RenewalRowsHeader");
    expect(page).toContain("RenewalRowFactGrid");
    expect(page).toContain("RenewalRowStateGrid");
    expect(page).toContain("xl:grid-cols-[minmax(13rem,0.9fr)_minmax(0,1.45fr)_minmax(20rem,1fr)]");
    // The status column is widened (and the action column tightened) so the
    // longest actionable label ("Notice window open") fits on one line at the
    // canonical pill scale — no font shrink required.
    expect(page).toContain("xl:grid-cols-[minmax(11.5rem,1fr)_minmax(7.5rem,0.7fr)]");
    expect(page).toContain("RenewalStatusBadge");
    expect(page).toContain("whitespace-nowrap");
    expect(page).toContain("xl:sr-only");
    expect(page).not.toContain("grid-cols-[minmax(12rem,1.15fr)_minmax(9rem,0.8fr)");
  });

  it("reinforces status with a glyph and reserves coloured pills for actionable states", () => {
    // §7.7 — status must not rely on colour alone, so each state maps to a
    // Lucide glyph rendered inside/alongside the label.
    expect(page).toContain("RENEWAL_STATUS_ICON");
    // §12 — the prior fit hack (font shrink + tight tracking to cram long
    // labels into a pill) is retired; resting states drop the pill entirely.
    expect(page).not.toContain("text-[9px]");
    expect(page).not.toContain("tracking-[0.04em]");
  });

  it("does not render the old horizon, ledger, saved queue, or diagnostic framing", () => {
    for (const forbidden of [
      "Renewals workspace",
      "Renewal preparation",
      "Shape the horizon",
      "Saved queues",
      "Renewal ledger",
      "Inspect portfolio signals",
      "JSON",
      "landing-corner-ring",
      "OperationalSummaryCard",
      "RenewalRowChecklistActions",
      "SlackRenewalSummaryForm",
      "ApiJsonLink",
      "SamplePreviewCard",
      "name=\"horizon\"",
    ]) {
      expect(page).not.toContain(forbidden);
    }
  });

  it("uses release-state loading copy", () => {
    expect(loading).toContain("Loading renewals.");
    expect(loading).not.toContain("Loading renewals workspace");
  });

  it("keeps the section identity in renewal vocabulary, not the private decisions product", () => {
    expect(RENEWALS_SECTION_EYEBROW).toBe("Upcoming renewals");
    expect(page).toContain("RENEWALS_SECTION_EYEBROW");
    // /decisions is Hide-for-release for Core users; the section eyebrow must
    // not reintroduce "Upcoming decisions" framing.
    expect(page).not.toContain("Upcoming decisions");
  });

  it("bounds the long renewal list with a scroll region and sticky header + footer bands", () => {
    // At the 90/180-day horizons the list runs 20-40 rows; the body scrolls within
    // a capped region between two opaque sticky bands — the column header pinned at
    // the top and the count footer pinned at the bottom (both inside the scroll
    // region) — so columns stay aligned and the count stays visible.
    expect(page).toContain("overflow-y-auto");
    expect(page).toContain("sticky top-0");
    expect(page).toContain("sticky bottom-0");
    expect(page).toContain("in view");
  });

  it("surfaces per-date review/source state and a filtered-empty escape", () => {
    expect(Object.values(RENEWAL_DATE_REVIEW_LABELS)).toEqual([
      "Reviewed",
      "Suggested",
      "Computed",
      "Missing",
    ]);
    expect(RENEWALS_FILTERED_EMPTY_STATE).toBe("No renewals match the current filters.");
    expect(page).toContain("RenewalReviewChip");
    expect(page).toContain("RenewalsEmptyState");
  });
});
