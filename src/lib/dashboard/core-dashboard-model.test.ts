import { describe, expect, it } from "vitest";

import {
  buildActivityRows,
  buildAuditActivityRows,
  buildDataGapRows,
  buildExceptionWorkRows,
  buildUpcomingDeadlineRows,
  buildWorkRows,
  deriveCoreDashboardTopCards,
  deriveImportStatusSummary,
  getCoreDashboardVisiblePartialErrors,
  mergeActivityRows,
} from "@/lib/dashboard/core-dashboard-model";

const IMPORT_STATUS_NOW = new Date("2026-05-31T12:00:00Z");
function importJobRow(
  overrides: Partial<Parameters<typeof deriveImportStatusSummary>[0][number]>
): Parameters<typeof deriveImportStatusSummary>[0][number] {
  return {
    id: "job",
    status: "completed",
    total_rows: 10,
    inserted_rows: 10,
    error_rows: 0,
    failure_reason: null,
    created_at: "2026-05-20T10:00:00Z",
    updated_at: "2026-05-20T10:05:00Z",
    completed_at: "2026-05-20T10:05:00Z",
    superseded_by_job_id: null,
    retry_of_job_id: null,
    ...overrides,
  };
}

describe("Core dashboard model builders", () => {
  it("returns exactly six top cards in release-state order, including zero-count empty workspace cards", () => {
    const cards = deriveCoreDashboardTopCards({
      needsReview: 0,
      upcomingDeadlines: 0,
      blockedWork: 0,
      missingOwners: 0,
      openExceptions: 0,
      evidenceRequested: 0,
    });

    expect(cards.map((card) => card.label)).toEqual([
      "Contracts needing review",
      "Dates coming up",
      "Tasks awaiting response",
      "Contracts missing an owner",
      "Contract problems",
      "Evidence requests",
    ]);
    expect(cards.map((card) => card.count)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(cards.every((card) => card.tone === "success")).toBe(true);
  });

  it("carries pending review, blocked work, missing owner, and evidence requested counts into cards", () => {
    const cards = deriveCoreDashboardTopCards({
      needsReview: 2,
      upcomingDeadlines: 1,
      blockedWork: 3,
      missingOwners: 4,
      openExceptions: 5,
      evidenceRequested: 6,
    });

    expect(cards.map((card) => [card.label, card.count])).toEqual([
      ["Contracts needing review", 2],
      ["Dates coming up", 1],
      ["Tasks awaiting response", 3],
      ["Contracts missing an owner", 4],
      ["Contract problems", 5],
      ["Evidence requests", 6],
    ]);
    expect(cards.find((card) => card.label === "Tasks awaiting response")?.tone).toBe("danger");
  });

  it("builds upcoming deadlines from approved dates and computes notice deadline from renewal date plus notice window", () => {
    const rows = buildUpcomingDeadlineRows(
      [
        {
          id: "field-renewal",
          contract_id: "contract-1",
          field_name: "renewal_date",
          field_value: "2026-06-30",
          contracts: {
            id: "contract-1",
            title: "Acme MSA",
            organization_id: "org-1",
            owner_id: "owner-1",
          },
        },
        {
          id: "field-notice-window",
          contract_id: "contract-1",
          field_name: "notice_window",
          field_value: "30 days",
          contracts: {
            id: "contract-1",
            title: "Acme MSA",
            organization_id: "org-1",
            owner_id: "owner-1",
          },
        },
        {
          id: "field-effective",
          contract_id: "contract-1",
          field_name: "effective_date",
          field_value: "2026-06-05",
          contracts: {
            id: "contract-1",
            title: "Acme MSA",
            organization_id: "org-1",
            owner_id: "owner-1",
          },
        },
      ],
      new Map([["owner-1", "Ada Owner"]]),
      new Date("2026-05-31T12:00:00Z"),
      90
    );

    expect(rows.map((row) => row.label)).toEqual([
      "Notice deadline",
      "Effective date",
      "Renewal date",
    ]);
    expect(rows[0]).toMatchObject({
      contractId: "contract-1",
      contractTitle: "Acme MSA",
      ownerLabel: "Ada Owner",
      daysRemaining: 0,
    });
  });

  it("detects owner, counterparty, renewal, notice, value, and status data gaps", () => {
    const contracts = [
      {
        id: "contract-1",
        title: "Acme MSA",
        counterparty: "",
        owner_id: null,
        status: undefined,
        annual_value: null,
        updated_at: "2026-05-01T00:00:00Z",
      },
      {
        id: "contract-2",
        title: "Beta DPA",
        counterparty: "Beta",
        owner_id: "owner-1",
        status: "active",
        annual_value: 12000,
        updated_at: "2026-05-02T00:00:00Z",
      },
    ] as unknown as Parameters<typeof buildDataGapRows>[0];

    const rows = buildDataGapRows(
      contracts,
      [
        { contract_id: "contract-2", field_name: "renewal_date", field_value: "2026-12-31", status: "approved" },
        { contract_id: "contract-2", field_name: "notice_date", field_value: "2026-10-01", status: "approved" },
      ],
      new Map([["owner-1", "Ada Owner"]])
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.missing).toEqual([
      "Owner",
      "Counterparty",
      "Renewal date",
      "Notice date",
      "Contract value",
      "Status",
    ]);
  });

  it("builds Work Needing Action rows from visible V10 work items without limiting to the current user", () => {
    const rows = buildWorkRows(
      [
        {
          id: "work-1",
          source_id: "exception-1",
          source_table: "exceptions",
          type: "exception",
          title: "Resolve pricing exception",
          status: "blocked",
          due_state: "overdue",
          due_at: "2026-05-15T00:00:00Z",
          contract_id: "contract-1",
          owner_user_id: "owner-2",
          primary_action: "open_exception",
          blocked_reason: "Needs finance decision",
          severity: "high",
          priority: "urgent",
          updated_at: "2026-05-16T00:00:00Z",
        },
      ],
      new Map([["contract-1", "Acme MSA"]]),
      new Map([["owner-2", "Nora Ops"]])
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: "Resolve pricing exception",
      status: "blocked",
      dueState: "overdue",
      contractTitle: "Acme MSA",
      ownerLabel: "Nora Ops",
      actionLabel: "Open Exception",
    });
    expect(rows[0]?.href).toContain("contract-1");
  });

  it("backfills Work Needing Action from open exceptions when V10 work items do not cover them", () => {
    const rows = buildExceptionWorkRows(
      [
        {
          id: "exception-1",
          contract_id: "contract-1",
          title: "Pricing exception needs decision",
          status: "open",
          severity: "high",
          owner_id: "owner-1",
          due_date: "2026-05-15",
          updated_at: "2026-05-16T00:00:00Z",
        },
        {
          id: "exception-2",
          contract_id: "contract-2",
          title: "Already represented in V10",
          status: "open",
          severity: "medium",
          owner_id: null,
          due_date: null,
          updated_at: "2026-05-16T00:00:00Z",
        },
        {
          id: "exception-3",
          contract_id: null,
          title: "Missing critical dates: title",
          status: "open",
          severity: "low",
          owner_id: null,
          due_date: null,
          updated_at: "2026-05-16T00:00:00Z",
        },
        {
          id: "exception-4",
          contract_id: "contract-404",
          title: "Hidden contract exception",
          status: "open",
          severity: "low",
          owner_id: null,
          due_date: null,
          updated_at: "2026-05-16T00:00:00Z",
        },
      ],
      new Map([["contract-1", "Acme MSA"]]),
      new Map([["owner-1", "Ada Owner"]]),
      new Set(["exception-2"])
    );

    expect(rows).toEqual([
      {
        id: "exception:exception-1",
        title: "Pricing exception needs decision",
        type: "exception",
        status: "open",
        dueState: "overdue",
        dueAt: "2026-05-15",
        contractTitle: "Acme MSA",
        ownerLabel: "Ada Owner",
        href: "/contracts/exceptions?status=open&contract=contract-1",
        actionLabel: "Open problem",
      },
    ]);
  });

  it("builds Recent Activity rows from V10 contract activity events", () => {
    const rows = buildActivityRows(
      [
        {
          id: "activity-1",
          contract_id: "contract-1",
          action: "field.approved",
          safe_summary: "Renewal date approved",
          outcome: "approved",
          occurred_at: "2026-05-17T10:00:00Z",
          updated_at: "2026-05-17T10:00:00Z",
        },
        {
          id: "activity-2",
          contract_id: null,
          action: "report.exported",
          safe_summary: null,
          outcome: "complete",
          occurred_at: null,
          updated_at: "2026-05-17T11:00:00Z",
        },
      ],
      new Map([["contract-1", "Acme MSA"]])
    );

    expect(rows).toEqual([
      {
        id: "activity-1",
        label: "Field Approved",
        summary: "Renewal date approved",
        contractTitle: "Acme MSA",
        occurredAt: "2026-05-17T10:00:00Z",
        href: "/contracts/contract-1",
        outcome: "approved",
      },
      {
        id: "activity-2",
        label: "Report Exported",
        summary: "Report Exported",
        contractTitle: null,
        occurredAt: "2026-05-17T11:00:00Z",
        href: "/contracts",
        outcome: "complete",
      },
    ]);
  });

  it("backfills Recent Activity from audit events while preserving V10 rows first", () => {
    const auditRows = buildAuditActivityRows(
      [
        {
          id: "audit-1",
          contract_id: "contract-1",
          action: "contract.uploaded",
          created_at: "2026-05-17T09:00:00Z",
          details: null,
        },
        {
          id: "audit-2",
          contract_id: "contract-2",
          action: "contract.owner_changed",
          created_at: "2026-05-17T08:00:00Z",
          details: null,
        },
      ],
      new Map([
        ["contract-1", "Acme MSA"],
        ["contract-2", "Beta DPA"],
      ])
    );

    const merged = mergeActivityRows(
      [
        {
          id: "v10-1",
          label: "Field Approved",
          summary: "Field approved",
          contractTitle: "Acme MSA",
          occurredAt: "2026-05-17T10:00:00Z",
          href: "/contracts/contract-1",
          outcome: "approved",
        },
      ],
      auditRows
    );

    expect(auditRows.map((row) => row.summary)).toEqual(["Contract uploaded", "Owner changed"]);
    expect(merged.map((row) => row.id)).toEqual(["v10-1", "audit:audit-1", "audit:audit-2"]);
  });

  it("filters non-blocking count-source errors out of the visible partial-data state", () => {
    expect(
      getCoreDashboardVisiblePartialErrors([
        "blocked_work",
        "evidence_requested",
        "activity_read_model",
      ])
    ).toEqual([]);
    expect(
      getCoreDashboardVisiblePartialErrors(["blocked_work", "data_gaps", "recent_activity"])
    ).toEqual(["data_gaps", "recent_activity"]);
  });

  it("keeps empty section builders empty for an empty workspace", () => {
    expect(buildUpcomingDeadlineRows([], new Map())).toEqual([]);
    expect(buildDataGapRows([], [], new Map())).toEqual([]);
    expect(buildWorkRows([], new Map(), new Map())).toEqual([]);
    expect(buildActivityRows([], new Map())).toEqual([]);
  });

  it("marks approved deadline dates as reviewed and the computed notice deadline as derived", () => {
    const rows = buildUpcomingDeadlineRows(
      [
        {
          id: "field-renewal",
          contract_id: "contract-1",
          field_name: "renewal_date",
          field_value: "2026-06-30",
          contracts: { id: "contract-1", title: "Acme MSA", organization_id: "org-1", owner_id: null },
        },
        {
          id: "field-notice-window",
          contract_id: "contract-1",
          field_name: "notice_window",
          field_value: "30 days",
          contracts: { id: "contract-1", title: "Acme MSA", organization_id: "org-1", owner_id: null },
        },
      ],
      new Map(),
      new Date("2026-05-31T12:00:00Z"),
      90
    );

    const bySource = Object.fromEntries(rows.map((row) => [row.label, row.source]));
    expect(bySource["Renewal date"]).toBe("reviewed");
    expect(bySource["Notice deadline"]).toBe("derived");
  });

  it("orders data gaps so owner/date gaps outrank softer metadata gaps", () => {
    const contracts = [
      {
        id: "soft",
        title: "Soft Gaps Co",
        counterparty: "",
        owner_id: "owner-1",
        status: "active",
        annual_value: 1000,
        updated_at: "2026-05-03T00:00:00Z",
      },
      {
        id: "owner",
        title: "Owner Gap Co",
        counterparty: "Acme",
        owner_id: null,
        status: "active",
        annual_value: 1000,
        updated_at: "2026-05-01T00:00:00Z",
      },
    ] as unknown as Parameters<typeof buildDataGapRows>[0];

    const rows = buildDataGapRows(
      contracts,
      [
        { contract_id: "soft", field_name: "renewal_date", field_value: "2026-12-31", status: "approved" },
        { contract_id: "soft", field_name: "notice_date", field_value: "2026-10-01", status: "approved" },
        { contract_id: "owner", field_name: "renewal_date", field_value: "2026-12-31", status: "approved" },
        { contract_id: "owner", field_name: "notice_date", field_value: "2026-10-01", status: "approved" },
      ],
      new Map([["owner-1", "Ada Owner"]])
    );

    expect(rows.map((row) => row.id)).toEqual(["owner", "soft"]);
    expect(rows.find((row) => row.id === "soft")?.missing).toEqual(["Counterparty"]);
    expect(rows.find((row) => row.id === "owner")?.missing).toEqual(["Owner"]);
  });

  it("dedupes cross-source activity rows that render as the same verb on the same contract", () => {
    const merged = mergeActivityRows(
      [
        {
          id: "v10-owner",
          label: "Owner changed",
          summary: "Updated the owner",
          contractTitle: "Ridgeway Support Renewal",
          occurredAt: "2026-05-29T10:00:00Z",
          href: "/contracts/ridgeway",
          outcome: null,
        },
      ],
      [
        {
          id: "audit:owner",
          label: "Owner changed",
          summary: "Owner changed",
          contractTitle: "Ridgeway Support Renewal",
          occurredAt: "2026-05-29T09:00:00Z",
          href: "/contracts/ridgeway",
          outcome: null,
        },
        {
          id: "audit:approve",
          label: "Field approved",
          summary: "Field approved",
          contractTitle: "Ridgeway Support Renewal",
          occurredAt: "2026-05-28T09:00:00Z",
          href: "/contracts/ridgeway",
          outcome: "approved",
        },
      ]
    );

    // The two owner-change rows render identically ("CHANGED · RIDGEWAY") and
    // collapse to one; the distinct approval row survives.
    expect(merged.map((row) => row.id)).toEqual(["v10-owner", "audit:approve"]);
  });

  it("classifies contract lifecycle events by verb so created and changed do not collapse", () => {
    const merged = mergeActivityRows(
      [
        {
          id: "created",
          label: "Contract created",
          summary: "Contract created",
          contractTitle: "Acme MSA",
          occurredAt: "2026-05-30T10:00:00Z",
          href: "/contracts/acme",
          outcome: null,
        },
        {
          id: "status",
          label: "Contract status changed",
          summary: "Contract status changed",
          contractTitle: "Acme MSA",
          occurredAt: "2026-05-29T10:00:00Z",
          href: "/contracts/acme",
          outcome: null,
        },
      ],
      []
    );
    // Previously both fell back to the leading noun ("contract") and wrongly
    // deduped; now they classify as created vs changed and both survive.
    expect(merged.map((row) => row.id)).toEqual(["created", "status"]);
  });

  it("surfaces in-flight imports as the processing banner state", () => {
    const status = deriveImportStatusSummary(
      [importJobRow({ id: "p1", status: "processing", completed_at: null })],
      IMPORT_STATUS_NOW
    );
    expect(status.kind).toBe("processing");
    expect(status.processingCount).toBe(1);
    expect(status.headline).toContain("1 import");
    expect(status.href).toBe("/contracts/bulk");
  });

  it("surfaces the most recent failed import as an attention banner and ignores clean completions", () => {
    const status = deriveImportStatusSummary(
      [
        importJobRow({ id: "ok", status: "completed", error_rows: 0, completed_at: "2026-05-30T10:00:00Z" }),
        importJobRow({
          id: "bad",
          status: "failed",
          error_rows: 3,
          failure_reason: "Import stopped",
          completed_at: "2026-05-29T10:00:00Z",
        }),
      ],
      IMPORT_STATUS_NOW
    );
    expect(status.kind).toBe("attention");
    expect(status.tone).toBe("danger");
    expect(status.canRetry).toBe(true);
    expect(status.headline.length).toBeGreaterThan(0);
  });

  it("surfaces a completed-with-errors import as a warning-toned attention banner", () => {
    const status = deriveImportStatusSummary(
      [importJobRow({ status: "completed", error_rows: 2, inserted_rows: 8 })],
      IMPORT_STATUS_NOW
    );
    expect(status.kind).toBe("attention");
    expect(status.tone).toBe("warning");
  });

  it("shows no banner for a clean completion, a stale failure, or a superseded job", () => {
    expect(
      deriveImportStatusSummary([importJobRow({ status: "completed", error_rows: 0 })], IMPORT_STATUS_NOW).kind
    ).toBe("none");
    expect(
      deriveImportStatusSummary(
        [importJobRow({ status: "failed", error_rows: 2, completed_at: "2026-05-01T10:00:00Z" })],
        IMPORT_STATUS_NOW
      ).kind
    ).toBe("none");
    expect(
      deriveImportStatusSummary(
        [importJobRow({ status: "failed", error_rows: 2, superseded_by_job_id: "newer-job" })],
        IMPORT_STATUS_NOW
      ).kind
    ).toBe("none");
  });
});
