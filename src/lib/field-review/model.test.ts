import { describe, expect, it } from "vitest";
import type { ExtractedField } from "@/lib/types";
import {
  buildFieldReviewWorkspaceModel,
  deriveFieldImpactCopy,
  getImportantFieldLabel,
  sortPendingFieldsForReview,
  type FieldReviewContract,
} from "./model";

const field = (overrides: Partial<ExtractedField>): ExtractedField => ({
  id: "field-1",
  contract_id: "contract-1",
  field_name: "counterparty",
  field_value: "Acme Corp",
  source_snippet: "Acme Corp",
  confidence: 0.91,
  status: "pending",
  source: "ai",
  reviewed_by: null,
  reviewed_at: null,
  created_at: "2026-05-01T00:00:00.000Z",
  updated_at: "2026-05-01T00:00:00.000Z",
  ...overrides,
});

const contract = (overrides: Partial<FieldReviewContract>): FieldReviewContract => ({
  id: "contract-1",
  organization_id: "org-1",
  title: "Acme Corp MSA 2025",
  counterparty: "Acme Corp",
  contract_type: "MSA",
  search_document: "This Master Services Agreement is between Acme Corp and Example LLC.",
  status: "pending_review",
  owner_id: null,
  created_by: null,
  created_at: "2026-05-01T00:00:00.000Z",
  updated_at: "2026-05-02T00:00:00.000Z",
  contract_files: [],
  extracted_fields: [],
  ...overrides,
});

describe("field-review workspace model", () => {
  it("returns the release-state empty workspace when no fields need review", () => {
    const model = buildFieldReviewWorkspaceModel({ contracts: [], page: 1, pageSize: 10 });

    expect(model.activeContract).toBeNull();
    expect(model.activeField).toBeNull();
    expect(model.progress.fieldsWaiting).toBe(0);
    expect(model.queue).toEqual([]);
  });

  it("selects pending important fields before lower-priority fields", () => {
    const sorted = sortPendingFieldsForReview([
      field({ id: "payment", field_name: "payment_cadence", created_at: "2026-04-01T00:00:00.000Z" }),
      field({ id: "renewal", field_name: "renewal_date", created_at: "2026-05-01T00:00:00.000Z" }),
      field({ id: "misc", field_name: "custom_note", created_at: "2026-03-01T00:00:00.000Z" }),
    ]);

    expect(sorted.map((row) => row.id)).toEqual(["renewal", "payment", "misc"]);
  });

  it("honors selected contract and field params when they are still pending", () => {
    const model = buildFieldReviewWorkspaceModel({
      contracts: [
        contract({
          id: "contract-1",
          extracted_fields: [field({ id: "field-1", contract_id: "contract-1" })],
        }),
        contract({
          id: "contract-2",
          title: "Beta NDA",
          extracted_fields: [
            field({ id: "field-2a", contract_id: "contract-2", field_name: "counterparty" }),
            field({ id: "field-2b", contract_id: "contract-2", field_name: "renewal_date" }),
          ],
        }),
      ],
      selectedContractId: "contract-2",
      selectedFieldId: "field-2b",
    });

    expect(model.activeContract?.id).toBe("contract-2");
    expect(model.activeField?.id).toBe("field-2b");
    expect(model.activeContract?.contractType).toBe("MSA");
    // field-2b is the last pending item, so prev points back to field-2a and there is no next.
    expect(model.prevHref).toContain("field=field-2a");
    expect(model.nextHref).toBeNull();
  });

  it("exposes prevHref as null on the first pending item", () => {
    const model = buildFieldReviewWorkspaceModel({
      contracts: [
        contract({ extracted_fields: [field({ id: "field-1", contract_id: "contract-1" })] }),
      ],
    });

    expect(model.prevHref).toBeNull();
  });

  it("falls back to the first pending field when selected params are stale", () => {
    const model = buildFieldReviewWorkspaceModel({
      contracts: [
        contract({
          id: "contract-1",
          extracted_fields: [field({ id: "field-1", contract_id: "contract-1" })],
        }),
      ],
      selectedContractId: "missing-contract",
      selectedFieldId: "missing-field",
    });

    expect(model.activeContract?.id).toBe("contract-1");
    expect(model.activeField?.id).toBe("field-1");
  });

  it("derives current approved value from an approved field with the same name", () => {
    const model = buildFieldReviewWorkspaceModel({
      contracts: [
        contract({
          extracted_fields: [
            field({ id: "approved", status: "approved", field_value: "Old Acme Corp" }),
            field({ id: "pending", status: "pending", field_value: "Acme Corp" }),
          ],
        }),
      ],
      selectedFieldId: "pending",
    });

    expect(model.activeField?.currentApprovedValue).toBe("Old Acme Corp");
    // A differing prior approval flags a conflict (approving overwrites trusted data).
    expect(model.activeField?.approvedConflict).toBe(true);
  });

  it("does not flag a conflict when no prior approval exists", () => {
    const model = buildFieldReviewWorkspaceModel({
      contracts: [
        contract({ extracted_fields: [field({ id: "pending", status: "pending" })] }),
      ],
    });

    expect(model.activeField?.currentApprovedValue).toBeNull();
    expect(model.activeField?.approvedConflict).toBe(false);
  });

  it("builds a document preview near the source snippet when searchable text exists", () => {
    const model = buildFieldReviewWorkspaceModel({
      contracts: [
        contract({
          search_document:
            "Intro text. This Agreement automatically renews for successive one-year periods unless either party gives notice. Closing text.",
          extracted_fields: [
            field({
              id: "renewal",
              field_name: "renewal_date",
              field_value: "Automatic renewal",
              source_snippet: "automatically renews for successive one-year periods",
            }),
          ],
        }),
      ],
    });

    expect(model.documentPreview?.status).toBe("available");
    expect(model.documentPreview?.excerpt).toMatch(/automatically renews/);
    expect(model.documentPreview?.snippetLocated).toBe(true);
  });

  it("reports snippetLocated false when the snippet is not in the document text", () => {
    const model = buildFieldReviewWorkspaceModel({
      contracts: [
        contract({
          search_document: "Unrelated boilerplate that does not mention the clause at all.",
          extracted_fields: [
            field({
              id: "renewal",
              field_name: "renewal_date",
              field_value: "2026-08-18",
              source_snippet: "automatically renews for successive one-year periods",
            }),
          ],
        }),
      ],
    });

    expect(model.documentPreview?.status).toBe("available");
    expect(model.documentPreview?.snippetLocated).toBe(false);
  });

  it("falls back to source-file metadata when document text is unavailable", () => {
    const model = buildFieldReviewWorkspaceModel({
      contracts: [
        contract({
          search_document: null,
          contract_files: [
            {
              id: "file-1",
              contract_id: "contract-1",
              file_name: "signed-msa.docx",
              file_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              file_size: 1000,
              storage_path: "org/contract/file.docx",
              uploaded_by: null,
              created_at: "2026-05-01T00:00:00.000Z",
            },
          ],
          extracted_fields: [field({ id: "field-1" })],
        }),
      ],
    });

    expect(model.documentPreview?.status).toBe("unavailable");
    expect(model.documentPreview?.snippetLocated).toBe(false);
    expect(model.documentPreview?.sourceFileNames).toEqual(["signed-msa.docx"]);
  });

  it("keeps release-state important field aliases explicit", () => {
    expect(getImportantFieldLabel("notice_window")).toBe("Notice deadline");
    expect(getImportantFieldLabel("end_date")).toBe("Termination date");
    expect(getImportantFieldLabel("fee_reference")).toBe("Contract value");
    expect(getImportantFieldLabel("payment_cadence")).toBe("Payment terms");
    expect(getImportantFieldLabel("auto_renewal")).toBe("Auto-renewal");
  });

  it("derives plain-language impact copy for detail confirmation", () => {
    expect(deriveFieldImpactCopy("auto_renewal")).toBe(
      "Shows whether the contract renews automatically, so renewal tasks and reports can flag contracts that continue unless cancelled."
    );
    expect(deriveFieldImpactCopy("notice_deadline")).toBe(
      "Records the last day to send notice, so Oblixa can warn before that deadline passes."
    );
    expect(deriveFieldImpactCopy("notice_window")).toBe(
      "Records the amount of advance notice required, so Oblixa can calculate the last day to send notice."
    );
    expect(deriveFieldImpactCopy("renewal_date")).toBe("Sets the date used for renewal reminders, renewal lists, and reports.");
    expect(deriveFieldImpactCopy("owner_id")).toBe(
      "Assigns the responsible person for reminders, tasks, evidence requests, and reports."
    );
    expect(deriveFieldImpactCopy("counterparty")).toBe(
      "Identifies the other organization or person on the contract for search, grouping, and reports."
    );
    expect(deriveFieldImpactCopy("payment_terms")).toBe(
      "Records payment timing and billing terms for contract tracking, tasks, and reports."
    );
    expect(deriveFieldImpactCopy("contract_value")).toBe(
      "Records contract value for inventory, prioritization, and reports."
    );
    expect(deriveFieldImpactCopy("effective_date")).toBe(
      "Sets when the contract starts, so status, reminders, and reports use the correct date."
    );
    expect(deriveFieldImpactCopy("termination_date")).toBe(
      "Sets when the contract ends or terminates, so status, renewal timing, and reports use the correct date."
    );
    expect(deriveFieldImpactCopy("obligations")).toBe(
      "Records a contract requirement that may need a task, evidence request, or owner."
    );
    expect(deriveFieldImpactCopy("governing_law")).toBe(
      "Records the law or jurisdiction that applies, so legal and contract questions can be routed correctly."
    );
    expect(deriveFieldImpactCopy("custom_detail")).toBe(
      "After confirmation, this detail can appear in contract views, tasks, reminders, and reports."
    );
  });

  it("preserves loader warnings in a usable model", () => {
    const model = buildFieldReviewWorkspaceModel({
      contracts: [contract({ extracted_fields: [field({ id: "field-1" })] })],
      warnings: ["Contract review data is partially unavailable."],
    });

    expect(model.warnings).toEqual(["Contract review data is partially unavailable."]);
    expect(model.activeField?.id).toBe("field-1");
    expect(model.activeField?.impactCopy).toBe(
      "Identifies the other organization or person on the contract for search, grouping, and reports."
    );
  });

  it("classifies active-field source quality by snippet location and source type", () => {
    const located = buildFieldReviewWorkspaceModel({
      contracts: [
        contract({
          search_document: "Section 4. The renewal date is 2026-08-18 unless terminated.",
          extracted_fields: [
            field({ id: "f1", field_name: "renewal_date", field_value: "2026-08-18", source_snippet: "renewal date is 2026-08-18" }),
          ],
        }),
      ],
    });
    expect(located.activeField?.sourceQuality).toBe("located");

    const notLocated = buildFieldReviewWorkspaceModel({
      contracts: [
        contract({
          search_document: "Boilerplate that never mentions the clause.",
          extracted_fields: [field({ id: "f1", source_snippet: "an entirely different clause" })],
        }),
      ],
    });
    expect(notLocated.activeField?.sourceQuality).toBe("snippet-missing");

    const noPreview = buildFieldReviewWorkspaceModel({
      contracts: [
        contract({ search_document: null, extracted_fields: [field({ id: "f1", source_snippet: "x" })] }),
      ],
    });
    expect(noPreview.activeField?.sourceQuality).toBe("preview-unavailable");

    const manual = buildFieldReviewWorkspaceModel({
      contracts: [contract({ extracted_fields: [field({ id: "f1", source: "human" })] })],
    });
    expect(manual.activeField?.sourceQuality).toBe("manual");
  });

  it("computes per-contract review segments for the active contract", () => {
    const model = buildFieldReviewWorkspaceModel({
      contracts: [
        contract({
          extracted_fields: [
            field({ id: "a", status: "approved", field_name: "counterparty" }),
            field({ id: "e", status: "edited", field_name: "renewal_date" }),
            field({ id: "r", status: "rejected", field_name: "notice_window" }),
            field({ id: "p", status: "pending", field_name: "payment_terms" }),
          ],
        }),
      ],
      selectedFieldId: "p",
    });

    expect(model.progress.activeContractSegments).toEqual({
      reviewed: 2,
      pending: 1,
      unknown: 1,
      skipped: 0,
      blockedNoSource: 0,
      total: 4,
    });
  });

  it("counts pending fields as blocked when the contract has no source text", () => {
    const model = buildFieldReviewWorkspaceModel({
      contracts: [
        contract({
          search_document: null,
          extracted_fields: [
            field({ id: "p1", status: "pending", field_name: "renewal_date" }),
            field({ id: "p2", status: "pending", field_name: "notice_window" }),
          ],
        }),
      ],
    });

    expect(model.progress.activeContractSegments.blockedNoSource).toBe(2);
  });

  it("builds the in-contract field mini-queue marking the current field in review order", () => {
    const model = buildFieldReviewWorkspaceModel({
      contracts: [
        contract({
          extracted_fields: [
            field({ id: "f-note", field_name: "custom_note", created_at: "2026-03-01T00:00:00.000Z" }),
            field({ id: "f-counter", field_name: "counterparty", created_at: "2026-04-01T00:00:00.000Z" }),
            field({ id: "f-renew", field_name: "renewal_date", created_at: "2026-05-01T00:00:00.000Z" }),
          ],
        }),
      ],
      selectedFieldId: "f-renew",
    });

    expect(model.activeFieldQueue).toHaveLength(3);
    expect(model.activeFieldQueue.find((f) => f.isCurrent)?.id).toBe("f-renew");
    // Important alias rank wins over created order: counterparty → renewal → note.
    expect(model.activeFieldQueue.map((f) => f.id)).toEqual(["f-counter", "f-renew", "f-note"]);
  });

  it("exposes full-set filter counts and the filtered count", () => {
    const model = buildFieldReviewWorkspaceModel({
      contracts: [
        contract({ id: "c1", owner_id: "u1", extracted_fields: [field({ id: "f1", contract_id: "c1" })] }),
        contract({ id: "c2", title: "Beta", owner_id: "u2", extracted_fields: [field({ id: "f2", contract_id: "c2" })] }),
      ],
      viewerId: "u1",
      filter: "mine",
    });

    expect(model.filterCounts.all).toBe(2);
    expect(model.filterCounts.mine).toBe(1);
    expect(model.filteredCount).toBe(1);
  });
});
