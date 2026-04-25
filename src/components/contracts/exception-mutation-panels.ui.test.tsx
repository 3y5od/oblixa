/** @vitest-environment jsdom */
import "@/test-utils/mock-navigation";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { mockRouter, resetMockRouter } from "@/test-utils/mock-router";
import { ExceptionMutationPanels } from "./exception-mutation-panels";

const mocks = vi.hoisted(() => ({
  assignException: vi.fn(),
  resolveException: vi.fn(),
  reopenException: vi.fn(),
}));

vi.mock("@/actions/exceptions", () => ({
  assignException: mocks.assignException,
  resolveException: mocks.resolveException,
  reopenException: mocks.reopenException,
}));

describe("ExceptionMutationPanels", () => {
  afterEach(() => {
    resetMockRouter();
    mocks.assignException.mockReset();
    mocks.resolveException.mockReset();
    mocks.reopenException.mockReset();
  });

  it("preserves the resolution note on error", async () => {
    mocks.resolveException.mockResolvedValueOnce({ error: "Resolution note is too long." });

    renderWithProviders(
      <ExceptionMutationPanels
        exceptionId="exception-1"
        ownerId={null}
        dueDate={null}
        ownerOptions={[]}
        canAssign={false}
        canResolve
        canReopen={false}
      />
    );

    const noteField = screen.getByPlaceholderText(/resolution note/i);
    fireEvent.change(noteField, { target: { value: "Captured fix details" } });
    expect(screen.getByText(/the resolution note stays local until you save it/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /mark resolved/i }));

    expect((await screen.findByRole("alert")).textContent).toMatch(/resolution note is too long/i);
    expect(noteField).toHaveProperty("value", "Captured fix details");
    expect(mockRouter.refresh).not.toHaveBeenCalled();
  });

  it("shows success feedback before refreshing the page", async () => {
    mocks.reopenException.mockResolvedValueOnce({
      success: true,
      message: "Exception reopened and returned to the active ledger.",
    });

    renderWithProviders(
      <ExceptionMutationPanels
        exceptionId="exception-1"
        ownerId={null}
        dueDate={null}
        ownerOptions={[]}
        canAssign={false}
        canResolve={false}
        canReopen
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /reopen exception/i }));

    expect(await screen.findByText(/exception reopened and returned to the active ledger\./i)).toBeTruthy();
    expect(mockRouter.refresh).not.toHaveBeenCalled();
    await waitFor(() => expect(mockRouter.refresh).toHaveBeenCalled(), { timeout: 1500 });
  });
});
