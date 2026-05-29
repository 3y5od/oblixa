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
  updateContractObligation: vi.fn(),
}));

vi.mock("@/actions/tasks", () => ({
  completeWorkItem: mocks.completeWorkItem,
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
      { key: "escalate", label: WORK_ACTION_LABELS.escalate, kind: "link", href: "/contracts/contract-1" },
    ],
    ...overrides,
  };
}

describe("WorkReleaseActions", () => {
  afterEach(() => {
    resetMockRouter();
    mocks.completeWorkItem.mockReset();
    mocks.updateContractObligation.mockReset();
  });

  it("keeps one compact action cluster while exposing the full release-state vocabulary", () => {
    renderWithProviders(<WorkReleaseActions row={baseRow()} mutationsEnabled />);

    expect(screen.getByText("Actions")).toBeTruthy();
    for (const label of Object.values(WORK_ACTION_LABELS)) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("fires the direct Complete mutation for supported task rows", async () => {
    mocks.completeWorkItem.mockResolvedValueOnce({ success: true });

    renderWithProviders(<WorkReleaseActions row={baseRow()} mutationsEnabled />);

    fireEvent.click(screen.getAllByRole("button", { name: WORK_ACTION_LABELS.complete })[0]!);

    expect(mocks.completeWorkItem).toHaveBeenCalledWith({
      taskId: "task-1",
      idempotencyKey: null,
    });
    await waitFor(() => expect(mockRouter.refresh).toHaveBeenCalled());
  });

  it("routes unsupported actions to the row or contract instead of creating fake mutations", () => {
    const row = baseRow({
      actions: [
        { key: "complete", label: WORK_ACTION_LABELS.complete, kind: "link", href: "/contracts/contract-1#source" },
        { key: "reassign", label: WORK_ACTION_LABELS.reassign, kind: "link", href: "/contracts/contract-1" },
        { key: "change_due_date", label: WORK_ACTION_LABELS.change_due_date, kind: "link", href: "/contracts/contract-1" },
        { key: "comment", label: WORK_ACTION_LABELS.comment, kind: "link", href: "/contracts/contract-1?tab=notes" },
        { key: "link_evidence", label: WORK_ACTION_LABELS.link_evidence, kind: "link", href: "/contracts/contract-1?tab=overview#contract-evidence" },
        { key: "escalate", label: WORK_ACTION_LABELS.escalate, kind: "link", href: "/contracts/contract-1" },
      ],
    });

    renderWithProviders(<WorkReleaseActions row={row} mutationsEnabled />);

    expect(screen.getAllByRole("link", { name: WORK_ACTION_LABELS.complete })[0]?.getAttribute("href")).toBe(
      "/contracts/contract-1#source"
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
