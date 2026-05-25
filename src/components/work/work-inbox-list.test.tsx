/** @vitest-environment jsdom */
import "@/test-utils/mock-navigation";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { mockRouter, resetMockRouter } from "@/test-utils/mock-router";
import { V10WorkInboxList, type V10WorkInboxListItem } from "./work-inbox-list";

const mocks = vi.hoisted(() => ({
  bulkAssignCompatibleV10WorkItems: vi.fn(),
  bulkCompleteCompatibleV10WorkItems: vi.fn(),
  runExtraction: vi.fn(),
}));

vi.mock("@/actions/bulk-compatible-work", () => ({
  bulkAssignCompatibleV10WorkItems: mocks.bulkAssignCompatibleV10WorkItems,
  bulkCompleteCompatibleV10WorkItems: mocks.bulkCompleteCompatibleV10WorkItems,
}));

vi.mock("@/actions/contracts", () => ({
  runExtraction: mocks.runExtraction,
}));

vi.mock("@/components/work/work-queue-inline-actions-gate", () => ({
  WorkQueueInlineActionsGate: () => null,
}));

vi.mock("@/components/contracts/exception-mutation-panels", () => ({
  ExceptionMutationPanels: ({ exceptionId }: { exceptionId: string }) => <span data-testid="exception-panels">Exception {exceptionId}</span>,
}));

vi.mock("@/components/contracts/import-job-retry-button", () => ({
  V10JobRetryButton: ({ url, label, testId }: { url: string; label: string; testId?: string }) => (
    <span data-testid={testId ?? "job-retry"}>
      {label} via {url}
    </span>
  ),
}));

const baseItem = (overrides: Partial<V10WorkInboxListItem>): V10WorkInboxListItem => ({
  key: "work:item",
  v10WorkItemId: "v10-1",
  sourceId: "task-1",
  sourceTable: "contract_tasks",
  type: "contract_task",
  title: "Review MSA",
  status: "open",
  statusLabel: "open",
  statusTone: "info",
  ownerLabel: "You",
  ownerState: "assigned",
  href: "/contracts/1",
  nextActionLabel: "Review contract",
  nextActionHref: "/contracts/1",
  priorityLabel: "high",
  secondaryActionsLabel: "assign owner",
  compatibleActionGroup: "triage_open",
  ...overrides,
});

describe("V10WorkInboxList", () => {
  afterEach(() => {
    vi.clearAllMocks();
    resetMockRouter();
    cleanup();
  });

  it("runs bulk assignment for selected task-backed rows", async () => {
    mocks.bulkAssignCompatibleV10WorkItems.mockResolvedValue({
      ok: true,
      outcomes: [{ v10WorkItemId: "v10-1", outcome: "success", reason: "assigned" }],
      v10: { outcome: "success" },
    });

    renderWithProviders(
      <V10WorkInboxList
        items={[
          baseItem({ sourceId: "task-1" }),
          baseItem({
            key: "approval",
            v10WorkItemId: "v10-approval-1",
            sourceId: "approval-1",
            sourceTable: "contract_approvals",
            type: "approval",
            title: "Renewal approval",
            status: "pending",
            statusLabel: "pending",
            compatibleActionGroup: null,
          }),
        ]}
        ownerOptions={[{ id: "owner-2", label: "Legal Ops" }]}
        mutationsEnabled
      />
    );

    fireEvent.click(screen.getByLabelText(/select review msa for bulk actions/i));
    fireEvent.change(screen.getByLabelText(/assign selected work to owner/i), { target: { value: "owner-2" } });
    fireEvent.click(screen.getByRole("button", { name: /assign selected work/i }));

    await waitFor(() =>
      expect(mocks.bulkAssignCompatibleV10WorkItems).toHaveBeenCalledWith(
        expect.objectContaining({
          v10WorkItemIds: ["v10-1"],
          ownerUserId: "owner-2",
          expectedCompatibleActionGroup: "triage_open",
        })
      )
    );
    expect(screen.queryByLabelText(/select renewal approval for bulk actions/i)).toBeNull();
    expect(await screen.findByText(/assigned 1 selected item/i)).toBeTruthy();
    expect(mockRouter.refresh).toHaveBeenCalled();
  });

  it("locks selection to one bulk-compatible group at a time", () => {
    renderWithProviders(
      <V10WorkInboxList
        items={[
          baseItem({ sourceId: "task-1", compatibleActionGroup: "triage_open" }),
          baseItem({ key: "task-2", v10WorkItemId: "v10-2", sourceId: "task-2", title: "Resolve blocker", compatibleActionGroup: "blocked_followup" }),
        ]}
        ownerOptions={[]}
        mutationsEnabled
      />
    );

    fireEvent.click(screen.getByLabelText(/select review msa for bulk actions/i));

    expect((screen.getByLabelText(/select resolve blocker for bulk actions/i) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText(/1 contract task selected in triage open/i)).toBeTruthy();
  });

  it("runs bulk completion and summarizes partial outcomes", async () => {
    mocks.bulkCompleteCompatibleV10WorkItems.mockResolvedValue({
      ok: true,
      outcomes: [
        { v10WorkItemId: "v10-1", outcome: "success", reason: "completed" },
        { v10WorkItemId: "v10-2", outcome: "validation_failed", reason: "incompatible_action_group" },
      ],
      v10: { outcome: "dependency_blocked" },
    });

    renderWithProviders(
      <V10WorkInboxList
        items={[
          baseItem({ sourceId: "task-1", title: "Review MSA" }),
          baseItem({ key: "task-2", v10WorkItemId: "v10-2", sourceId: "task-2", title: "Validate owner" }),
        ]}
        ownerOptions={[]}
        mutationsEnabled
      />
    );

    fireEvent.click(screen.getByLabelText(/select review msa for bulk actions/i));
    fireEvent.click(screen.getByLabelText(/select validate owner for bulk actions/i));
    fireEvent.click(screen.getByRole("button", { name: /complete selected work/i }));

    await waitFor(() =>
      expect(mocks.bulkCompleteCompatibleV10WorkItems).toHaveBeenCalledWith(
        expect.objectContaining({
          v10WorkItemIds: ["v10-1", "v10-2"],
          expectedCompatibleActionGroup: "triage_open",
        })
      )
    );
    expect(await screen.findByText(/completed 1 selected item/i)).toBeTruthy();
    expect(screen.getByText(/1 need another bulk group or a refreshed queue/i)).toBeTruthy();
  });

  it("shows exception mutation controls on exception cards", () => {
    renderWithProviders(
      <V10WorkInboxList
        items={[
          baseItem({
            v10WorkItemId: "v10-exception-1",
            sourceId: "exception-1",
            sourceTable: "exceptions",
            type: "exception",
            title: "Critical exception",
            status: "open",
            statusLabel: "open",
            compatibleActionGroup: null,
          }),
        ]}
        ownerOptions={[{ id: "owner-2", label: "Legal Ops" }]}
        mutationsEnabled
      />
    );

    expect(screen.getByTestId("exception-panels").textContent).toContain("exception-1");
  });

  it("shows import-failure recovery controls", () => {
    renderWithProviders(
      <V10WorkInboxList
        items={[
          baseItem({
            v10WorkItemId: "v10-import-1",
            sourceId: "job-1",
            sourceTable: "contract_import_jobs",
            type: "import_failure",
            title: "Import failed",
            status: "blocked",
            statusLabel: "blocked",
            primaryAction: "retry_failed_job",
            compatibleActionGroup: null,
          }),
        ]}
        ownerOptions={[]}
        mutationsEnabled
      />
    );

    expect(screen.getByTestId("import-retry").textContent).toContain("/api/import/contracts/job-1");
    expect(screen.getByRole("link", { name: /inspect diagnostics/i }).getAttribute("href")).toBe("/settings/health#jobs");
  });

  it("shows export-failure retry controls when recovery is available", () => {
    renderWithProviders(
      <V10WorkInboxList
        items={[
          baseItem({
            v10WorkItemId: "v10-export-1",
            sourceId: "export-job-1",
            sourceTable: "contract_export_jobs",
            type: "export_failure",
            title: "Export needs recovery",
            status: "blocked",
            statusLabel: "blocked",
            primaryAction: "retry_failed_job",
            compatibleActionGroup: null,
          }),
        ]}
        ownerOptions={[]}
        mutationsEnabled
      />
    );

    expect(screen.getByTestId("export-retry").textContent).toContain("/api/export/contracts/export-job-1");
    expect(screen.getByRole("link", { name: /inspect export diagnostics/i }).getAttribute("href")).toBe("/settings/health#exports");
  });

  it("shows report-failure retry controls when recovery is available", () => {
    renderWithProviders(
      <V10WorkInboxList
        items={[
          baseItem({
            v10WorkItemId: "v10-report-1",
            sourceId: "report-run-1",
            sourceTable: "report_runs",
            type: "report_failure",
            title: "Report needs recovery",
            status: "blocked",
            statusLabel: "blocked",
            primaryAction: "retry_failed_job",
            compatibleActionGroup: null,
          }),
        ]}
        ownerOptions={[]}
        mutationsEnabled
      />
    );

    expect(screen.getByTestId("report-retry").textContent).toContain("/api/report-runs/report-run-1/retry");
    expect(screen.getByRole("link", { name: /review reports/i }).getAttribute("href")).toBe("/reports");
  });

  it("hides import retry controls for terminal import failures", () => {
    renderWithProviders(
      <V10WorkInboxList
        items={[
          baseItem({
            v10WorkItemId: "v10-import-2",
            sourceId: "job-2",
            sourceTable: "contract_import_jobs",
            type: "import_failure",
            title: "Import needs diagnostics",
            status: "blocked",
            statusLabel: "blocked",
            primaryAction: "open_source_object",
            compatibleActionGroup: null,
          }),
        ]}
        ownerOptions={[]}
        mutationsEnabled
      />
    );

    expect(screen.queryByTestId("import-retry")).toBeNull();
    expect(screen.getByRole("link", { name: /inspect diagnostics/i }).getAttribute("href")).toBe("/settings/health#jobs");
  });

  it("runs extraction retry from extraction-failure cards", async () => {
    mocks.runExtraction.mockResolvedValue({ success: true, async: true, extracted: 0, inserted: 0 });

    renderWithProviders(
      <V10WorkInboxList
        items={[
          baseItem({
            v10WorkItemId: "v10-extract-1",
            sourceId: "extract-job-1",
            sourceTable: "contract_import_jobs",
            type: "extraction_failure",
            title: "Extraction needs recovery",
            status: "blocked",
            statusLabel: "blocked",
            contractId: "contract-1",
            compatibleActionGroup: null,
          }),
        ]}
        ownerOptions={[]}
        mutationsEnabled
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /retry extraction/i }));

    await waitFor(() => expect(mocks.runExtraction).toHaveBeenCalledWith("contract-1"));
    expect(await screen.findByText(/extraction retry started/i)).toBeTruthy();
    expect(mockRouter.refresh).toHaveBeenCalled();
  });
});