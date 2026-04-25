/** @vitest-environment jsdom */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { RenewalRowChecklistActions } from "./renewal-row-checklist-actions";

const refreshMock = vi.fn();
const seedMock = vi.fn();
const clarifyMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock("@/actions/renewal-playbook", () => ({
  seedRenewalPlaybook: (...args: unknown[]) => seedMock(...args),
}));

vi.mock("@/actions/tasks", () => ({
  createCheckpointClarificationTask: (...args: unknown[]) => clarifyMock(...args),
}));

describe("RenewalRowChecklistActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("seeds playbook with visible success and refresh", async () => {
    seedMock.mockResolvedValue({ success: true });
    renderWithProviders(
      <RenewalRowChecklistActions
        contractId="550e8400-e29b-41d4-a716-446655440000"
        pendingCheckpointId={null}
        checkpointTotal={0}
        checkpointCompleted={0}
        playbookRecommendation=""
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /seed checklist/i }));
    expect(await screen.findByText(/checklist seeded/i)).toBeTruthy();
    await waitFor(() => expect(refreshMock).toHaveBeenCalled(), { timeout: 2000 });
  });

  it("shows normalized error when seed fails", async () => {
    seedMock.mockResolvedValue({ error: "Not authenticated" });
    renderWithProviders(
      <RenewalRowChecklistActions
        contractId="550e8400-e29b-41d4-a716-446655440000"
        pendingCheckpointId={null}
        checkpointTotal={0}
        checkpointCompleted={0}
        playbookRecommendation=""
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /seed checklist/i }));
    expect((await screen.findByRole("alert")).textContent ?? "").toMatch(/session/i);
  });

  it("creates clarification task when note present", async () => {
    clarifyMock.mockResolvedValue({ success: true, taskId: "t1" });
    renderWithProviders(
      <RenewalRowChecklistActions
        contractId="550e8400-e29b-41d4-a716-446655440000"
        pendingCheckpointId="660e8400-e29b-41d4-a716-446655440001"
        checkpointTotal={2}
        checkpointCompleted={1}
        playbookRecommendation="Finish checkpoints"
      />
    );
    fireEvent.change(screen.getByPlaceholderText(/clarification request/i), {
      target: { value: "Need legal sign-off" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create clarification task/i }));
    await waitFor(() =>
      expect(clarifyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          contractId: "550e8400-e29b-41d4-a716-446655440000",
          checkpointId: "660e8400-e29b-41d4-a716-446655440001",
          requesterNote: "Need legal sign-off",
        })
      )
    );
  });
});
