import "@/test-utils/mock-navigation";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { setMockPathname } from "@/test-utils/mock-navigation";
import { mockRouter } from "@/test-utils/mock-router";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import { Header } from "./header";

const coreSurface: NavSurfaceInput = {
  mode: "core",
  role: "viewer",
  featureFlags: {} as Record<FeatureFlagKey, boolean>,
  seesAdvancedPrimaryNav: false,
  seesAssuranceNav: false,
  advancedModulesHidden: [],
  assuranceModulesHidden: [],
  utilityModulesHidden: [],
  searchScope: "match_mode",
};

describe("Header", () => {
  it("renders a route-aware breadcrumb and keeps Tools hidden in Core", () => {
    setMockPathname("/dashboard");
    renderWithProviders(
      <Header navSurface={coreSurface} showUtilitiesLink />
    );

    // Breadcrumb reflects real product hierarchy, not the workspace mode.
    expect(screen.getByText("Dashboard")).toBeTruthy();
    expect(screen.queryByText(/core/i)).toBeNull();
    expect(screen.getByTestId("workspace-header-search")).toBeTruthy();
    expect(screen.queryByText("Tools")).toBeNull();
  });

  it("never presents an email local-part as a fake account name", () => {
    setMockPathname("/dashboard");
    renderWithProviders(
      <Header navSurface={coreSurface} email="altemailforroux@example.com" />
    );

    // No real profile name → neutral "Account" label, never the local-part.
    expect(screen.getByRole("button", { name: "Account menu" })).toBeTruthy();
    expect(screen.queryByText("altemailforroux")).toBeNull();
    expect(screen.queryByRole("button", { name: /account menu for/i })).toBeNull();
  });

  it("builds a parent/leaf breadcrumb for nested Core surfaces", () => {
    setMockPathname("/contracts/review");
    renderWithProviders(<Header navSurface={coreSurface} showUtilitiesLink />);

    const contractsCrumb = screen.getByRole("link", { name: "Contracts" });
    expect(contractsCrumb.getAttribute("href")).toBe("/contracts");
    expect(screen.getByText("Review queue")).toBeTruthy();
  });

  it("submits header search to the global /search route", async () => {
    setMockPathname("/contracts");
    const user = userEvent.setup();
    mockRouter.push.mockClear();

    renderWithProviders(<Header navSurface={coreSurface} showUtilitiesLink />);

    const input = screen.getByTestId("workspace-header-search");
    await user.type(input, "renewals");
    fireEvent.submit(input.closest("form")!);

    expect(mockRouter.push).toHaveBeenCalledWith("/search?q=renewals");
  });

  it("submits an empty header search to /search without a query string", () => {
    setMockPathname("/contracts");
    mockRouter.push.mockClear();

    renderWithProviders(<Header navSurface={coreSurface} showUtilitiesLink />);

    const input = screen.getByTestId("workspace-header-search");
    fireEvent.submit(input.closest("form")!);

    expect(mockRouter.push).toHaveBeenCalledWith("/search");
  });
});
