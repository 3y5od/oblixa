import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { MarketingSiteFooter, MarketingSiteHeader } from "./marketing-site-chrome";

describe("Marketing site chrome", () => {
  it("renders the header with account actions", () => {
    renderWithProviders(<MarketingSiteHeader />);
    expect(screen.getByRole("navigation", { name: /site/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /sign in/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /get started/i })).toBeTruthy();
  });

  it("renders the footer with legal and account links", () => {
    renderWithProviders(<MarketingSiteFooter />);
    expect(screen.getByRole("navigation", { name: /legal and policies/i })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: /account/i })).toBeTruthy();
  });
});

