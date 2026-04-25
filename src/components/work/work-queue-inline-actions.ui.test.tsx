/** @vitest-environment jsdom */
import "@/test-utils/mock-navigation";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { mockRouter, resetMockRouter } from "@/test-utils/mock-router";
import { WorkQueueInlineActions } from "./work-queue-inline-actions";

const mocks = vi.hoisted(() => ({
  updateContractTaskStatus: vi.fn(),
  updateContractApprovalStatus: vi.fn(),
  updateContractObligation: vi.fn(),
}));

vi.mock("@/actions/tasks", () => ({
  updateContractTaskStatus: mocks.updateContractTaskStatus,
}));

vi.mock("@/actions/approvals", () => ({
  updateContractApprovalStatus: mocks.updateContractApprovalStatus,
}));

vi.mock("@/actions/obligations", () => ({
  updateContractObligation: mocks.updateContractObligation,
}));

describe("WorkQueueInlineActions", () => {
  afterEach(() => {
    resetMockRouter();
    mocks.updateContractTaskStatus.mockReset();
    mocks.updateContractApprovalStatus.mockReset();
    mocks.updateContractObligation.mockReset();
  });

  it("surfaces downstream impact before refreshing the queue", async () => {
    mocks.updateContractTaskStatus.mockResolvedValueOnce({
      success: true,
      reopenedDependencyCount: 2,
      generatedRecurringTask: true,
    });

    renderWithProviders(
      <WorkQueueInlineActions kind="task" itemId="task-1" status="in_progress" />
    );

    fireEvent.click(screen.getByRole("button", { name: /complete/i }));

    expect(mocks.updateContractTaskStatus).toHaveBeenCalledWith("task-1", "done");
    expect(
      await screen.findByText(/task marked complete\. 2 blocked dependent tasks reopened\. next recurring task created\./i)
    ).toBeTruthy();
    expect(mockRouter.refresh).not.toHaveBeenCalled();

    await waitFor(() => expect(mockRouter.refresh).toHaveBeenCalled(), { timeout: 1500 });
  });

  it("shows permission eligibility hint instead of row actions when mutations are disabled", () => {
    renderWithProviders(
      <WorkQueueInlineActions
        kind="task"
        itemId="task-1"
        status="in_progress"
        mutationsEnabled={false}
      />
    );

    expect(
      screen.getByText(/you can see this area, but your role cannot perform this action\./i)
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: /workspace roles/i }).getAttribute("href")).toBe("/settings");
    expect(screen.queryByRole("button", { name: /complete/i })).toBeNull();
  });

  it("maps auth failures to a plain-language recovery message", async () => {
    mocks.updateContractApprovalStatus.mockResolvedValueOnce({ error: "Not authenticated" });

    renderWithProviders(
      <WorkQueueInlineActions kind="approval" itemId="approval-1" status="pending" />
    );

    fireEvent.click(screen.getByRole("button", { name: /approve/i }));

    expect((await screen.findByRole("alert")).textContent).toMatch(
      /your session expired\. sign in again, then retry\./i
    );
    expect(mockRouter.refresh).not.toHaveBeenCalled();
  });

  it("renders a direct blocker recovery link next to row actions when provided", () => {
    renderWithProviders(
      <WorkQueueInlineActions
        kind="task"
        itemId="task-1"
        status="blocked"
        blockerHref="/contracts/contract-1"
      />
    );

    expect(screen.getByRole("link", { name: /resolve blocker/i }).getAttribute("href")).toBe(
      "/contracts/contract-1"
    );
  });

  it("uses obligation-specific success copy when completing an obligation", async () => {
    mocks.updateContractObligation.mockResolvedValueOnce({ success: true });

    renderWithProviders(
      <WorkQueueInlineActions kind="obligation" itemId="obl-1" status="in_progress" />
    );

    fireEvent.click(screen.getByRole("button", { name: /complete/i }));

    expect(mocks.updateContractObligation).toHaveBeenCalledWith({
      obligationId: "obl-1",
      status: "done",
    });
    expect(await screen.findByText(/obligation marked complete\./i)).toBeTruthy();
  });

  it("disables inline action buttons while a mutation is in-flight (§12.5)", async () => {
    let resolve!: (v: unknown) => void;
    mocks.updateContractTaskStatus.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        })
    );

    renderWithProviders(
      <WorkQueueInlineActions kind="task" itemId="task-1" status="open" />
    );

    fireEvent.click(screen.getByRole("button", { name: /^start$/i }));

    const saving = await screen.findByRole("button", { name: /saving/i });
    expect(saving.hasAttribute("disabled")).toBe(true);

    resolve!({ success: true, message: "ok" });
    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /^start$/i });
      expect(btn.getAttribute("disabled")).toBeNull();
    });
  });
});
