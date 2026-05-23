import { describe, expect, it } from "vitest";
import { buildReportsPageModel, REPORT_ORDER } from "./model";
import { REPORT_LABELS, REPORTS_EMPTY_STATE, REPORTS_PAGE_TITLE, REPORTS_PRIMARY_CTA } from "./spec-strings";
import type { BuildReportsPageModelInput } from "./model";

const BASE_INPUT: BuildReportsPageModelInput = {
  userId: "user-1",
  role: "admin",
  workspaceMode: "core",
  contracts: [],
  fields: [],
  workItems: [],
  obligations: [],
  exceptions: [],
  evidenceRequirements: [],
  evidenceSubmissions: [],
  exportJobs: [],
  members: [],
  now: new Date("2026-05-20T12:00:00.000Z"),
};

describe("reports page model", () => {
  it("builds the release-state reports surface for an empty workspace", () => {
    const model = buildReportsPageModel(BASE_INPUT);

    expect(model.title).toBe(REPORTS_PAGE_TITLE);
    expect(model.primaryCta).toBe(REPORTS_PRIMARY_CTA);
    expect(model.reports.map((report) => report.label)).toEqual(REPORT_ORDER.map((key) => REPORT_LABELS[key]));
    expect(model.previewRows).toEqual([]);
    expect(REPORTS_EMPTY_STATE).toBe("Reports become more useful as you review fields, assign owners, and track work.");
  });

  it("selects report previews and derives notice deadlines from renewal date plus notice window", () => {
    const model = buildReportsPageModel({
      ...fixtureInput(),
      report: "notice_deadlines",
      window: "90",
    });

    expect(model.activeDefinition.label).toBe(REPORT_LABELS.notice_deadlines);
    expect(model.previewColumns).toContain("Notice date");
    expect(model.previewRows[0]?.cells.Contract).toBe("Acme Corp MSA 2025");
    expect(model.previewRows[0]?.cells["Notice date"]).toBe("May 21, 2026");
  });

  it("falls back to the default report for stale report parameters", () => {
    const model = buildReportsPageModel({
      ...fixtureInput(),
      report: "old-control-room",
    });

    expect(model.activeReport).toBe("upcoming_renewals");
  });

  it("applies owner, counterparty, status, and window filters", () => {
    const ownerFiltered = buildReportsPageModel({
      ...fixtureInput(),
      report: "contract_inventory",
      owner: "member-1",
    });
    expect(ownerFiltered.previewRows.map((row) => row.cells.Contract)).toEqual(["Acme Corp MSA 2025"]);

    const unassigned = buildReportsPageModel({
      ...fixtureInput(),
      report: "missing_owners",
      owner: "unassigned",
    });
    expect(unassigned.previewRows.map((row) => row.cells.Contract)).toEqual(["Helios Vendor NDA"]);

    const statusFiltered = buildReportsPageModel({
      ...fixtureInput(),
      report: "contract_inventory",
      status: "pending_review",
    });
    expect(statusFiltered.previewRows.map((row) => row.cells.Status)).toEqual(["Pending Review"]);
  });

  it("builds preview rows for every required Core report type", () => {
    for (const report of REPORT_ORDER) {
      const model = buildReportsPageModel({
        ...fixtureInput(),
        report,
        previewLimit: null,
      });

      expect(model.activeDefinition.label).toBe(REPORT_LABELS[report]);
      expect(model.previewColumns.length).toBeGreaterThan(0);
      expect(model.reports.find((item) => item.key === report)?.active).toBe(true);
    }
  });

  it("keeps partial source failures recoverable and exposes last generated metadata", () => {
    const model = buildReportsPageModel({
      ...fixtureInput(),
      report: "contract_inventory",
      warnings: ["v10_work_items"],
    });

    expect(model.warnings).toEqual(["v10_work_items"]);
    expect(model.lastGeneratedLabel).toBe("May 19, 2026 5:15 AM");
  });
});

function fixtureInput(): BuildReportsPageModelInput {
  return {
    ...BASE_INPUT,
    contracts: [
      {
        id: "contract-1",
        title: "Acme Corp MSA 2025",
        counterparty: "Acme Corp",
        contract_type: "MSA",
        status: "active",
        owner_id: "member-1",
        updated_at: "2026-05-19T12:00:00.000Z",
      },
      {
        id: "contract-2",
        title: "Helios Vendor NDA",
        counterparty: "",
        contract_type: "NDA",
        status: "pending_review",
        owner_id: null,
        updated_at: "2026-05-18T12:00:00.000Z",
      },
    ],
    fields: [
      { contract_id: "contract-1", field_name: "renewal_date", field_value: "2026-06-20", status: "approved" },
      { contract_id: "contract-1", field_name: "notice_window", field_value: "30 days", status: "approved" },
      { contract_id: "contract-1", field_name: "contract_value", field_value: "250000", status: "approved" },
      { contract_id: "contract-2", field_name: "renewal_date", field_value: "2026-08-05", status: "pending" },
    ],
    workItems: [
      {
        id: "work-1",
        title: "Resolve blocked approval",
        type: "contract_task",
        status: "blocked",
        contract_id: "contract-1",
        owner_user_id: "member-1",
        due_at: "2026-05-18T12:00:00.000Z",
        blocked_reason: "Waiting on finance",
      },
    ],
    obligations: [
      {
        id: "obl-1",
        title: "Collect quarterly security report",
        contract_id: "contract-1",
        owner_id: "member-1",
        next_due_date: "2026-05-24",
        status: "open",
      },
    ],
    exceptions: [
      {
        id: "exc-1",
        title: "Notice deadline depends on pricing",
        contract_id: "contract-1",
        owner_id: "member-1",
        due_date: "2026-05-22",
        severity: "high",
        status: "open",
      },
    ],
    evidenceRequirements: [
      {
        id: "ev-1",
        title: "Upload cyber insurance certificate",
        contract_id: "contract-1",
        reviewer_id: "member-1",
        due_at: "2026-05-27",
        status: "required",
      },
    ],
    evidenceSubmissions: [{ id: "sub-1", requirement_id: "ev-1", file_count: 2 }],
    exportJobs: [
      {
        status: "completed",
        completed_at: "2026-05-19T09:15:00.000Z",
        filter_json: { report_key: "contract_inventory" },
      },
    ],
    members: [
      {
        user_id: "member-1",
        profiles: { full_name: "Local Dev User", email: "local@example.com" },
      },
    ],
  };
}
