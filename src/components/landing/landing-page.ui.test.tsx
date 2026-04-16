import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { LandingPage } from "./landing-page";

describe("LandingPage", () => {
  it("renders the primary hero CTA and core sections", () => {
    renderWithProviders(<LandingPage />);
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.getByRole("link", { name: /get started/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /capabilities/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /purpose-built capabilities/i })).toBeTruthy();
  });
});

