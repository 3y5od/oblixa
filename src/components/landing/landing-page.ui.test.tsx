import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { LandingPage } from "./landing-page";

describe("LandingPage", () => {
  it("renders the hero promise and primary CTA", () => {
    renderWithProviders(<LandingPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: /track what signed contracts require next/i })
    ).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /request access/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /view product tour/i }).length).toBeGreaterThan(0);
  });

  it("renders the spec-mandated landing sections", () => {
    renderWithProviders(<LandingPage />);
    expect(screen.getByRole("heading", { name: /the follow-up is scattered/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /from contract spreadsheet to/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /spreadsheets, heavy suites/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /purpose-built for contract tracking/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /know what needs attention before/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /built for teams outgrowing/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /frequently asked questions/i })).toBeTruthy();
  });

  it("publishes the Core price and the reviewed-access close", () => {
    renderWithProviders(<LandingPage />);
    expect(screen.getByRole("heading", { name: /one core plan/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /start with a small contract set/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /security overview/i })).toBeTruthy();
  });
});
