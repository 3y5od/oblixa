/** @vitest-environment jsdom */
import "@/test-utils/mock-navigation";
import { screen, waitFor } from "@testing-library/react";
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
      status: 200,
      headers: new Headers({ "x-v10-idempotent-replay": "false" }),
      json: async () => ({
        outcome: "success",
        user_visible_message: "Evidence approved.",
        changed_object_type: "evidence_request",
        changed_object_id: "requirement-1",
        new_version: "2026-04-26T20:04:00.000Z",
        version_metadata: {
          expected_version: null,
          current_version: null,
          new_version: "2026-04-26T20:04:00.000Z",
        },
        next_destination_href: "/contracts/contract-1",
        audit_event_id: "audit-1",
        diagnostic_id: null,
        retry_eligible: false,
        replay_state: "not_replayed",
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    renderWithProviders(<EvidenceSubmissionReviewActions submissionId="submission-1" />);

    await user.click(screen.getByRole("button", { name: /approve evidence/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/evidence/submission-1/approve");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    expect(init.body).toBeUndefined();
    expect(init.headers).toBeInstanceOf(Headers);
    expect((init.headers as Headers).get("x-idempotency-key")).toMatch(/^v10:/);
    expect((init.headers as Headers).get("x-client-request-id")).toMatch(/^v10-client:/);
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
        headers: new Headers(),
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
