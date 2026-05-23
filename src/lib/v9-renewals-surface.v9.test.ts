import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  RENEWAL_ACTION_LABELS,
  RENEWAL_FILTER_LABELS,
  RENEWAL_ROW_LABELS,
  RENEWAL_STATUS_LABELS,
  RENEWAL_WINDOW_LABELS,
  RENEWALS_EMPTY_STATE,
  RENEWALS_PAGE_LEAD,
  RENEWALS_PAGE_TITLE,
  RENEWALS_PRIMARY_CTA,
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
    expect(RENEWALS_PAGE_LEAD).toBe("Prevent missed renewal and notice dates.");
    expect(RENEWALS_PRIMARY_CTA).toBe("Create renewal task");
    expect(page).toContain("model.primaryCta");
  });

  it("keeps the exact filters, columns, statuses, actions, and empty state in spec strings", () => {
    expect(Object.values(RENEWAL_WINDOW_LABELS)).toEqual(["30 days", "60 days", "90 days", "180 days"]);
    expect(Object.values(RENEWAL_FILTER_LABELS)).toEqual(["Owner", "Counterparty", "Status"]);
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
      "No renewal action needed",
    ]);
    expect(Object.values(RENEWAL_ACTION_LABELS)).toEqual([
      "Mark reviewed",
      "Create renewal task",
      "Complete",
      "Reopen",
      "Export renewal report",
    ]);
    expect(RENEWALS_EMPTY_STATE).toBe("Add renewal and notice dates to see upcoming contract decisions.");
  });

  it("uses a responsive list row structure that prevents status and action overlap", () => {
    expect(page).toContain("RenewalRowsHeader");
    expect(page).toContain("RenewalRowFactGrid");
    expect(page).toContain("RenewalRowStateGrid");
    expect(page).toContain("xl:grid-cols-[minmax(13rem,0.9fr)_minmax(0,1.45fr)_minmax(20rem,1fr)]");
    expect(page).toContain("xl:grid-cols-[minmax(10rem,0.85fr)_minmax(10rem,0.85fr)]");
    expect(page).toContain("RenewalStatusBadge");
    // v23 aesthetic pass: the previous compact-pill treatment used
    // wrap-based fit (text-[9.5px] + max-w-[9.25rem] + whitespace-normal)
    // which produced an awkward 2-line "NEEDED" below "NO RENEWAL ACTION".
    // Replaced with a single-line uppercase pill at smaller font (9px) +
    // tight tracking (0.04em) so the full label fits horizontally while
    // remaining visually consistent with the canonical uppercase-caps
    // pill treatment used for the other shorter statuses.
    expect(page).toContain("text-[9px]");
    expect(page).toContain("tracking-[0.04em]");
    expect(page).toContain("whitespace-nowrap");
    expect(page).toContain("xl:sr-only");
    expect(page).not.toContain("grid-cols-[minmax(12rem,1.15fr)_minmax(9rem,0.8fr)");
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
});
