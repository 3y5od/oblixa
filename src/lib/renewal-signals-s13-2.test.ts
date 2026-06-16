import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  RENEWAL_ACTION_LABELS,
  RENEWAL_FILTER_LABELS,
  RENEWAL_ROW_LABELS,
  RENEWAL_STATUS_LABELS,
} from "@/lib/renewals/spec-strings";

describe("Renewals release-state row signals", () => {
  const page = [
    "src/app/(dashboard)/contracts/renewals/page.tsx",
    "src/app/(dashboard)/contracts/renewals/renewals-page-view.tsx",
    "src/app/(dashboard)/contracts/renewals/renewals-ledger.tsx",
    "src/app/(dashboard)/contracts/renewals/renewals-ledger-constants.ts",
    "src/app/(dashboard)/contracts/renewals/renewal-row-cells.tsx",
    "src/app/(dashboard)/contracts/renewals/renewal-row-detail.tsx",
    "src/app/(dashboard)/contracts/renewals/renewal-action-cluster.tsx",
  ]
    .map((file) => readFileSync(join(process.cwd(), file), "utf8"))
    .join("\n");
  const model = readFileSync(join(process.cwd(), "src/lib/renewals/model.ts"), "utf8");

  it("uses the exact release-state filters and row labels", () => {
    // §51 — the status dimension is named for its object ("Renewal status"), not
    // an ambiguous "Status".
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
    // Filter labels are wired into <RenewalFilterBar labels={RENEWAL_FILTER_LABELS}>;
    // the per-key reads now live in that component, so the page proves it consumes the
    // centralized release-state constant rather than re-deriving each label inline. The
    // exact label values stay pinned by the Object.values assertion above.
    expect(page).toContain("labels={RENEWAL_FILTER_LABELS}");
    for (const key of Object.keys(RENEWAL_ROW_LABELS)) {
      expect(page).toContain(`RENEWAL_ROW_LABELS.${key}`);
    }
  });

  it("derives only release-state statuses and actions", () => {
    for (const status of Object.keys(RENEWAL_STATUS_LABELS)) {
      expect(model).toContain(status);
    }
    for (const action of Object.keys(RENEWAL_ACTION_LABELS)) {
      expect(model).toContain(action);
    }
    expect(model).toContain("deriveRenewalStatus");
    expect(model).toContain("nextActionForStatus");
  });

  it("does not depend on the old horizon ledger signal vocabulary", () => {
    for (const forbidden of [
      "workspaceStatus",
      "outstandingEvidence",
      "openExceptions",
      "getRenewalNextAction",
      "Renewal ledger",
      "Checklist",
      "Blockers",
    ]) {
      expect(page).not.toContain(forbidden);
    }
  });
});
