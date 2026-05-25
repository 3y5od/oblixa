/** @vitest-environment jsdom */
import "@/test-utils/mock-navigation";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { resetMockRouter } from "@/test-utils/mock-router";
import { bulkAssignContractOwners } from "@/actions/contracts";
import { emitEmptyStateCtaClickedTelemetry } from "@/actions/product-telemetry";
import type { Contract } from "@/lib/types";
import { ContractTable } from "./contract-table";

vi.mock("@/actions/contracts", () => ({
  bulkAssignContractOwners: vi.fn(),
}));

vi.mock("@/actions/product-telemetry", () => ({
  emitEmptyStateCtaClickedTelemetry: vi.fn(),
}));

const baseContracts: Contract[] = [
  {
    id: "contract-1",
    organization_id: "org-1",
    title: "Acme MSA",
    counterparty: "Acme",
    contract_type: "MSA",
    status: "active",
    owner_id: "owner-1",
    created_by: "user-1",
    owner: {
      id: "owner-1",
      full_name: "Casey Ops",
      email: "casey@example.com",
      avatar_url: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    updated_at: "2026-04-19T10:00:00.000Z",
    created_at: "2026-03-01T10:00:00.000Z",
  },
  {
    id: "contract-2",
    organization_id: "org-1",
    title: "Globex DPA",
    counterparty: "Globex",
    contract_type: "DPA",
    status: "pending_review",
    owner_id: "owner-2",
    created_by: "user-1",
    owner: {
      id: "owner-2",
      full_name: null,
      email: "owner@example.com",
      avatar_url: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    updated_at: "2026-04-18T10:00:00.000Z",
    created_at: "2026-02-01T10:00:00.000Z",
  },
] as const;

describe("ContractTable", () => {
  afterEach(() => {
    window.sessionStorage.clear();
    resetMockRouter();
    vi.clearAllMocks();
  });

  it("persists bulk selection across pages and filters (§9.6)", async () => {
    const bulkActions = {
      canEdit: true,
      members: [{ id: "member-1", label: "Casey Ops" }],
      orgId: "org-1",
    };

    const firstRender = renderWithProviders(
      <ContractTable
        contracts={[baseContracts[0], baseContracts[1]]}
        bulkActions={bulkActions}
        filterFingerprint="owner:me"
      />
    );

    fireEvent.click(screen.getByRole("checkbox", { name: /select acme msa/i }));
    expect(await screen.findByText(/1 selected/i)).toBeTruthy();

    firstRender.unmount();

    renderWithProviders(
      <ContractTable
        contracts={[baseContracts[1]]}
        bulkActions={bulkActions}
        filterFingerprint="status:pending_review"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/1 selected/i)).toBeTruthy();
      expect(screen.getByText(/1 outside this page/i)).toBeTruthy();
    });
    expect(screen.getByText(/persists across filters/i)).toBeTruthy();
  });

  it("renders review backlog, horizon urgency, and row signals in the visible table (§9.2)", () => {
    renderWithProviders(
      <ContractTable
        contracts={[baseContracts[0]]}
        reviewStats={{
          "contract-1": { total: 5, approved: 3, pending: 2 },
        }}
        rowSignals={{
          "contract-1": {
            nextHorizonField: "renewal_date",
            nextHorizonDate: "2026-04-19",
            nextHorizonDays: 0,
            openExceptionCount: 2,
            openWorkCount: 0,
            outstandingEvidenceCount: 1,
            missingCriticalDates: true,
          },
        }}
      />
    );

    expect(screen.getAllByText(/2 pending/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/3\/5 fields/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /continue field review/i }).getAttribute("href")).toBe(
      "/contracts/contract-1#extracted-fields"
    );
    expect(screen.getByText(/renewal due today/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /2 exceptions/i }).getAttribute("href")).toContain("/contracts/exceptions");
    expect(screen.getByText(/1 evidence request/i)).toBeTruthy();
  });

  it("renders the dates gap row action when no next important date is available", () => {
    renderWithProviders(
      <ContractTable
        contracts={[baseContracts[0]]}
        rowSignals={{
          "contract-1": {
            nextHorizonField: null,
            nextHorizonDate: null,
            nextHorizonDays: null,
            openExceptionCount: 0,
            openWorkCount: 0,
            outstandingEvidenceCount: 0,
            missingCriticalDates: true,
          },
        }}
      />
    );

    expect(screen.getByRole("link", { name: /dates gap/i }).getAttribute("href")).toBe("/contracts/contract-1#dates");
  });

  it("keeps the contracts empty state actionable with a direct upload CTA", () => {
    renderWithProviders(<ContractTable contracts={[]} />);

    expect(screen.getByText(/no contracts yet/i)).toBeTruthy();
    expect(screen.getByText(/upload an agreement to extract dates and build your operational record/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /upload contract/i }).getAttribute("href")).toBe("/contracts/new");
    const state = screen.getByRole("status", { name: /contracts empty state/i });
    expect(state.getAttribute("data-v10-state")).toBe("empty");
    expect(state.getAttribute("data-v10-source-object")).toBe("contract");
    expect(state.getAttribute("data-v10-next-action-label")).toBe("Upload contract");
    fireEvent.click(screen.getByRole("link", { name: /upload contract/i }));
    expect(emitEmptyStateCtaClickedTelemetry).toHaveBeenCalledWith({
      surface: "contracts",
      section: "contract_table",
      sourceObject: "contract",
      actionLabel: "Upload contract",
      href: "/contracts/new",
    });
  });

  it("distinguishes filtered-empty lists from an empty contract portfolio", () => {
    renderWithProviders(
      <ContractTable
        contracts={[]}
        emptyState={{
          title: "No contracts match these filters",
          copy: "Clear the filters or search terms to return to the full contract list.",
          actionHref: "/contracts",
          actionLabel: "Clear filters",
        }}
      />
    );

    expect(screen.getByText(/no contracts match these filters/i)).toBeTruthy();
    expect(screen.getByText(/clear the filters or search terms/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /clear filters/i }).getAttribute("href")).toBe("/contracts");
    const state = screen.getByRole("status", { name: /filtered contracts empty state/i });
    expect(state.getAttribute("data-v10-state")).toBe("empty");
    expect(state.getAttribute("data-v10-section")).toBe("contract_table");
  });

  it("keeps bulk owner assignment pending-safe and maps recoverable failures", async () => {
    let release: (() => void) | null = null;
    vi.mocked(bulkAssignContractOwners).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ error: "Not authenticated" });
        })
    );

    renderWithProviders(
      <ContractTable
        contracts={[baseContracts[0]]}
        bulkActions={{
          canEdit: true,
          members: [{ id: "member-1", label: "Casey Ops" }],
          orgId: "org-1",
        }}
      />
    );

    fireEvent.click(screen.getByRole("checkbox", { name: /select acme msa/i }));
    fireEvent.change(screen.getByLabelText(/assign owner/i), { target: { value: "member-1" } });
    fireEvent.click(screen.getByRole("button", { name: /^apply$/i }));

    const assigningBtn = screen.getByRole("button", { name: /assigning/i });
    expect(assigningBtn.hasAttribute("disabled")).toBe(true);

    const finish = release as (() => void) | null;
    if (typeof finish !== "function") {
      throw new Error("expected bulkAssignContractOwners to register a release handler");
    }
    finish();

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toMatch(/session expired/i);
    });
  });
});
