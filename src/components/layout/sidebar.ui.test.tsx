import "@/test-utils/mock-navigation";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { setMockPathname } from "@/test-utils/mock-navigation";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import { Sidebar } from "./sidebar";

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

describe("Sidebar", () => {
  it("shows primary navigation and hides advanced nav in core mode", () => {
    setMockPathname("/dashboard");
    renderWithProviders(<Sidebar role="viewer" navSurface={coreSurface} v5Flags={{} as Record<FeatureFlagKey, boolean>} />);

    const primary = screen.getByTestId("primary-nav");
    expect(primary.textContent).toContain("Home");
    expect(primary.textContent).not.toContain("Decisions");
    expect(primary.textContent).not.toContain("Campaigns");
  });

  it("opens the mobile drawer and exposes navigation controls", async () => {
    setMockPathname("/dashboard");
    const user = userEvent.setup();
    renderWithProviders(<Sidebar role="viewer" navSurface={coreSurface} v5Flags={{} as Record<FeatureFlagKey, boolean>} />);

    await user.click(screen.getByRole("button", { name: /open navigation/i }));
    expect(screen.getByRole("dialog", { name: /navigation drawer/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^close navigation$/i })).toBeTruthy();
  });
});

