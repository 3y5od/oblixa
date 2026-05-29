/** @vitest-environment jsdom */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { UploadForm } from "./upload-form";

const pushMock = vi.fn();
const createContractMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/actions/contracts", () => ({
  createContract: (...args: unknown[]) => createContractMock(...args),
}));

describe("UploadForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("renders richer identity fields and first-value guidance", () => {
    renderWithProviders(<UploadForm organizationId="00000000-0000-0000-0000-000000000000" />);

    expect(screen.getByLabelText(/contract title/i)).toBeTruthy();
    expect(screen.getByLabelText(/region/i)).toBeTruthy();
    expect(screen.getByLabelText(/annual value/i)).toBeTruthy();
    expect(screen.getByLabelText(/source system/i)).toBeTruthy();
    expect(screen.getByLabelText(/external reference/i)).toBeTruthy();
    expect(screen.getByText(/record metadata/i)).toBeTruthy();
    expect(screen.getByText(/source documents/i)).toBeTruthy();
    expect(screen.getByText(/no source yet/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^create record$/i })).toBeTruthy();
  });

  it("summarizes accepted, unsupported, oversized, and duplicate files", async () => {
    renderWithProviders(<UploadForm organizationId="00000000-0000-0000-0000-000000000000" />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    if (!fileInput) throw new Error("expected hidden file input");

    const valid = new File(["dummy pdf content"], "agreement.pdf", {
      type: "application/pdf",
      lastModified: 1,
    });
    const duplicate = new File(["dummy pdf content"], "agreement.pdf", {
      type: "application/pdf",
      lastModified: 1,
    });
    const oversized = new File([new Uint8Array(21 * 1024 * 1024)], "large.pdf", {
      type: "application/pdf",
      lastModified: 2,
    });
    const unsupported = new File(["plain text"], "notes.txt", {
      type: "text/plain",
      lastModified: 3,
    });

    fireEvent.change(fileInput, { target: { files: [valid] } });
    fireEvent.change(fileInput, { target: { files: [duplicate, oversized, unsupported] } });

    expect(await screen.findByText(/1 duplicate file was ignored/i)).toBeTruthy();
    expect(screen.getByText(/1 unsupported file was skipped/i)).toBeTruthy();
    expect(screen.getByText(/1 file exceeds the 20 mb limit/i)).toBeTruthy();
    expect(screen.getByText("agreement.pdf")).toBeTruthy();
    expect(screen.getAllByText(/1 duplicate/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1 unsupported/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1 over size limit/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /^upload contract$/i })).toBeTruthy();
  });

  it("keeps typed metadata when creation returns an error", async () => {
    const user = userEvent.setup();
    createContractMock.mockResolvedValue({ error: "Not authenticated" });

    renderWithProviders(<UploadForm organizationId="00000000-0000-0000-0000-000000000000" />);

    const title = screen.getByLabelText(/contract title/i);
    await user.type(title, "Hold my title");
    await user.click(screen.getByRole("button", { name: /^create record$/i }));

    await waitFor(() => expect(createContractMock).toHaveBeenCalled());
    expect((screen.getByRole("alert").textContent ?? "").toLowerCase()).toMatch(/session/);
    expect(title).toHaveProperty("value", "Hold my title");
  });

  it("shows draft banner when sessionStorage contains prior metadata", async () => {
    sessionStorage.setItem(
      "oblixa.uploadDraft.v1:00000000-0000-0000-0000-000000000000",
      JSON.stringify({ title: "Resumed title", counterparty: "Acme" })
    );

    renderWithProviders(<UploadForm organizationId="00000000-0000-0000-0000-000000000000" />);

    expect(await screen.findByText(/saved in this browser/i)).toBeTruthy();
    expect(screen.getByLabelText(/contract title/i)).toHaveProperty("value", "Resumed title");
    expect(screen.getByLabelText(/counterparty/i)).toHaveProperty("value", "Acme");
  });

  it("navigates to the returned contract detail path after successful creation", async () => {
    const user = userEvent.setup();
    createContractMock.mockResolvedValue({
      ok: true,
      contractId: "contract-123",
      redirectTo: "/contracts/contract-123?created=1&uploaded=1&invalid=0&failed=0&extraction=queued",
      uploadSummary: {
        attemptedFiles: 1,
        uploadedFiles: 1,
        skippedInvalidFiles: 0,
        failedUploadFiles: 0,
      },
      extractionStatus: "queued",
    });

    const { container } = renderWithProviders(
      <UploadForm organizationId="00000000-0000-0000-0000-000000000000" />
    );

    await user.type(screen.getByLabelText(/contract title/i), "Acme Corp MSA 2025");

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    if (!fileInput) throw new Error("expected hidden file input");
    const file = new File(["dummy pdf content"], "agreement.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await user.click(screen.getByRole("button", { name: /upload contract/i }));

    await waitFor(() => expect(createContractMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(
        "/contracts/contract-123?created=1&uploaded=1&invalid=0&failed=0&extraction=queued"
      )
    );
  });
});
