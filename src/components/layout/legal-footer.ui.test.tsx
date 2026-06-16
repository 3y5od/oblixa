import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { LegalFooter } from "./legal-footer";

describe("LegalFooter", () => {
  it("renders footer links", () => {
    renderWithProviders(<LegalFooter />);
    expect(screen.getByRole("navigation", { name: /footer links/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Security" })).toBeTruthy();
  });

  it("states the no-legal-advice boundary inline without a disclosure toggle", () => {
    renderWithProviders(<LegalFooter />);
    // The boundary is always visible (quiet one-liner); the full text lives
    // behind the Terms link, so there is no vague "View" toggle.
    expect(screen.getByText(/does not provide legal advice/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /view/i })).toBeNull();
  });
});
