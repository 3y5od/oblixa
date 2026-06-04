/** @vitest-environment jsdom */
import "@/test-utils/mock-navigation";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { mockRouter, resetMockRouter } from "@/test-utils/mock-router";
import { WORK_ACTION_LABELS, WORK_ROW_LABELS } from "@/lib/work/spec-strings";
import type { WorkItemRow } from "@/lib/work/types";
import { WorkReleaseActions } from "./work-release-actions";

const mocks = vi.hoisted(() => ({
  completeWorkItem: vi.fn(),
  updateContractTaskStatus: vi.fn(),
  updateContractObligation: vi.fn(),
}));

vi.mock("@/actions/tasks", () => ({
  completeWorkItem: mocks.completeWorkItem,
  updateContractTaskStatus: mocks.updateContractTaskStatus,
}));

vi.mock("@/actions/obligations", () => ({
  updateContractObligation: mocks.updateContractObligation,
}));

function baseRow(overrides: Partial<WorkItemRow> = {}): WorkItemRow {
  return {
    id: "work-1",
    key: "contract_tasks:task-1:contract_task",
    sourceId: "task-1",
    sourceTable: "contract_tasks",
    type: "contract_task",
    typeLabel: "Task",
    title: "Confirm renewal owner",
    status: "open",
    statusLabel: "Open",
    statusTone: "in_review",
    contractId: "contract-1",
    contractTitle: "Acme Corp MSA 2025",
    contractHref: "/contracts/contract-1",
    ownerUserId: "user-1",
    ownerLabel: "You",
    dueAt: "2026-05-20",
    dueLabel: "May 20, 2026",
    dueState: "due_soon",
    dueInDays: 3,
    blocker: "—",
    lastUpdateAt: "2026-05-17T10:00:00.000Z",
    lastUpdateLabel: "2 days ago",
    href: "/contracts/contract-1?tab=overview#work",
    display: {
      identity: {
        title: { label: WORK_ROW_LABELS.title, value: "Confirm renewal owner", href: "/contracts/contract-1?tab=overview#work" },
        linkedContract: { label: WORK_ROW_LABELS.linkedContract, value: "Acme Corp MSA 2025", href: "/contracts/contract-1" },
      },
      ownership: {
        owner: { label: WORK_ROW_LABELS.owner, value: "You" },
        dueDate: { label: WORK_ROW_LABELS.dueDate, value: "May 20, 2026" },
        lastUpdate: { label: WORK_ROW_LABELS.lastUpdate, value: "2 days ago" },
      },
      state: {
        status: { label: WORK_ROW_LABELS.status, value: "Open" },
        type: { label: WORK_ROW_LABELS.type, value: "Task" },
        blocker: { label: WORK_ROW_LABELS.blocker, value: "—" },
      },
    },
    primaryAction: {
      verb: "complete",
      label: "Complete",
      kind: "mutation",
      href: "/contracts/contract-1?tab=overview#work",
      mutation: "complete_task",
    },
    actions: [
      {
        key: "complete",
        label: WORK_ACTION_LABELS.complete,
        kind: "mutation",
        mutation: "complete_task",
      },
      { key: "reassign", label: WORK_ACTION_LABELS.reassign, kind: "link", href: "/contracts/contract-1" },
      { key: "change_due_date", label: WORK_ACTION_LABELS.change_due_date, kind: "link", href: "/contracts/contract-1" },
      { key: "comment", label: WORK_ACTION_LABELS.comment, kind: "link", href: "/contracts/contract-1?tab=notes" },
      { key: "link_evidence", label: WORK_ACTION_LABELS.link_evidence, kind: "link", href: "/contracts/contract-1?tab=overview#contract-evidence" },
    ],
    ...overrides,
  };
}

describe("WorkReleaseActions", () => {
  afterEach(() => {
    resetMockRouter();
    mocks.completeWorkItem.mockReset();
    mocks.updateContractTaskStatus.mockReset();
    mocks.updateContractObligation.mockReset();
  });

  it("keeps one compact action cluster while exposing the full release-state vocabulary", () => {
    renderWithProviders(<WorkReleaseActions row={baseRow()} mutationsEnabled />);

    // The single primary control carries the status-aware verb...
    expect(screen.getByRole("button", { name: WORK_ACTION_LABELS.complete })).toBeTruthy();
    // ...and the compact overflow trigger holds the rest of the vocabulary.
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    for (const key of ["reassign", "change_due_date", "comment", "link_evidence"] as const) {
      expect(screen.getAllByText(WORK_ACTION_LABELS[key]).length).toBeGreaterThan(0);
    }
  });

  it("fires the direct Complete mutation and exposes an undo before committing", async () => {
    mocks.completeWorkItem.mockResolvedValueOnce({ success: true });

    renderWithProviders(<WorkReleaseActions row={baseRow()} mutationsEnabled />);

    fireEvent.click(screen.getAllByRole("button", { name: WORK_ACTION_LABELS.complete })[0]!);

    expect(mocks.completeWorkItem).toHaveBeenCalledWith({
      taskId: "task-1",
      idempotencyKey: null,
    });
    // The row stays briefly with an undo affordance rather than refreshing out immediately.
    expect(await screen.findByRole("button", { name: /undo/i })).toBeTruthy();
  });

  it("reopens the task to open when undo is clicked", async () => {
    mocks.completeWorkItem.mockResolvedValueOnce({ success: true });
    mocks.updateContractTaskStatus.mockResolvedValueOnce({ success: true });

    renderWithProviders(<WorkReleaseActions row={baseRow()} mutationsEnabled />);

    fireEvent.click(screen.getAllByRole("button", { name: WORK_ACTION_LABELS.complete })[0]!);
    fireEvent.click(await screen.findByRole("button", { name: /undo/i }));

    expect(mocks.updateContractTaskStatus).toHaveBeenCalledWith("task-1", "open");
    await waitFor(() => expect(mockRouter.refresh).toHaveBeenCalled());
  });

  it("renders a link-kind primary as navigation instead of creating a fake mutation", () => {
    const row = baseRow({
      type: "exception",
      status: "open",
      primaryAction: {
        verb: "resolve",
        label: "Resolve",
        kind: "link",
        href: "/contracts/exceptions?status=open&contract=contract-1",
      },
    });

    renderWithProviders(<WorkReleaseActions row={row} mutationsEnabled />);

    expect(screen.getByRole("link", { name: "Resolve" }).getAttribute("href")).toBe(
      "/contracts/exceptions?status=open&contract=contract-1"
    );
    expect(mocks.completeWorkItem).not.toHaveBeenCalled();
  });

  it("keeps read-only users in a compact permission cell", () => {
    renderWithProviders(<WorkReleaseActions row={baseRow()} mutationsEnabled={false} />);

    expect(screen.getByText(/you can see this area, but your role cannot perform this action\./i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /workspace roles/i }).getAttribute("href")).toBe("/settings");
    expect(screen.queryByText("Actions")).toBeNull();
  });
});
