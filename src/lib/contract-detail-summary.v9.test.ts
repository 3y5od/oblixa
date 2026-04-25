import { describe, expect, it } from "vitest";
import {
  buildContractImmediateActions,
  buildContractOperationsStrip,
} from "./contract-detail-summary";

describe("contract detail summary helpers (V9)", () => {
  it("builds above-the-fold operations strip values from real reminder and freshness state", () => {
    const items = buildContractOperationsStrip({
      ownerLabel: null,
      requiredNextStep: "Confirm renewal notice owner",
      upcomingRemindersCount: 0,
      reminderHistoryCount: 0,
      approvedFieldsCount: 0,
      latestExtractionTouchAt: null,
      latestSourceDocumentAt: "2026-04-01T00:00:00.000Z",
    });

    expect(items.map((item) => item.label)).toEqual(["Owner", "Next action", "Reminders", "Freshness"]);
    expect(items[0]).toMatchObject({
      label: "Owner",
      value: "Unassigned",
      accent: "attention",
      icon: "owner",
    });
    expect(items[1]).toMatchObject({
      value: "Confirm renewal notice owner",
      accent: "primary",
      icon: "nextAction",
    });
    expect(items[2]).toMatchObject({
      label: "Reminders",
      accent: "secondary",
      footerHref: "/settings/health",
      footerLabel: "Open Health diagnostics",
    });
    expect(items[3].value).toContain("Latest source file");
  });

  it("prioritizes pending review, approvals, exceptions, evidence, ownership, and date blockers into immediate actions", () => {
    const items = buildContractImmediateActions({
      contractId: "contract-1",
      pendingFieldsCount: 2,
      pendingApprovalsCount: 1,
      openExceptionsCount: 3,
      outstandingEvidenceCount: 2,
      hasOwner: false,
      approvedFieldsCount: 0,
    });

    expect(items.map((item) => item.eyebrow)).toEqual([
      "Review",
      "Approvals",
      "Exceptions",
      "Evidence",
      "Ownership",
      "Dates",
    ]);
    expect(items[0]).toMatchObject({
      href: "#extracted-fields",
      title: "Pending extracted fields need confirmation",
      actionLabel: "Review fields",
      tone: "attention",
    });
    expect(items[2]).toMatchObject({
      href: "/contracts/exceptions?status=open&contract=contract-1",
      tone: "risk",
    });
    expect(items[4]).toMatchObject({
      href: "#ownership-record",
      actionLabel: "Assign owner",
    });
    expect(items[3].hint).toContain("submission or correction");
    expect(items[5].hint).toContain("Approve at least one key date");
  });
});
