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
        json: async () => ({ jobId: "retry-1" }),
      }))
    );

    renderWithProviders(<ImportJobRetryButton jobId="job-1" />);

    fireEvent.click(screen.getByRole("button", { name: /retry failed rows/i }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toMatch(/retry started/i);
    });
    expect(mockRouter.refresh).toHaveBeenCalled();
  });

  it("maps HTTP failures to recoverable inline copy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 429,
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
