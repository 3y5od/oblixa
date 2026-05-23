import { describe, expect, it } from "vitest";
import { buildEvidenceHref, buildEvidencePageModel } from "./model";

const NOW = new Date("2026-05-20T12:00:00.000Z");

function baseInput(overrides: Partial<Parameters<typeof buildEvidencePageModel>[0]> = {}) {
  return {
    userId: "user_1",
    role: "admin",
    workspaceMode: "core",
    section: "open_requests",
    contract: null,
    create: null,
    requirements: [],
    submissions: [],
    readModelStatuses: [],
    externalSubmissions: [],
    contracts: [
      { id: "contract_a", title: "Atlas Services Agreement", counterparty: "Atlas Cloud Systems" },
      { id: "contract_b", title: "Northstar Security Agreement", counterparty: "Northstar Analytics" },
    ],
    obligations: [
      { id: "obligation_a", contract_id: "contract_a", title: "Collect quarterly security report" },
    ],
    members: [
      {
        user_id: "user_1",
        profiles: { full_name: "Local Dev User", email: "dev@example.com" },
      },
      {
        user_id: "reviewer_2",
        profiles: { full_name: "Reviewer Two", email: "reviewer@example.com" },
      },
    ],
    warnings: [],
    now: NOW,
    ...overrides,
  };
}

describe("Evidence page model", () => {
  it("returns the exact empty workspace surface", () => {
    const model = buildEvidencePageModel(baseInput());
    expect(model.title).toBe("Evidence");
    expect(model.primaryCta).toBe("Request evidence");
    expect(model.rows).toEqual([]);
    expect(model.sections.map((section) => section.label)).toEqual([
      "Open requests",
      "Overdue requests",
      "Received evidence",
      "Evidence linked to obligations",
    ]);
  });

  it("maps evidence request statuses into release-state statuses and sections", () => {
    const model = buildEvidencePageModel(
      baseInput({
        section: "received_evidence",
        requirements: [
          {
            id: "requested",
            title: "Upload SOC report",
            status: "required",
            due_at: "2026-05-27T12:00:00.000Z",
            contract_id: "contract_a",
            work_item_type: "contract",
            work_item_id: "contract_a",
            reviewer_id: "user_1",
          },
          {
            id: "overdue",
            title: "Upload insurance certificate",
            status: "required",
            due_at: "2026-05-10T12:00:00.000Z",
            contract_id: "contract_a",
            work_item_type: "contract",
            work_item_id: "contract_a",
            reviewer_id: "user_1",
          },
          {
            id: "received",
            title: "Submit backup attestation",
            status: "submitted",
            due_at: "2026-05-25T12:00:00.000Z",
            contract_id: "contract_a",
            work_item_type: "obligation",
            work_item_id: "obligation_a",
            reviewer_id: "reviewer_2",
          },
          {
            id: "accepted",
            title: "Accepted proof",
            status: "approved",
            due_at: "2026-05-26T12:00:00.000Z",
            contract_id: "contract_b",
            work_item_type: "contract",
            work_item_id: "contract_b",
            reviewer_id: null,
          },
          {
            id: "rejected",
            title: "Corrected proof needed",
            status: "rejected",
            due_at: "2026-05-26T12:00:00.000Z",
            contract_id: "contract_b",
            work_item_type: "contract",
            work_item_id: "contract_b",
            reviewer_id: null,
          },
          {
            id: "waived",
            title: "Waived proof",
            status: "waived",
            due_at: "2026-05-26T12:00:00.000Z",
            contract_id: "contract_b",
            work_item_type: "contract",
            work_item_id: "contract_b",
            reviewer_id: null,
          },
        ],
        submissions: [
          {
            id: "sub_received",
            requirement_id: "received",
            status: "submitted",
            submitted_at: "2026-05-19T10:00:00.000Z",
            payload_json: { files: ["backup.pdf"] },
          },
        ],
      })
    );

    expect(model.sections.find((section) => section.key === "open_requests")?.count).toBe(2);
    expect(model.sections.find((section) => section.key === "overdue_requests")?.count).toBe(1);
    expect(model.sections.find((section) => section.key === "received_evidence")?.count).toBe(3);
    expect(model.rows.map((row) => [row.requestTitle, row.statusLabel])).toEqual([
      ["Submit backup attestation", "Received"],
      ["Accepted proof", "Accepted"],
      ["Corrected proof needed", "Rejected"],
    ]);
    expect(model.rows.find((row) => row.id === "received")?.attachedFilesLabel).toBe("1 file");
    expect(model.rows.find((row) => row.id === "received")?.linkedObligationTitle).toBe(
      "Collect quarterly security report"
    );
    expect(model.rows.find((row) => row.id === "received")?.requestOwnerLabel).toBe("Reviewer Two");
  });

  it("honors contract selection, create state, warning state, and href compatibility", () => {
    const model = buildEvidencePageModel(
      baseInput({
        contract: "contract_b",
        create: "1",
        warnings: ["v10_evidence_request_statuses"],
        requirements: [
          {
            id: "a",
            title: "Atlas proof",
            status: "required",
            due_at: "2026-05-27T12:00:00.000Z",
            contract_id: "contract_a",
            work_item_type: "contract",
            work_item_id: "contract_a",
            reviewer_id: "user_1",
          },
          {
            id: "b",
            title: "Northstar proof",
            status: "required",
            due_at: "2026-05-27T12:00:00.000Z",
            contract_id: "contract_b",
            work_item_type: "contract",
            work_item_id: "contract_b",
            reviewer_id: "user_1",
          },
        ],
      })
    );
    expect(model.create.open).toBe(true);
    expect(model.create.selectedContractId).toBe("contract_b");
    expect(model.rows).toHaveLength(1);
    expect(model.rows[0]?.requestTitle).toBe("Northstar proof");
    expect(model.warnings).toEqual(["v10_evidence_request_statuses"]);
    expect(buildEvidenceHref({ section: "overdue_requests", contract: "contract_b", create: true })).toBe(
      "/contracts/evidence-studio?section=overdue_requests&contract=contract_b&create=1"
    );
  });

  it("exposes the required action vocabulary on each row", () => {
    const model = buildEvidencePageModel(
      baseInput({
        requirements: [
          {
            id: "requested",
            title: "Upload SOC report",
            status: "required",
            due_at: "2026-05-27T12:00:00.000Z",
            contract_id: "contract_a",
            work_item_type: "contract",
            work_item_id: "contract_a",
            reviewer_id: "user_1",
          },
        ],
      })
    );
    expect(model.rows[0]?.actions.map((action) => action.label)).toEqual([
      "Request evidence",
      "Upload evidence",
      "Accept",
      "Reject",
      "Send reminder",
    ]);
  });
});
