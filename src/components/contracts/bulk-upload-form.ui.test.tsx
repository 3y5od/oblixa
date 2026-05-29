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
    vi.unstubAllGlobals();
  });

  it("imports CSV rows through the Core import API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, jobId: "job-csv-1", created: 2 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = renderWithProviders(
      <BulkUploadForm organizationId="00000000-0000-0000-0000-000000000000" />
    );

    // v23 aesthetic pass: the form h2 ("Replace the tracking
    // spreadsheet") + verbose lead were dropped per §10.7 + §10.4.
    // The form is now anchored by the eyebrow + tab buttons +
    // surviving section eyebrows ("Minimum spreadsheet shape") +
    // column-group values.
    // "Import source" is now the aria-label on the underline-tab strip
    // (the visible eyebrow was dropped — defect 3, segmented control
    // chrome competed with the eyebrow).
    expect(screen.getByRole("tablist", { name: /import source/i })).toBeTruthy();
    expect(screen.getByText(/minimum spreadsheet shape/i)).toBeTruthy();
    // The column list renders both the human label ("Contract title,
    // Counterparty") and the technical mono name ("title, counterparty")
    // so the row shows what to author in the CSV header.
    expect(screen.getAllByText(/title, counterparty/i).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText(/csv file/i), {
      target: {
        files: [
          new File(["title,counterparty\nAcme MSA,Acme Corp"], "contracts.csv", {
            type: "text/csv",
          }),
        ],
      },
    });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/import/contracts",
      expect.objectContaining({
        method: "POST",
        body: "title,counterparty\nAcme MSA,Acme Corp",
      })
    );
    expect(await screen.findByText(/csv import created 2 contracts for review/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /review import status/i }).getAttribute("href")).toBe(
      "#recent-imports"
    );
    expect(screen.getByRole("link", { name: /open job details/i }).getAttribute("href")).toBe(
      "/api/import/contracts/job-csv-1"
    );
    expect(mockRouter.refresh).toHaveBeenCalled();
  });

  it("maps recoverable failures into user-safe copy", async () => {
    bulkCreateContractsFromFiles.mockResolvedValueOnce({ error: "Not authenticated" });

    const { container } = renderWithProviders(
      <BulkUploadForm organizationId="00000000-0000-0000-0000-000000000000" />
    );

    fireEvent.click(screen.getByRole("tab", { name: /signed files/i }));
    // v23 aesthetic pass: the signed-files h3 ("Create one contract per
    // signed source file") + sub-paragraph were dropped per §10.7. The
    // section is now anchored by the field label + format chips.
    expect(screen.getByLabelText(/signed pdf or docx files/i)).toBeTruthy();
    const input = screen.getByLabelText(/signed pdf or docx files/i) as HTMLInputElement | null;
    if (!input) throw new Error("expected signed file input");
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

    fireEvent.click(screen.getByRole("tab", { name: /signed files/i }));
    const input = screen.getByLabelText(/signed pdf or docx files/i) as HTMLInputElement | null;
    if (!input) throw new Error("expected signed file input");
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
    expect(screen.getByRole("link", { name: /open job details/i }).getAttribute("href")).toBe(
      "/api/import/contracts/job-1"
    );
    expect(mockRouter.refresh).toHaveBeenCalled();
  });
});
