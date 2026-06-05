import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { AuthLegalFooter } from "./auth-legal-footer";

describe("AuthLegalFooter", () => {
  it("renders the operational no-legal-advice notice", () => {
    // Policy links moved into the in-content legal row (see AuthForm); the page
    // footer now carries only the operational notice, so it isn't duplicated.
    renderWithProviders(<AuthLegalFooter />);
    expect(screen.getByText(/does not provide legal advice/i)).toBeTruthy();
  });
});

