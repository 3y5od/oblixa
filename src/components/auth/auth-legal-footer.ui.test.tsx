import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { AuthLegalFooter } from "./auth-legal-footer";

describe("AuthLegalFooter", () => {
  it("renders policy links for auth surfaces", () => {
    renderWithProviders(<AuthLegalFooter />);
    expect(screen.getByRole("navigation", { name: /legal and policies/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Accessibility" })).toBeTruthy();
  });
});

