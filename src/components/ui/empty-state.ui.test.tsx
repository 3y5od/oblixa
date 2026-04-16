import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("renders eyebrow, title, copy, and action", () => {
    renderWithProviders(
      <EmptyState
        eyebrow="Queue"
        title="Nothing here"
        copy="No rows matched your filters."
        action={<button type="button">Reset</button>}
      />
    );

    expect(screen.getByText("Queue")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Nothing here" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reset" })).toBeTruthy();
  });
});

