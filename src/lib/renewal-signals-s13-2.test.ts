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
  const page = readFileSync(
    join(process.cwd(), "src/app/(dashboard)/contracts/renewals/page.tsx"),
    "utf8"
  );
  const model = readFileSync(join(process.cwd(), "src/lib/renewals/model.ts"), "utf8");

  it("uses the exact release-state filters and row labels", () => {
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
    for (const key of Object.keys(RENEWAL_FILTER_LABELS)) {
      expect(page).toContain(`RENEWAL_FILTER_LABELS.${key}`);
    }
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
