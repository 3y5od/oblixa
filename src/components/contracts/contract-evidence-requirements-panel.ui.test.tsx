/** @vitest-environment jsdom */
import "@/test-utils/mock-navigation";
import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { ContractEvidenceRequirementsPanel } from "./contract-evidence-requirements-panel";

vi.mock("@/actions/v4", () => ({
  submitEvidenceNoteAction: vi.fn(async () => ({ ok: true })),
}));

describe("ContractEvidenceRequirementsPanel", () => {
  /** docs/v9.md §15.2 — one row must expose all six presentation bullets */
  it("§15.2: single requirement shows what, why, linked-to, who, due, and status", () => {
    renderWithProviders(
      <ContractEvidenceRequirementsPanel
        canEdit={false}
        contractId="contract-xyz"
        requirements={[
          {
            id: "req-single",
            title: "Board resolution pack",
            requirement_type: "legal_pack",
            status: "required",
            due_at: "2026-06-15T00:00:00.000Z",
            review_due_at: "2026-06-20T00:00:00.000Z",
            work_item_type: "obligation",
            work_item_id: "obligation-uuid-1234567890",
          },
        ]}
      />
    );

    const card = screen.getByText("Board resolution pack").closest("li");
    expect(card).toBeTruthy();
    expect((card as HTMLElement).getAttribute("data-v9-evidence-req-status")).toBe("required");
    const region = within(card as HTMLElement);
    expect(region.getByText(/legal pack · requested · due 2026-06-15 · review by 2026-06-20/i)).toBeTruthy();
    expect(region.getByText(/^Why it matters:/)).toBeTruthy();
    expect(region.getByText(/obligation obligati/u)).toBeTruthy();
    expect(region.getByText(/^Who should act next:/)).toBeTruthy();
    expect(region.getByText("Evidence provider or contract owner")).toBeTruthy();
    expect(
      region.getByText(/this requirement is still blocking completion of the linked work item/i)
    ).toBeTruthy();
  });

  it("surfaces v9 evidence state copy and contract-level export", () => {
    renderWithProviders(
      <ContractEvidenceRequirementsPanel
        canEdit
        canReview
        contractId="contract-123"
        requirements={[
          {
            id: "req-1",
            title: "Security questionnaire",
            requirement_type: "questionnaire",
            status: "required",
            due_at: "2026-05-01T00:00:00.000Z",
            review_due_at: null,
            work_item_type: "task",
            work_item_id: "work-item-abcdef",
          },
          {
            id: "req-2",
            title: "Insurance certificate",
            requirement_type: "certificate",
            status: "submitted",
            due_at: null,
            review_due_at: "2026-05-03T00:00:00.000Z",
            work_item_type: "approval",
            work_item_id: "approval-abcdef",
          },
          {
            id: "req-3",
            title: "SOC 2 report",
            requirement_type: "report",
            status: "rejected",
            due_at: null,
            review_due_at: null,
            work_item_type: "task",
            work_item_id: "task-abcdef",
          },
        ]}
        latestSubmissionByRequirement={{
          "req-2": {
            id: "submission-2",
            status: "submitted",
            submitted_at: "2026-05-02T00:00:00.000Z",
            reviewed_at: null,
            rejection_reason: null,
            payload_json: {
              note: "Uploaded certificate in vendor portal",
            },
          },
          "req-3": {
            id: "submission-3",
            status: "rejected",
            submitted_at: "2026-05-01T00:00:00.000Z",
            reviewed_at: "2026-05-02T00:00:00.000Z",
            rejection_reason: "Need the current reporting period, not last year's file",
            payload_json: {
              note: "Uploaded prior SOC 2 package",
            },
          },
        }}
      />
    );

    expect(
      screen.getByText(/this requirement is still blocking completion of the linked work item/i)
    ).toBeTruthy();
    expect(
      screen.getByText(/submission is waiting for review before the linked work item can clear/i)
    ).toBeTruthy();
    expect(
      screen.getByText(/rejected evidence still needs a corrected resubmission/i)
    ).toBeTruthy();
    expect(screen.getAllByText(/who should act next:/i)).toHaveLength(3);
    expect(
      screen.getByText((_, element) =>
        element?.textContent === "Latest submission: Uploaded certificate in vendor portal"
      )
    ).toBeTruthy();
    expect(
      screen.getByText((_, element) =>
        element?.textContent ===
        "Rejection reason: Need the current reporting period, not last year's file"
      )
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /^submit evidence$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^resubmit evidence$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /approve evidence/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /reject evidence/i })).toBeTruthy();
    expect(screen.getByText(/questionnaire · requested/i)).toBeTruthy();
    expect(screen.getByText(/certificate · submitted/i)).toBeTruthy();
    expect(screen.getByText(/report · rejected/i)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /export evidence pack \(json\)/i }).getAttribute("href")
    ).toBe("/api/evidence/export/contract-123");

    expect(screen.getByText("Security questionnaire").closest("li")?.getAttribute("data-v9-evidence-req-status")).toBe(
      "required"
    );
    expect(screen.getByText("Insurance certificate").closest("li")?.getAttribute("data-v9-evidence-req-status")).toBe(
      "submitted"
    );
    expect(screen.getByText("SOC 2 report").closest("li")?.getAttribute("data-v9-evidence-req-status")).toBe("rejected");

    const requiredCard = screen.getByText("Security questionnaire").closest("li") as HTMLElement;
    expect(
      within(requiredCard).getByText(/this requirement is still blocking completion of the linked work item/i)
        .className
    ).toMatch(/text-amber-700/);

    const insuranceCard = screen.getByText("Insurance certificate").closest("li") as HTMLElement;
    expect(
      within(insuranceCard).getByText(/submission is waiting for review before the linked work item can clear/i)
        .className
    ).toMatch(/text-amber-700/);
    const socCard = screen.getByText("SOC 2 report").closest("li") as HTMLElement;
    expect(
      within(socCard).getByText(/rejected evidence still needs a corrected resubmission/i).className
    ).toMatch(/text-rose-700/);
  });
});
