/** @vitest-environment jsdom */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { mockRouter, resetMockRouter } from "@/test-utils/mock-router";
import { BulkUploadForm } from "./bulk-upload-form";

const { bulkCreateContractsFromFiles } = vi.hoisted(() => ({
  bulkCreateContractsFromFiles: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

vi.mock("@/actions/contracts", () => ({
  bulkCreateContractsFromFiles,
}));

describe("BulkUploadForm", () => {
  afterEach(() => {
    resetMockRouter();
    bulkCreateContractsFromFiles.mockReset();
  });

  it("maps recoverable failures into user-safe copy", async () => {
    bulkCreateContractsFromFiles.mockResolvedValueOnce({ error: "Not authenticated" });

    const { container } = renderWithProviders(
      <BulkUploadForm organizationId="00000000-0000-0000-0000-000000000000" />
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    if (!input) throw new Error("expected file input");
    fireEvent.change(input, {
      target: {
        files: [new File(["pdf"], "agreement.pdf", { type: "application/pdf" })],
      },
    });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(bulkCreateContractsFromFiles).toHaveBeenCalled());
    expect((await screen.findByText(/session expired/i)).textContent).toMatch(/sign in again/i);
    expect(mockRouter.refresh).not.toHaveBeenCalled();
  });

  it("keeps partial-import guidance inline and refreshes on success", async () => {
    bulkCreateContractsFromFiles.mockResolvedValueOnce({
      success: true,
      created: 2,
      job_id: "job-1",
      errors: ["Failed to fetch"],
    });

    const { container } = renderWithProviders(
      <BulkUploadForm organizationId="00000000-0000-0000-0000-000000000000" />
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    if (!input) throw new Error("expected file input");
    fireEvent.change(input, {
      target: {
        files: [new File(["pdf"], "agreement.pdf", { type: "application/pdf" })],
      },
    });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText(/created 2 contract/i)).toBeTruthy();
    });
    expect(screen.getByText(/could not reach the server/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /review import status/i }).getAttribute("href")).toBe(
      "#recent-imports"
    );
    expect(mockRouter.refresh).toHaveBeenCalled();
  });
});
