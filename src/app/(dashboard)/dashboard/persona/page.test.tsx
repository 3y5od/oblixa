/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PersonaDashboardPage from "@/app/(dashboard)/dashboard/persona/page";

const getAuthContext = vi.hoisted(() => vi.fn());
const isFeatureEnabled = vi.hoisted(() => vi.fn());
const loadProductSurfaceContext = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() => vi.fn((path: string) => {
  throw new Error(`redirect:${path}`);
}));

vi.mock("@/lib/supabase/server", () => ({
  getAuthContext,
}));

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled,
}));

vi.mock("@/lib/product-surface/context", () => ({
  loadProductSurfaceContext,
}));

vi.mock("next/navigation", () => ({
  redirect,
}));

type TableName = "contracts" | "contract_tasks" | "contract_obligations" | "contract_approvals" | "contract_renewal_scenarios";

type TableData = Record<TableName, unknown[]>;

const emptyData = (): TableData => ({
  contracts: [],
  contract_tasks: [],
  contract_obligations: [],
  contract_approvals: [],
  contract_renewal_scenarios: [],
});

function createAdmin(data: TableData) {
  return {
    from(table: TableName) {
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        in: vi.fn(() => chain),
        then(resolve: (value: { data: unknown[]; error: null }) => void) {
          resolve({ data: data[table], error: null });
        },
      };
      return chain;
    },
  };
}

async function renderPage(options: { persona?: string; mode?: "core" | "advanced"; role?: string; data?: TableData } = {}) {
  getAuthContext.mockResolvedValue({
    admin: createAdmin(options.data ?? emptyData()),
    orgId: "org-1",
    user: { id: "user-1" },
    role: options.role ?? "editor",
  });
  loadProductSurfaceContext.mockResolvedValue({ mode: options.mode ?? "core" });
  const ui = await PersonaDashboardPage({ searchParams: Promise.resolve({ persona: options.persona }) });
  return render(ui);
}

describe("PersonaDashboardPage", () => {
  beforeEach(() => {
    isFeatureEnabled.mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders one compact all-clear state without zero metric cards or an empty queue panel", async () => {
    await renderPage({ persona: "legal", mode: "core" });

    expect(screen.getByText("No pending legal approvals are visible for your current workspace and role.")).toBeTruthy();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.queryByText("No queue items in this persona view.")).toBeNull();
    expect(screen.queryByText("Pending approvals")).toBeNull();
    expect(screen.queryByText("Annual contract value")).toBeNull();
  });

  it("renders work views before active queue rows with row-specific action copy and active preset state", async () => {
    await renderPage({
      persona: "ops",
      mode: "core",
      data: {
        ...emptyData(),
        contracts: [{ id: "contract-1", title: "Acme MSA", health_status: "healthy", annual_value: 0 }],
        contract_tasks: [
          {
            id: "task-1",
            title: "Resolve vendor blocker",
            status: "blocked",
            priority: "high",
            assignee_id: "user-1",
            due_date: "2025-01-01",
            contracts: { id: "contract-1", title: "Acme MSA", organization_id: "org-1" },
          },
        ],
      },
    });

    expect(screen.getByText("Blocked task")).toBeTruthy();
    expect(screen.getByText("Resolve blocker", { exact: false })).toBeTruthy();
    expect(screen.getByText("Acme MSA · Assigned to you · Due 2025-01-01")).toBeTruthy();
    const workViews = screen.getByRole("navigation", { name: "Work views" });
    const queueRow = screen.getByText("Resolve vendor blocker");
    expect(Boolean(workViews.compareDocumentPosition(queueRow) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(screen.getByRole("link", { name: "Ops Daily" }).getAttribute("aria-current")).toBe("page");
  });

  it.each([
    ["legal", "Legal reviewer", "Legal Approvals"],
    ["finance", "Finance", "Finance Renewals"],
    ["manager", "Founder / manager", "Manager Weekly"],
    ["ops", "Ops lead", "Ops Daily"],
  ])("keeps %s query, heading, select value, and active work view aligned", async (persona, heading, activePreset) => {
    await renderPage({ persona });

    expect(screen.getByRole("heading", { level: 1, name: heading })).toBeTruthy();
    const select = screen.getByLabelText("Persona") as HTMLSelectElement;
    expect(select.value).toBe(persona);
    expect(select.selectedOptions[0]?.textContent).toBe(heading);
    expect(screen.getByRole("link", { name: activePreset }).getAttribute("aria-current")).toBe("page");
    cleanup();
  });

  it("renders work-view navigation before the empty all-clear state", async () => {
    await renderPage({ persona: "finance", mode: "core" });

    const workViews = screen.getByRole("navigation", { name: "Work views" });
    const allClear = screen.getByRole("status");
    expect(Boolean(workViews.compareDocumentPosition(allClear) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  it.each([
    ["ops", "Review legal approvals"],
    ["legal", "Browse Ops Daily"],
    ["finance", "Browse Ops Daily"],
  ])("uses verb-led all-clear action copy for %s", async (persona, actionLabel) => {
    await renderPage({ persona, mode: "core" });

    expect(screen.getByRole("link", { name: actionLabel })).toBeTruthy();
    cleanup();
  });

  it("keeps Core free of Advanced intelligence metrics and renders nonzero Advanced metrics below the queue", async () => {
    const data = {
      ...emptyData(),
      contracts: [{ id: "contract-1", title: "Acme MSA", health_status: "at_risk", annual_value: 1200 }],
      contract_renewal_scenarios: [
        {
          id: "renewal-1",
          contract_id: "contract-1",
          workspace_status: "blocked",
          target_decision_date: "2025-01-01",
          blocker: "Pricing approval",
          contracts: { id: "contract-1", title: "Acme MSA", organization_id: "org-1" },
        },
      ],
    };

    await renderPage({ persona: "finance", mode: "core", data });
    expect(screen.queryByText("Annual contract value")).toBeNull();
    expect(screen.queryByText("At-risk contracts")).toBeNull();
    cleanup();

    await renderPage({ persona: "finance", mode: "advanced", data });
    const queueRow = screen.getByText("Acme MSA");
    const metric = screen.getByText("Annual contract value");
    expect(Boolean(queueRow.compareDocumentPosition(metric) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(screen.getByText("At-risk contracts")).toBeTruthy();
  });

  it("falls back to Ops when the persona query value is invalid", async () => {
    await renderPage({ persona: "not-a-persona" });
    expect(screen.getByRole("heading", { level: 1, name: "Ops lead" })).toBeTruthy();
  });

  it("preserves restricted Core role redirects", async () => {
    await expect(renderPage({ persona: "legal", mode: "core", role: "legal_reviewer" })).rejects.toThrow("redirect:/dashboard");
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });
});
