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

    // The tablist keeps its "Import source" aria-label; the two tabs are
    // named by source ("Tracker CSV" / "Signed contract files"). The
    // requirements section is now the ImportSchemaTable titled "Tracker CSV
    // requirements" and renders each importable column as a table row with its
    // human label + snake_case authoring header. The human label for the title
    // column is now "Contract name" (the CSV header token stays `title`).
    expect(screen.getByRole("tablist", { name: /import source/i })).toBeTruthy();
    // "Tracker CSV requirements" renders twice — the visible header band <p>
    // and the ImportSchemaTable's sr-only <caption> — so match all instances.
    expect(screen.getAllByText(/tracker csv requirements/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Contract name")).toBeTruthy();
    expect(screen.getByText("external_reference_id")).toBeTruthy();

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
      "/contracts/imports/job-csv-1"
    );
    expect(mockRouter.refresh).toHaveBeenCalled();
  });

  it("maps recoverable failures into user-safe copy", async () => {
    bulkCreateContractsFromFiles.mockResolvedValueOnce({ error: "Not authenticated" });

    const { container } = renderWithProviders(
      <BulkUploadForm organizationId="00000000-0000-0000-0000-000000000000" />
    );

    fireEvent.click(screen.getByRole("tab", { name: /signed contract files/i }));
    // The signed-contract-files tab is anchored by the field label +
    // dropzone + format hint; the file input keeps its "Signed PDF or DOCX
    // files" accessible name.
    expect(screen.getByLabelText(/signed pdf or docx files/i)).toBeTruthy();
    expect(screen.getByText(/uploaded files are stored for this workspace/i)).toBeTruthy();
    expect(screen.getByText(/not used in reminders or reports until someone reviews them/i)).toBeTruthy();
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

    fireEvent.click(screen.getByRole("tab", { name: /signed contract files/i }));
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
      "/contracts/imports/job-1"
    );
    expect(mockRouter.refresh).toHaveBeenCalled();
  });
});
