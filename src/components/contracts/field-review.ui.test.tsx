/** @vitest-environment jsdom */
import "@/test-utils/mock-navigation";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { updateContractField } from "@/actions/contracts";
import type { ExtractedField } from "@/lib/types";
import { FieldReview } from "./field-review";

vi.mock("@/actions/contracts", () => ({
  updateContractField: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(updateContractField).mockReset();
});

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
  it("surfaces a plain-language notice when critical dates need confirmation", () => {
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
    expect(notice.textContent).toMatch(/date reminders need key dates/i);
    expect(notice.textContent).toMatch(/needs confirmation/i);
    expect(notice.textContent).not.toMatch(/missing approved value/i);
    expect(notice.textContent).toMatch(/ask an editor/i);
  });

  it("contains long provenance and source evidence inside responsive review rows", () => {
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

    expect(container.querySelector("[role='list']")?.getAttribute("aria-label")).toBe(
      "Contract details to confirm"
    );
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText(/suggested detail/i).className).toContain("leading-snug");
    expect(screen.getByText(/This Agreement renews/i).className).toContain("line-clamp-3");
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
    expect(screen.getByRole("button", { name: /confirm end date/i })).toBeTruthy();

    rerender(<FieldReview fields={[approved]} canEdit />);

    expect(screen.getByText("Confirmed")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /confirm end date/i })).toBeNull();
  });

  it("blocks silent confirmation when an AI value lacks source text (§11.3)", () => {
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

    expect(screen.getByText(/source required:/i)).toBeTruthy();
    expect(screen.getByText(/mark this value unknown/i)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: /confirm counterparty/i });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("labels unresolved field decisions as Mark unknown while reusing the rejected mutation", async () => {
    vi.mocked(updateContractField).mockResolvedValueOnce({ success: true });
    const fields: ExtractedField[] = [
      baseField({
        id: "unknown-1",
        field_name: "payment_cadence",
        field_value: "monthly",
        status: "pending",
      }),
    ];

    renderWithProviders(<FieldReview fields={fields} canEdit />);

    fireEvent.click(screen.getByRole("button", { name: /mark unknown payment cadence/i }));

    await waitFor(() => {
      expect(updateContractField).toHaveBeenCalledWith("unknown-1", "rejected", undefined);
      expect(screen.getByText("Marked unknown")).toBeTruthy();
    });
  });

  it("skips a field without mutating review state", () => {
    const fields: ExtractedField[] = [
      baseField({
        id: "skip-1",
        field_name: "counterparty",
        field_value: "Acme Corp",
        status: "pending",
      }),
      baseField({
        id: "skip-2",
        field_name: "renewal_date",
        field_value: "2027-06-30",
        status: "pending",
      }),
    ];

    renderWithProviders(<FieldReview fields={fields} canEdit />);

    fireEvent.click(screen.getByRole("button", { name: /skip counterparty/i }));

    expect(updateContractField).not.toHaveBeenCalled();
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

    fireEvent.click(screen.getByRole("button", { name: /confirm end date/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/session expired/i).length).toBeGreaterThan(0);
    });
  });
});
