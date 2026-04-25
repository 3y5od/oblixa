/** @vitest-environment jsdom */
import "@/test-utils/mock-navigation";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { updateContractField } from "@/actions/contracts";
import type { ExtractedField } from "@/lib/types";
import { FieldReview } from "./field-review";

vi.mock("@/actions/contracts", () => ({
  updateContractField: vi.fn(),
}));

const baseField = (overrides: Partial<ExtractedField>): ExtractedField => ({
  id: "f-id",
  contract_id: "c-id",
  field_name: "title",
  field_value: "Acme MSA",
  source_snippet: "Acme MSA",
  confidence: 0.9,
  status: "approved",
  source: "ai",
  reviewed_by: null,
  reviewed_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("FieldReview — §11.2 critical date grouping", () => {
  it("surfaces a grouped banner when critical dates are pending or lack approved values", () => {
    const fields: ExtractedField[] = [
      baseField({
        id: "1",
        field_name: "end_date",
        field_value: "2027-06-30",
        status: "pending",
        source_snippet: "June 30, 2027",
      }),
      baseField({
        id: "2",
        field_name: "renewal_date",
        field_value: "2027-05-01",
        status: "pending",
        source_snippet: "May 1, 2027",
      }),
      baseField({
        id: "3",
        field_name: "notice_window",
        field_value: "90 days",
        status: "pending",
        source_snippet: "ninety days",
      }),
    ];

    renderWithProviders(<FieldReview fields={fields} canEdit={false} />);

    expect(screen.getByText(/key date coverage still needs review/i)).toBeTruthy();
    expect(screen.getByText(/pending now:/i).textContent).toMatch(/end date/i);
    expect(screen.getByText(/pending now:/i).textContent).toMatch(/renewal date/i);
    expect(screen.getByText(/still missing an approved value:/i).textContent).toMatch(/end date/i);
  });

  it("blocks silent approval when AI value lacks citation (§11.3)", () => {
    const fields: ExtractedField[] = [
      baseField({
        id: "c1",
        field_name: "counterparty",
        field_value: "Contoso Ltd",
        status: "pending",
        source: "ai",
        source_snippet: null,
        confidence: 0.55,
      }),
    ];

    renderWithProviders(<FieldReview fields={fields} canEdit />);

    expect(screen.getByText(/citation required:/i)).toBeTruthy();
    const approve = screen.getByRole("button", { name: /approve counterparty/i });
    expect((approve as HTMLButtonElement).disabled).toBe(true);
  });

  it("maps recoverable review errors to plain-language copy", async () => {
    vi.mocked(updateContractField).mockResolvedValueOnce({ error: "Not authenticated" });

    const fields: ExtractedField[] = [
      baseField({
        id: "r1",
        field_name: "end_date",
        field_value: "2027-06-30",
        status: "pending",
      }),
    ];

    renderWithProviders(<FieldReview fields={fields} canEdit />);

    fireEvent.click(screen.getByRole("button", { name: /approve end date/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/session expired/i).length).toBeGreaterThan(0);
    });
  });
});
