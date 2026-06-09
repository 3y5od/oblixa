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
      "Open",
      "Overdue",
      "Received",
      "Linked requirements",
    ]);
  });

  it("auto-picks the first non-empty section when no explicit section is requested", () => {
    const model = buildEvidencePageModel(
      baseInput({
        section: null,
        requirements: [
          {
            id: "overdue",
            title: "Upload insurance certificate",
            status: "required",
            due_at: "2026-05-10T12:00:00.000Z",
            contract_id: "contract_a",
            work_item_type: "obligation",
            work_item_id: "obligation_a",
            reviewer_id: "user_1",
          },
        ],
      })
    );
    // Open is empty, so the page lands on the overdue queue instead of a blank
    // Open tab while live work exists.
    expect(model.activeSection).toBe("overdue_requests");
    expect(model.sections.find((section) => section.key === "open_requests")?.count).toBe(0);
    expect(model.sections.find((section) => section.key === "overdue_requests")?.count).toBe(1);
    expect(model.rows.map((row) => row.requestTitle)).toEqual(["Upload insurance certificate"]);
    // The Open tab carries an explicit, sticky section token (not the bare
    // path) so clicking it does not re-fire the auto-pick default.
    expect(model.sections.find((section) => section.key === "open_requests")?.href).toBe(
      "/evidence?section=open_requests"
    );
  });

  it("falls back to open requests when no section has work", () => {
    const model = buildEvidencePageModel(baseInput({ section: null }));
    expect(model.activeSection).toBe("open_requests");
    expect(model.rows).toEqual([]);
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
      "/evidence?section=overdue_requests&contract=contract_b&create=1"
    );
  });

  it("exposes a state-contextual action set on each row", () => {
    // An open request: upload + remind only — no "Accept" on a request with
    // nothing submitted, no redundant "Request evidence".
    const open = buildEvidencePageModel(
      baseInput({
        section: "open_requests",
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
    expect(open.rows[0]?.actions.map((action) => action.label)).toEqual([
      "Upload evidence",
      "Send reminder",
    ]);
    expect(open.rows[0]?.actions.map((action) => action.key)).not.toContain("accept");

    // A received submission: the review actions appear instead.
    const received = buildEvidencePageModel(
      baseInput({
        section: "received_evidence",
        requirements: [
          {
            id: "received",
            title: "Submit attestation",
            status: "submitted",
            due_at: "2026-05-27T12:00:00.000Z",
            contract_id: "contract_a",
            work_item_type: "obligation",
            work_item_id: "obligation_a",
            reviewer_id: "user_1",
          },
        ],
        submissions: [
          {
            id: "sub_received",
            requirement_id: "received",
            status: "submitted",
            submitted_at: "2026-05-19T10:00:00.000Z",
            payload_json: { files: ["attestation.pdf"] },
          },
        ],
      })
    );
    expect(received.rows[0]?.actions.map((action) => action.label)).toEqual(["Accept", "Reject"]);
  });

  it("applies owner, due, and file filters and builds filter options", () => {
    const requirements = [
      {
        id: "soon",
        title: "Upload SOC report",
        status: "required",
        due_at: "2026-05-24T12:00:00.000Z", // 4 days out → due_soon, missing file
        contract_id: "contract_a",
        work_item_type: "contract",
        work_item_id: "contract_a",
        reviewer_id: "user_1",
      },
      {
        id: "later",
        title: "Renewal proof",
        status: "required",
        due_at: "2026-06-30T12:00:00.000Z", // far out, has a file
        contract_id: "contract_b",
        work_item_type: "obligation",
        work_item_id: "obligation_a",
        reviewer_id: "reviewer_2",
      },
      {
        id: "overdue",
        title: "Insurance cert",
        status: "required",
        due_at: "2026-05-10T12:00:00.000Z", // overdue, unassigned, missing file
        contract_id: "contract_a",
        work_item_type: "contract",
        work_item_id: "contract_a",
        reviewer_id: null,
      },
    ];
    const submissions = [
      {
        id: "sub_later",
        requirement_id: "later",
        status: "submitted",
        submitted_at: "2026-05-19T10:00:00.000Z",
        payload_json: { files: ["renewal.pdf"] },
      },
    ];

    const all = buildEvidencePageModel(baseInput({ section: null, requirements, submissions }));
    expect(all.totalUnfilteredRows).toBe(3);
    expect(all.hasActiveFilters).toBe(false);
    expect(all.summary.dueSoon).toBe(1);
    expect(all.summary.missingFile).toBe(2);
    expect(all.filterOptions.owners.map((option) => option.value)).toEqual(
      expect.arrayContaining(["", "user_1", "reviewer_2", "unassigned"])
    );
    expect(all.filterOptions.contracts.map((option) => option.value)).toEqual(
      expect.arrayContaining(["", "contract_a", "contract_b"])
    );
    expect(all.filterOptions.obligations.map((option) => option.value)).toEqual(
      expect.arrayContaining(["", "obligation_a"])
    );

    const owned = buildEvidencePageModel(
      baseInput({ section: null, requirements, submissions, owner: "user_1" })
    );
    expect(owned.hasActiveFilters).toBe(true);
    expect(owned.totalVisibleRows).toBe(1);
    expect(owned.rows.map((row) => row.id)).toEqual(["soon"]);

    const unassigned = buildEvidencePageModel(
      baseInput({ section: null, requirements, submissions, owner: "unassigned" })
    );
    expect(unassigned.rows.map((row) => row.id)).toEqual(["overdue"]);

    const dueSoon = buildEvidencePageModel(
      baseInput({ section: null, requirements, submissions, due: "due_soon" })
    );
    expect(dueSoon.totalVisibleRows).toBe(1);
    expect(dueSoon.rows[0]?.id).toBe("soon");
    expect(dueSoon.rows[0]?.dueState).toBe("due_soon");
    expect(dueSoon.rows[0]?.dueInDays).toBe(4);

    const missing = buildEvidencePageModel(
      baseInput({ section: null, requirements, submissions, file: "missing_file" })
    );
    expect(missing.totalVisibleRows).toBe(2);
    expect(missing.rows.every((row) => row.attachedFilesCount === 0)).toBe(true);
  });

  it("encodes filters into the evidence href", () => {
    expect(
      buildEvidenceHref({
        section: "open_requests",
        filters: {
          owner: "user_1",
          contract: "contract_a",
          obligation: "",
          due: "due_soon",
          file: "missing_file",
        },
      })
    ).toBe(
      "/evidence?section=open_requests&contract=contract_a&owner=user_1&due=due_soon&file=missing_file"
    );
  });

  it("filters by status and surfaces status filter options", () => {
    const requirements = [
      {
        id: "req",
        title: "Open req",
        status: "required",
        due_at: "2026-06-10T12:00:00.000Z",
        contract_id: "contract_a",
        work_item_type: "contract",
        work_item_id: "contract_a",
        reviewer_id: "user_1",
      },
      {
        id: "rej",
        title: "Rejected proof",
        status: "rejected",
        due_at: "2026-06-10T12:00:00.000Z",
        contract_id: "contract_a",
        work_item_type: "contract",
        work_item_id: "contract_a",
        reviewer_id: "user_1",
      },
    ];
    // Both land in Open (requested + rejected); status=rejected narrows it.
    const model = buildEvidencePageModel(
      baseInput({ section: "open_requests", requirements, status: "rejected" })
    );
    expect(model.hasActiveFilters).toBe(true);
    expect(model.rows.map((row) => row.id)).toEqual(["rej"]);
    expect(model.filterOptions.statuses.map((option) => option.value)).toEqual(
      expect.arrayContaining(["", "requested", "rejected"])
    );
  });

  it("paginates the active section and clamps an over-range page", () => {
    const many = Array.from({ length: 30 }, (_, index) => ({
      id: `r${index}`,
      title: `Evidence request ${index}`,
      status: "required",
      due_at: "2026-06-10T12:00:00.000Z",
      contract_id: "contract_a",
      work_item_type: "contract",
      work_item_id: "contract_a",
      reviewer_id: "user_1",
    }));

    const p1 = buildEvidencePageModel(baseInput({ section: "open_requests", requirements: many }));
    expect(p1.pageInfo.totalInSection).toBe(30);
    expect(p1.pageInfo.totalPages).toBe(2);
    expect(p1.pageInfo.page).toBe(1);
    expect(p1.rows).toHaveLength(25);
    // The header/footer totals still reflect the full filtered set, not the page.
    expect(p1.totalVisibleRows).toBe(30);

    const p2 = buildEvidencePageModel(
      baseInput({ section: "open_requests", requirements: many, page: "2" })
    );
    expect(p2.pageInfo.page).toBe(2);
    expect(p2.rows).toHaveLength(5);

    const overRange = buildEvidencePageModel(
      baseInput({ section: "open_requests", requirements: many, page: "9" })
    );
    expect(overRange.pageInfo.page).toBe(2);
    expect(overRange.rows).toHaveLength(5);
  });
});
