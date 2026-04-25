/** @vitest-environment jsdom */
import "@/test-utils/mock-navigation";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { resetMockRouter } from "@/test-utils/mock-router";
import { bulkAssignContractOwners } from "@/actions/contracts";
import type { Contract } from "@/lib/types";
import { ContractTable } from "./contract-table";

vi.mock("@/actions/contracts", () => ({
  bulkAssignContractOwners: vi.fn(),
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
      expect(screen.getByText(/1 selected/i).textContent).toMatch(/1 outside this page/i);
    });
    expect(screen.getByText(/bulk actions keep the same selected contract ids across pages and filters\./i)).toBeTruthy();
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
            outstandingEvidenceCount: 1,
            missingCriticalDates: true,
          },
        }}
      />
    );

    expect(screen.getByText(/2 pending/i)).toBeTruthy();
    expect(screen.getByText(/3\/5 fields/i)).toBeTruthy();
    expect(screen.getByText(/renewal due today/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /2 ex/i }).getAttribute("href")).toContain("/contracts/exceptions");
    expect(screen.getByText(/1 ev/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /dates gap/i }).getAttribute("href")).toBe("/contracts/contract-1#dates");
  });

  it("keeps the contracts empty state actionable with a direct upload CTA", () => {
    renderWithProviders(<ContractTable contracts={[]} />);

    expect(screen.getByText(/no contracts yet/i)).toBeTruthy();
    expect(screen.getByText(/upload an agreement to extract dates and build your operational record/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /upload contract/i }).getAttribute("href")).toBe("/contracts/new");
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
