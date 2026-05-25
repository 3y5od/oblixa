import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { LegalFooter } from "./legal-footer";

describe("LegalFooter", () => {
  it("renders footer links", () => {
    renderWithProviders(<LegalFooter />);
    expect(screen.getByRole("navigation", { name: /footer links/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Security" })).toBeTruthy();
  });

  it("toggles the notice on small-screen trigger", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LegalFooter />);
    const toggle = screen.getByRole("button", { name: /view/i });
    await user.click(toggle);
    expect(screen.getByText(/not legal advice/i)).toBeTruthy();
  });
});
