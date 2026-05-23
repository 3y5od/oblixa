import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { LandingPage } from "./landing-page";

describe("LandingPage", () => {
  it("renders the primary hero CTA and core sections after v9 subtraction pass", () => {
    renderWithProviders(<LandingPage />);
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.getByRole("link", { name: /start free trial/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /^capabilities$/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /purpose-built for contract tracking/i })).toBeTruthy();
  });

  it("does not render the deleted sections after the v9 pass", () => {
    renderWithProviders(<LandingPage />);
    // Sections that were removed:
    expect(screen.queryByRole("heading", { name: /know what needs attention before/i })).toBeNull(); // Outcomes
    expect(screen.queryByRole("heading", { name: /built for teams outgrowing/i })).toBeNull(); // BestFit
    expect(screen.queryByRole("heading", { name: /from contract language to/i })).toBeNull(); // DataFlow
    expect(screen.queryByRole("heading", { name: /every event leaves an/i })).toBeNull(); // ActivityFeed
    expect(screen.queryByRole("heading", { name: /the workflows teams.*run every week/i })).toBeNull(); // Use Cases
    expect(screen.queryByRole("heading", { name: /move your next renewal cycle/i })).toBeNull(); // Get-going
    expect(screen.queryByRole("heading", { name: /start by replacing the spreadsheet/i })).toBeNull(); // PricingCtaSection
  });
});

