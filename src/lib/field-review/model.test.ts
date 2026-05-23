import { describe, expect, it } from "vitest";
import type { ExtractedField } from "@/lib/types";
import {
  buildFieldReviewWorkspaceModel,
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
    expect(model.documentPreview?.sourceFileNames).toEqual(["signed-msa.docx"]);
  });

  it("keeps release-state important field aliases explicit", () => {
    expect(getImportantFieldLabel("notice_window")).toBe("Notice deadline");
    expect(getImportantFieldLabel("end_date")).toBe("Termination date");
    expect(getImportantFieldLabel("fee_reference")).toBe("Contract value");
    expect(getImportantFieldLabel("payment_cadence")).toBe("Payment terms");
    expect(getImportantFieldLabel("auto_renewal")).toBe("Auto-renewal");
  });

  it("preserves loader warnings in a usable model", () => {
    const model = buildFieldReviewWorkspaceModel({
      contracts: [contract({ extracted_fields: [field({ id: "field-1" })] })],
      warnings: ["Contract review data is partially unavailable."],
    });

    expect(model.warnings).toEqual(["Contract review data is partially unavailable."]);
    expect(model.activeField?.id).toBe("field-1");
  });
});
