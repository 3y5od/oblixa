/** @vitest-environment jsdom */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { mockRouter, resetMockRouter } from "@/test-utils/mock-router";
import { FIELD_NAMES } from "@/lib/types";
import { AddFieldForm } from "./add-field-form";

const addManualField = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

vi.mock("@/actions/contracts", () => ({
  addManualField: (...a: unknown[]) => addManualField(...a),
}));

describe("AddFieldForm", () => {
  afterEach(() => {
    addManualField.mockReset();
    resetMockRouter();
  });

  it("submits a manual field and refreshes on success", async () => {
    const pick = FIELD_NAMES[0]!;
    addManualField.mockResolvedValueOnce({ success: true });

    renderWithProviders(
      <AddFieldForm
        contractId="00000000-0000-0000-0000-000000000000"
        existingFieldNames={[]}
        canEdit
      />
    );
    fireEvent.click(screen.getAllByRole("button", { name: /^add field$/i })[0]!);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: pick } });
    fireEvent.change(screen.getByPlaceholderText(/enter value/i), { target: { value: "  hello  " } });
    fireEvent.click(screen.getAllByRole("button", { name: /^add field$/i })[0]!);

    await waitFor(() => expect(addManualField).toHaveBeenCalled());
    expect(addManualField).toHaveBeenCalledWith(
      "00000000-0000-0000-0000-000000000000",
      pick,
      "hello"
    );
    expect(mockRouter.refresh).toHaveBeenCalled();
  });
});
