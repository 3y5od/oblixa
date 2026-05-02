/** @vitest-environment jsdom */
import "@/test-utils/mock-navigation";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { mockRouter, resetMockRouter } from "@/test-utils/mock-router";
import { ImportJobRetryButton } from "./import-job-retry-button";

describe("ImportJobRetryButton", () => {
  afterEach(() => {
    resetMockRouter();
    vi.unstubAllGlobals();
  });

  it("starts a retry and refreshes on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ "x-v10-idempotent-replay": "false" }),
        json: async () => ({
          outcome: "success",
          user_visible_message: "Retry started.",
          changed_object_type: "import_job",
          changed_object_id: "retry-1",
          new_version: "1",
          version_metadata: {
            expected_version: null,
            current_version: null,
            new_version: "1",
          },
          next_destination_href: "/api/import/contracts/retry-1",
          audit_event_id: "audit-1",
          diagnostic_id: null,
          retry_eligible: false,
          replay_state: "not_replayed",
        }),
      }))
    );

    renderWithProviders(<ImportJobRetryButton jobId="job-1" />);

    fireEvent.click(screen.getByRole("button", { name: /retry failed rows/i }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toMatch(/retry started/i);
    });
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    expect(init.headers).toBeInstanceOf(Headers);
    expect((init.headers as Headers).get("x-idempotency-key")).toMatch(/^v10:/);
    expect((init.headers as Headers).get("x-client-request-id")).toMatch(/^v10-client:/);
    expect(mockRouter.refresh).toHaveBeenCalled();
  });

  it("maps HTTP failures to recoverable inline copy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 429,
        headers: new Headers(),
        json: async () => ({ error: "Too many requests" }),
      }))
    );

    renderWithProviders(<ImportJobRetryButton jobId="job-2" />);

    fireEvent.click(screen.getByRole("button", { name: /retry failed rows/i }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toMatch(/wait|rate limit|try again later/i);
    });
    expect(mockRouter.refresh).not.toHaveBeenCalled();
  });
});
