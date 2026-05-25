import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { LandingPage } from "./landing-page";

describe("LandingPage", () => {
  it("renders the primary hero CTA and core sections", () => {
    renderWithProviders(<LandingPage />);
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /start free trial/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /^capabilities$/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /purpose-built for contract tracking/i })).toBeTruthy();
  });

  it("renders the long-form contract tracking sections", () => {
    renderWithProviders(<LandingPage />);
    expect(screen.getByRole("heading", { name: /know what needs attention before/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /built for teams outgrowing/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /start by replacing the spreadsheet/i })).toBeTruthy();
  });
});
