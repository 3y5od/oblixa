import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { MarketingSiteFooter, MarketingSiteHeader } from "./marketing-site-chrome";

describe("Marketing site chrome", () => {
  it("renders the header with account actions", () => {
    renderWithProviders(<MarketingSiteHeader />);
    expect(screen.getByRole("navigation", { name: /site/i })).toBeTruthy();
    // "Legal" was removed from the primary nav; the legal index now
    // lives only in the footer. Product remains a top-level Ship page.
    expect(screen.getByRole("link", { name: /^product$/i })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /^legal$/i })).toBeNull();
    expect(screen.getByRole("link", { name: /sign in/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /request access/i })).toBeTruthy();
  });

  it("renders the footer with legal and account links", () => {
    renderWithProviders(<MarketingSiteFooter />);
    expect(screen.getByRole("navigation", { name: /legal and policies/i })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: /account/i })).toBeTruthy();
  });
});
