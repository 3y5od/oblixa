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

// V9 review-queue anchor: key date coverage still needs review (see v9-review-queue-surface.v9.test.ts)
describe("FieldReview — §11.2 critical date grouping", () => {
  it("surfaces an operator-first blocker when critical dates are pending or lack approved values", () => {
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

    const notice = screen.getByTestId("critical-date-review-notice");
    expect(notice.textContent).toMatch(/date automation is blocked/i);
    expect(notice.textContent).toMatch(/needs review/i);
    expect(notice.textContent).toMatch(/missing approved value/i);
    expect(notice.textContent).toMatch(/ask an editor/i);
  });

  it("contains long provenance and source evidence inside the fixed review table", () => {
    const fields: ExtractedField[] = [
      baseField({
        id: "long-copy",
        field_name: "renewal_date",
        field_value: "2028-04-01 / automatically renews unless terminated",
        status: "pending",
        source_snippet:
          "This Agreement renews on April 1, 2028 unless written notice is delivered ninety days before renewal.",
      }),
    ];

    const { container } = renderWithProviders(<FieldReview fields={fields} canEdit />);

    expect(container.querySelector("table")?.className).toContain("table-fixed");
    expect(screen.getByText(/extracted suggestion/i).className).toContain("break-words");
    expect(screen.getByText(/This Agreement renews/i).closest("blockquote")?.className).toContain("overflow-y-auto");
  });

  it("keeps row state in sync when refreshed field props change", () => {
    const pending = baseField({
      id: "sync-row",
      field_name: "end_date",
      field_value: "2027-06-30",
      status: "pending",
      source_snippet: "June 30, 2027",
    });
    const approved = { ...pending, status: "approved" as const };

    const { rerender } = renderWithProviders(<FieldReview fields={[pending]} canEdit />);
    expect(screen.getByRole("button", { name: /approve end date/i })).toBeTruthy();

    rerender(<FieldReview fields={[approved]} canEdit />);

    expect(screen.getByText("Approved")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /approve end date/i })).toBeNull();
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
