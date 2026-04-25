import "@/test-utils/mock-navigation";
import { screen, within } from "@testing-library/react";
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

const advancedSurface: NavSurfaceInput = {
  mode: "advanced",
  role: "admin",
  featureFlags: {
    v5DecisionFoundation: true,
    v5PortfolioCampaigns: true,
    v5RelationshipLayer: true,
  } as Record<FeatureFlagKey, boolean>,
  seesAdvancedPrimaryNav: true,
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

  it("marks nested work links active without giving the parent aria-current", () => {
    setMockPathname("/contracts/tasks");
    renderWithProviders(<Sidebar role="viewer" navSurface={coreSurface} v5Flags={{} as Record<FeatureFlagKey, boolean>} />);

    const primary = screen.getByTestId("primary-nav");
    const work = within(primary).getByRole("link", { name: /^work$/i });
    const tasks = within(primary).getByRole("link", { name: /^tasks$/i });
    expect(work.getAttribute("aria-current")).toBeNull();
    expect(tasks.getAttribute("aria-current")).toBe("page");
  });

  it("shows advanced destinations only when the surface allows them", () => {
    setMockPathname("/decisions");
    renderWithProviders(
      <Sidebar role="admin" navSurface={advancedSurface} v5Flags={advancedSurface.featureFlags} />
    );

    const primary = screen.getByTestId("primary-nav");
    expect(primary.textContent).toContain("Decisions");
    expect(primary.textContent).toContain("Campaigns");
    expect(primary.textContent).toContain("Relationships");
  });

  it("keeps badge counts available in collapsed rail", () => {
    window.localStorage.setItem("oblixa.sidebar.collapsed", "1");
    setMockPathname("/contracts/review");
    renderWithProviders(
      <Sidebar
        role="viewer"
        navSurface={coreSurface}
        v5Flags={{} as Record<FeatureFlagKey, boolean>}
        navBadges={{ reviewQueue: 101 }}
      />
    );

    expect(screen.getByTitle("Review")).toBeTruthy();
    expect(screen.getByLabelText("101 review queue items")).toBeTruthy();
  });

  it("opens the mobile drawer and exposes navigation controls", async () => {
    setMockPathname("/dashboard");
    const user = userEvent.setup();
    renderWithProviders(<Sidebar role="viewer" navSurface={coreSurface} v5Flags={{} as Record<FeatureFlagKey, boolean>} />);

    await user.click(screen.getByRole("button", { name: /open navigation/i }));
    expect(screen.getByRole("dialog", { name: /navigation drawer/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^close navigation$/i })).toBeTruthy();
  });

  it("opens a full mobile drawer even when desktop sidebar is collapsed", async () => {
    window.localStorage.setItem("oblixa.sidebar.collapsed", "1");
    setMockPathname("/dashboard");
    const user = userEvent.setup();
    renderWithProviders(<Sidebar role="viewer" navSurface={coreSurface} v5Flags={{} as Record<FeatureFlagKey, boolean>} />);

    await user.click(screen.getByRole("button", { name: /open navigation/i }));
    const drawer = screen.getByRole("dialog", { name: /navigation drawer/i });
    expect(within(drawer).getByText("Oblixa")).toBeTruthy();
    expect(within(drawer).getByRole("link", { name: /^contracts$/i })).toBeTruthy();
  });
});

