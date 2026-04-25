import { describe, expect, it } from "vitest";
import {
  compareRenewalQueueRows,
  getRenewalNextAction,
  type RenewalQueueSortRow,
} from "./renewal-next-action";

const baseSortRow = (overrides: Partial<RenewalQueueSortRow>): RenewalQueueSortRow => ({
  title: "Zebra MSA",
  ownerLabel: "Owner",
  openExceptions: 0,
  outstandingEvidence: 0,
  blocker: null,
  checkpointTotal: 3,
  daysUntil: 60,
  annualValue: 100_000,
  ...overrides,
});

describe("getRenewalNextAction (v9)", () => {
  it("routes ownerless renewals to ownership before downstream work", () => {
    expect(
      getRenewalNextAction({
        contractId: "contract-0",
        ownerAssigned: false,
        openExceptions: 0,
        outstandingEvidence: 0,
      })
    ).toEqual({
      href: "/contracts/contract-0?tab=overview#ownership-record",
      label: "Assign owner",
    });
  });

  it("routes exception-blocked contracts to the exceptions ledger first", () => {
    expect(
      getRenewalNextAction({
        contractId: "contract-1",
        ownerAssigned: true,
        openExceptions: 2,
        outstandingEvidence: 1,
      })
    ).toEqual({
      href: "/contracts/exceptions?status=open&contract=contract-1",
      label: "Resolve exceptions",
    });
  });

  it("routes evidence-blocked contracts to contract evidence when no exceptions are open", () => {
    expect(
      getRenewalNextAction({
        contractId: "contract-2",
        ownerAssigned: true,
        openExceptions: 0,
        outstandingEvidence: 3,
      })
    ).toEqual({
      href: "/contracts/contract-2?tab=overview#contract-evidence",
      label: "Review evidence",
    });
  });

  it("falls back to the renewal approvals workspace when no blockers remain", () => {
    expect(
      getRenewalNextAction({
        contractId: "contract-3",
        ownerAssigned: true,
        openExceptions: 0,
        outstandingEvidence: 0,
      })
    ).toEqual({
      href: "/contracts/contract-3?tab=overview#renewal-approvals",
      label: "Open renewal workspace",
    });
  });
});

describe("compareRenewalQueueRows (§13.3 default renewals ordering)", () => {
  it("ranks ownerless rows before owned rows at the same horizon", () => {
    const owned = baseSortRow({ title: "A", ownerLabel: "Pat", daysUntil: 10 });
    const ownerless = baseSortRow({ title: "B", ownerLabel: null, daysUntil: 10 });
    expect(compareRenewalQueueRows(owned, ownerless)).toBeGreaterThan(0);
  });

  it("uses sooner key dates when readiness matches", () => {
    const sooner = baseSortRow({ title: "A", daysUntil: 5 });
    const later = baseSortRow({ title: "B", daysUntil: 20 });
    expect(compareRenewalQueueRows(sooner, later)).toBeLessThan(0);
  });
});
