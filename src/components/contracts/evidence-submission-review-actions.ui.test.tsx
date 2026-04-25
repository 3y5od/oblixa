/** @vitest-environment jsdom */
import "@/test-utils/mock-navigation";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { mockRouter, resetMockRouter } from "@/test-utils/mock-router";
import { EvidenceSubmissionReviewActions } from "./evidence-submission-review-actions";

describe("EvidenceSubmissionReviewActions", () => {
  afterEach(() => {
    resetMockRouter();
    vi.restoreAllMocks();
  });

  it("approves evidence inline and refreshes the route", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    renderWithProviders(<EvidenceSubmissionReviewActions submissionId="submission-1" />);

    await user.click(screen.getByRole("button", { name: /approve evidence/i }));

    expect(fetchMock).toHaveBeenCalledWith("/api/evidence/submission-1/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: undefined,
    });
    expect(mockRouter.refresh).toHaveBeenCalled();
    expect(screen.getByText(/evidence approved/i)).toBeTruthy();
  });

  it("shows unified rate-limit copy on HTTP 429", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 429,
        json: async () => ({ error: "Too many requests" }),
      }))
    );

    renderWithProviders(<EvidenceSubmissionReviewActions submissionId="submission-rl" />);

    await user.click(screen.getByRole("button", { name: /approve evidence/i }));

    expect(
      (await screen.findByRole("status")).textContent
    ).toMatch(/temporarily rate limited/i);
  });
});
