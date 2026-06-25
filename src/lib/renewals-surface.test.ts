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
  const surfaceFiles = [
    "src/app/(dashboard)/contracts/renewals/page.tsx",
    "src/app/(dashboard)/contracts/renewals/renewals-page-view.tsx",
    "src/app/(dashboard)/contracts/renewals/renewals-ledger.tsx",
    "src/app/(dashboard)/contracts/renewals/renewals-ledger-constants.ts",
    "src/app/(dashboard)/contracts/renewals/renewal-row-cells.tsx",
    "src/app/(dashboard)/contracts/renewals/renewal-row-detail.tsx",
    "src/app/(dashboard)/contracts/renewals/renewal-action-cluster.tsx",
    "src/app/(dashboard)/contracts/renewals/renewals-page-sections.tsx",
  ];
  const page = surfaceFiles.map((file) => readFileSync(join(process.cwd(), file), "utf8")).join("\n");
  const surface = page;
  const loading = readFileSync(
    join(process.cwd(), "src/app/(dashboard)/contracts/renewals/loading.tsx"),
    "utf8"
  );

  it("renders the Core Renewals page identity and CTA", () => {
    expect(page).toContain("DashboardPageHeader");
    expect(page).toContain("loadRenewalsPageModel");
    expect(page).toContain("model.exportHref");
    expect(RENEWALS_PAGE_TITLE).toBe("Renewals");
    expect(RENEWALS_PAGE_LEAD).toBe(
      "Track upcoming renewal and notice requirements with confirmed, calculated, suggested, and missing date states."
    );
    expect(RENEWALS_PRIMARY_CTA).toBe("Create renewal task");
    expect(page).toContain("model.primaryCta");
  });

  it("keeps the exact filters, columns, statuses, actions, and empty state in spec strings", () => {
    expect(Object.values(RENEWAL_WINDOW_LABELS)).toEqual(["30 days", "60 days", "90 days", "180 days"]);
    // §51 — status dimension named for its object.
    expect(Object.values(RENEWAL_FILTER_LABELS)).toEqual(["Owner", "Counterparty", "Renewal status", "Date status"]);
    expect(Object.values(RENEWAL_ROW_LABELS)).toEqual([
      "Contract",
      "Counterparty",
      "Renewal date",
      "Notice deadline",
      "Owner",
      "Renewal status",
      "Next action",
    ]);
    expect(Object.values(RENEWAL_STATUS_LABELS)).toEqual([
      "Needs owner",
      "Needs confirmation",
      "Notice window open",
      "Renewal task active",
      "Completed",
      "No notice action needed",
    ]);
    // §22 — the model's row actions name the object they close; secondary
    // page-level actions live in RENEWAL_SECONDARY_ACTION_LABELS, keeping this
    // set exactly the five capabilities the model derives.
    expect(Object.values(RENEWAL_ACTION_LABELS)).toEqual([
      "Mark confirmed",
      "Create task",
      "Complete renewal task",
      "Reopen renewal task",
      "Export renewal report",
    ]);
    expect(RENEWALS_EMPTY_STATE).toBe("Add renewal and notice dates to track upcoming deadlines.");
  });

  it("uses a six-column ledger row structure that prevents status and action overlap", () => {
    // The row collapsed counterparty under the contract name (§13), leaving six
    // shared columns whose template is reused by the header and every row so the
    // labels sit above their values (§39).
    expect(page).toContain("RenewalLedgerHeader");
    expect(page).toContain("RenewalLedgerRow");
    expect(page).toContain("RenewalContractCell");
    expect(page).toContain("RenewalDateCell");
    expect(page).toContain("RenewalNextActionCell");
    expect(page).toContain(
      "xl:grid-cols-[minmax(15rem,1.45fr)_minmax(7.25rem,0.7fr)_minmax(7.25rem,0.7fr)_minmax(8.5rem,0.78fr)_minmax(7.5rem,0.66fr)_minmax(11rem,0.92fr)]"
    );
    expect(page).toContain("RenewalStatusBadge");
    expect(page).toContain("whitespace-nowrap");
    expect(page).toContain("xl:sr-only");
    // The old seven-column template (counterparty as its own column) is gone.
    expect(page).not.toContain("minmax(13.25rem,1fr)_minmax(10.5rem,0.8fr)");
  });

  it("reinforces status with a glyph and reserves coloured pills for actionable states", () => {
    // §7.7 — status must not rely on colour alone, so each state maps to a
    // Lucide glyph rendered inside/alongside the label.
    expect(page).toContain("RENEWAL_STATUS_ICON");
    // §12 — the prior fit hack (font shrink to cram long labels into a status
    // pill) is retired; resting states drop the pill entirely. The font-shrink
    // guard stays. (Loose 0.04em tracking is now the mono condition-heading
    // treatment shared with Contracts, so it is no longer forbidden here.)
    expect(page).not.toContain("text-[9px]");
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
    expect(RENEWALS_SECTION_EYEBROW).toBe("Renewal and notice dates");
    expect(surface).toContain("RENEWALS_SECTION_EYEBROW");
    // /decisions is Hide-for-release for Core users; the section eyebrow must
    // not reintroduce "Upcoming decisions" framing.
    expect(page).not.toContain("Upcoming decisions");
  });

  it("bounds the long renewal list with a scroll region, sticky column header, and ledger footer", () => {
    // At the 90/180-day horizons the list runs 20-40 rows; the body scrolls within
    // a capped region under a pinned column header, with §54 urgency-band headers
    // pinned just beneath it. The scoped count lives in the card-level ledger
    // footer (§61), outside the scroll region so it stays visible.
    expect(page).toContain("overflow-y-auto");
    expect(page).toContain("sticky top-0");
    expect(page).toContain("RenewalGroupHeader");
    expect(page).toContain("RenewalLedgerFooter");
    expect(surface).toContain("in view");
  });

  it("surfaces per-date review/source state and a filtered-empty escape", () => {
    expect(Object.values(RENEWAL_DATE_REVIEW_LABELS)).toEqual([
      "Confirmed",
      "Suggested",
      "Calculated",
      "Missing",
    ]);
    expect(RENEWALS_FILTERED_EMPTY_STATE).toBe("No renewal or notice dates match these filters.");
    // §62 — per-date provenance now rides the shared DateProvenanceBadge.
    expect(page).toContain("DateProvenanceBadge");
    expect(page).toContain("RenewalsEmptyState");
  });
});
