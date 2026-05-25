/** @vitest-environment jsdom */
import "@/test-utils/mock-navigation";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { mockRouter, resetMockRouter } from "@/test-utils/mock-router";
import { EvidenceSubmissionForm } from "./evidence-submission-form";

const submitEvidenceNoteAction = vi.fn();

vi.mock("@/actions/policy-operations", () => ({
  submitEvidenceNoteAction,
}));

describe("EvidenceSubmissionForm", () => {
  afterEach(() => {
    resetMockRouter();
    submitEvidenceNoteAction.mockReset();
  });

  it("preserves the note on failure and maps recoverable errors into user-safe copy", async () => {
    const user = userEvent.setup();
    submitEvidenceNoteAction.mockResolvedValueOnce({ error: "Not authenticated" });

    renderWithProviders(<EvidenceSubmissionForm requirementId="req-1" status="required" />);

    const noteField = screen.getByLabelText(/submission/i);
    await user.type(noteField, "Vendor portal link");
    expect(screen.getByText(/leaving this page now will discard the draft note/i)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /submit evidence/i }));

    expect((await screen.findByRole("alert")).textContent).toContain("session expired");
    expect(noteField).toHaveProperty("value", "Vendor portal link");
    expect(mockRouter.refresh).not.toHaveBeenCalled();
  });

  it("clears the note and refreshes after success", async () => {
    const user = userEvent.setup();
    submitEvidenceNoteAction.mockResolvedValueOnce({
      success: "Evidence submitted. Reviewers can now confirm whether the linked work item can clear.",
    });

    renderWithProviders(<EvidenceSubmissionForm requirementId="req-1" status="required" />);

    const noteField = screen.getByLabelText(/submission/i);
    await user.type(noteField, "Vendor portal link");
    await user.click(screen.getByRole("button", { name: /submit evidence/i }));

    expect((await screen.findByRole("status")).textContent).toMatch(/evidence submitted/i);
    await waitFor(() => expect(noteField).toHaveProperty("value", ""));
    expect(mockRouter.refresh).toHaveBeenCalled();
  });
});
