import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { DashboardQuickFilterCard } from "./dashboard-quick-filter-card";

describe("DashboardQuickFilterCard", () => {
  it("renders quick filter links", () => {
    renderWithProviders(<DashboardQuickFilterCard view="team" quickFilter="deadlines" />);
    expect(screen.getByText("Quick filters")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Deadlines" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Approvals" })).toBeTruthy();
  });
});

