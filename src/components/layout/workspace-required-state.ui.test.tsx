import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { WorkspaceRequiredState } from "./workspace-required-state";

describe("WorkspaceRequiredState", () => {
  it("renders default empty-state guidance", () => {
    renderWithProviders(<WorkspaceRequiredState />);
    expect(screen.getByText("No workspace linked")).toBeTruthy();
    expect(screen.getByText(/ask a workspace admin/i)).toBeTruthy();
  });
});

