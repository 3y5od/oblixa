import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { MarketingSiteFooter, MarketingSiteHeader } from "./marketing-site-chrome";

describe("Marketing site chrome", () => {
  it("renders the header with the release-aligned nav + account actions", () => {
    renderWithProviders(<MarketingSiteHeader />);
    expect(screen.getByRole("navigation", { name: /site/i })).toBeTruthy();
    // Lean public nav: Product, Pricing (renamed from "Access and pricing" to
    // match the /pricing page H1), Security. Legal + Contact live in the footer.
    expect(screen.getByRole("link", { name: /^product$/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /^pricing$/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /^security$/i })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /access and pricing/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /^legal$/i })).toBeNull();
    // Contact is rendered (visible at lg+ and in the mobile drawer; CSS hides it
    // only in the medium-width inline nav).
    expect(screen.getByRole("link", { name: /^contact$/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /sign in/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /request access/i })).toBeTruthy();
  });

  it("renders the footer columns, legal links, and the primary request-access CTA", () => {
    renderWithProviders(<MarketingSiteFooter />);
    // Three scannable link columns + the account CTA region.
    expect(screen.getByRole("navigation", { name: /^product$/i })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: /legal and policies/i })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: /^support$/i })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: /account/i })).toBeTruthy();
    // Contact now lives in the Support column (moved out of the legal row so it
    // no longer wraps onto its own line).
    expect(screen.getByRole("link", { name: /^contact$/i })).toBeTruthy();
    // Request access is the primary CTA and also a Product-column entry; the
    // product tour is the ghost secondary.
    expect(screen.getAllByRole("link", { name: /request access/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("link", { name: /view product/i })).toBeTruthy();
  });
});
