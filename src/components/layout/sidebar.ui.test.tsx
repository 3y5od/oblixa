import "@/test-utils/mock-navigation";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { resetMockNavigation, setMockPathname, setMockSearchParams } from "@/test-utils/mock-navigation";
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

const advancedWatchlistsHiddenSurface: NavSurfaceInput = {
  ...advancedSurface,
  utilityModulesHidden: ["watchlists"],
};

function renderSidebar(props: Partial<Parameters<typeof Sidebar>[0]> = {}) {
  return renderWithProviders(
    <Sidebar role="viewer" navSurface={coreSurface} v5Flags={{} as Record<FeatureFlagKey, boolean>} {...props} />
  );
}

describe("Sidebar", () => {
  afterEach(() => {
    window.localStorage.clear();
    resetMockNavigation();
    document.body.style.overflow = "";
    vi.unstubAllGlobals();
  });

  it("shows primary navigation and hides advanced nav in core mode", () => {
    setMockPathname("/dashboard");
    renderSidebar();

    const primary = screen.getByTestId("primary-nav");
    expect(primary.textContent).toContain("Dashboard");
    expect(primary.textContent).not.toContain("Decisions");
    expect(primary.textContent).not.toContain("Campaigns");
  });

  it("marks Work active as a single release-state destination", () => {
    setMockPathname("/work");
    renderSidebar();

    const primary = screen.getByTestId("primary-nav");
    const work = within(primary).getByRole("link", { name: /^work$/i });
    expect(work.getAttribute("aria-current")).toBe("page");
    expect(within(primary).queryByRole("link", { name: /^tasks$/i })).toBeNull();
    expect(within(primary).queryByRole("link", { name: /^approvals$/i })).toBeNull();
    expect(within(primary).queryByRole("link", { name: /^obligations$/i })).toBeNull();
    expect(within(primary).queryByRole("link", { name: /^exceptions$/i })).toBeNull();
  });

  it("shows advanced destinations only when the surface allows them", () => {
    setMockPathname("/decisions");
    renderSidebar({ role: "admin", navSurface: advancedSurface, v5Flags: advancedSurface.featureFlags });

    const primary = screen.getByTestId("primary-nav");
    expect(primary.textContent).toContain("Decisions");
    expect(primary.textContent).toContain("Campaigns");
    expect(primary.textContent).toContain("Relationships");
  });

  it("hides sidebar and mobile Tools when layout Tools is unavailable", async () => {
    setMockPathname("/dashboard");
    const user = userEvent.setup();
    renderSidebar({ showToolsLink: false });

    expect(screen.getByTestId("primary-nav").textContent).not.toContain("Tools");
    await user.click(screen.getByRole("button", { name: /open navigation/i }));
    expect(within(screen.getByRole("dialog", { name: /navigation drawer/i })).queryByText("Browse tools")).toBeNull();
  });

  it("keeps sidebar Tools hidden for Core even when layout Tools is available", () => {
    setMockPathname("/dashboard");
    renderSidebar({ showToolsLink: true });

    expect(screen.queryByRole("link", { name: /^tools$/i })).toBeNull();
  });

  it("shows expanded badge counts with full accessible labels", () => {
    setMockPathname("/contracts/review");
    renderSidebar({ navBadges: { reviewQueue: 7 } });

    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByTitle("7 field review items need action").getAttribute("aria-label")).toBe("7 field review items need action");
  });

  it("keeps badge counts titled but hidden from collapsed link accessible names", async () => {
    window.localStorage.setItem("oblixa.sidebar.collapsed", "1");
    setMockPathname("/contracts/review");
    renderSidebar({ navBadges: { reviewQueue: 101 } });

    await waitFor(() => expect(screen.getByRole("link", { name: /^contracts$/i })).toBeTruthy());
    expect(screen.getByTitle("101 field review items need action").getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByRole("link", { name: /^contracts$/i }).textContent).not.toContain("99+");
  });

  it("exposes unique nav landmark names and collapse button state", () => {
    setMockPathname("/dashboard");
    renderSidebar();

    const names = screen.getAllByRole("navigation").map((nav) => nav.getAttribute("aria-labelledby"));
    expect(new Set(names).size).toBe(names.length);
    const toggle = screen.getByTestId("sidebar-collapse-toggle");
    expect(toggle.getAttribute("aria-controls")).toBe("desktop-sidebar-body");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });

  it("keeps the first expanded section heading available without visual noise", () => {
    setMockPathname("/dashboard");
    renderSidebar();

    const coreHeading = screen.getByText("Core");
    expect(coreHeading.className).toContain("sr-only");
    expect(screen.queryByText("Contract operations OS")).toBeNull();
  });

  it("keeps expanded sign out adjacent to navigation instead of pinned below a spacer", () => {
    setMockPathname("/dashboard");
    renderSidebar();

    const desktopBody = document.getElementById("desktop-sidebar-body");
    expect(desktopBody).toBeTruthy();
    expect(desktopBody?.contains(screen.getByRole("button", { name: /^sign out$/i }))).toBe(true);
  });

  it("gives collapsed sign-out an accessible name and shows tooltip labels on focus", async () => {
    window.localStorage.setItem("oblixa.sidebar.collapsed", "1");
    setMockPathname("/dashboard");
    renderSidebar();

    const settings = await screen.findByRole("link", { name: /^settings$/i });
    expect(screen.getByRole("button", { name: /^sign out$/i })).toBeTruthy();
    fireEvent.focus(settings);
    expect(await screen.findByText(/^Settings$/)).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByText(/^Settings$/)).toBeNull());
  });

  it("opens the mobile drawer on the left and exposes navigation controls", async () => {
    setMockPathname("/dashboard");
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole("button", { name: /open navigation/i }));
    const drawer = screen.getByRole("dialog", { name: /navigation drawer/i });
    expect(drawer.firstElementChild?.tagName).toBe("ASIDE");
    expect(within(drawer).getByRole("button", { name: /^close navigation$/i })).toBeTruthy();
  });

  it("opens a full mobile drawer even when desktop sidebar is collapsed", async () => {
    window.localStorage.setItem("oblixa.sidebar.collapsed", "1");
    setMockPathname("/dashboard");
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole("button", { name: /open navigation/i }));
    const drawer = screen.getByRole("dialog", { name: /navigation drawer/i });
    expect(within(drawer).getByText("Oblixa")).toBeTruthy();
    expect(within(drawer).getByRole("link", { name: /^contracts$/i })).toBeTruthy();
  });

  it("traps mobile drawer focus on Tab and Shift+Tab", async () => {
    setMockPathname("/dashboard");
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole("button", { name: /open navigation/i }));
    const drawer = screen.getByRole("dialog", { name: /navigation drawer/i });
    const first = within(drawer).getByRole("link", { name: /oblixa/i });
    const overlay = within(drawer).getByRole("button", { name: /close navigation overlay/i });
    first.focus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(overlay);
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(first);
  });

  it("returns focus after Escape, overlay, close button, and nav link closes", async () => {
    setMockPathname("/dashboard");
    const user = userEvent.setup();
    renderSidebar();
    const openButton = screen.getByRole("button", { name: /open navigation/i });

    await user.click(openButton);
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /navigation drawer/i })).toBeNull());
    expect(document.activeElement).toBe(openButton);

    await user.click(openButton);
    await user.click(within(screen.getByRole("dialog", { name: /navigation drawer/i })).getByRole("button", { name: /close navigation overlay/i }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /navigation drawer/i })).toBeNull());
    expect(document.activeElement).toBe(openButton);

    await user.click(openButton);
    await user.click(within(screen.getByRole("dialog", { name: /navigation drawer/i })).getByRole("button", { name: /^close navigation$/i }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /navigation drawer/i })).toBeNull());
    expect(document.activeElement).toBe(openButton);

    await user.click(openButton);
    await user.click(within(screen.getByRole("dialog", { name: /navigation drawer/i })).getByRole("link", { name: /^contracts$/i }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /navigation drawer/i })).toBeNull());
    expect(document.activeElement).toBe(openButton);
  });

  it("closes the mobile drawer when the route changes", async () => {
    setMockPathname("/dashboard");
    const user = userEvent.setup();
    const { rerender } = renderSidebar();

    await user.click(screen.getByRole("button", { name: /open navigation/i }));
    expect(screen.getByRole("dialog", { name: /navigation drawer/i })).toBeTruthy();
    setMockPathname("/contracts");
    rerender(<Sidebar role="viewer" navSurface={coreSurface} v5Flags={{} as Record<FeatureFlagKey, boolean>} />);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /navigation drawer/i })).toBeNull());
  });

  it("does not overwrite the stored collapse preference while onboarding forces collapse", async () => {
    window.localStorage.setItem("oblixa.sidebar.collapsed", "0");
    setMockPathname("/onboarding/calibration");
    renderSidebar();

    await waitFor(() => expect(screen.getByRole("link", { name: /^dashboard$/i })).toBeTruthy());
    expect(window.localStorage.getItem("oblixa.sidebar.collapsed")).toBe("0");
    expect(screen.queryByTestId("sidebar-collapse-toggle")).toBeNull();
  });

  it("keeps default desktop state expanded before a stored preference is present", () => {
    setMockPathname("/dashboard");
    renderSidebar();

    expect(screen.getByTestId("sidebar-collapse-toggle").getAttribute("aria-expanded")).toBe("true");
  });

  it("filters client-refreshed hidden badge keys before rendering", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify({ navBadges: { reviewQueue: 2, watchlists: 9 } }),
      })
    );
    setMockPathname("/contracts/review");
    renderSidebar({ role: "admin", navSurface: advancedWatchlistsHiddenSurface, navBadges: {} });

    expect(await screen.findByTitle("2 field review items need action")).toBeTruthy();
    expect(screen.queryByTitle("9 watchlist items")).toBeNull();
    expect(screen.queryByRole("link", { name: /^watchlists$/i })).toBeNull();
  });

  it("keeps current badges when client refresh fails quietly", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    setMockPathname("/contracts/review");
    renderSidebar({ navBadges: { reviewQueue: 3 } });

    expect(await screen.findByTitle("3 field review items need action")).toBeTruthy();
    await waitFor(() => expect(screen.getByTitle("3 field review items need action")).toBeTruthy());
  });

  it("honors query and hash active states in rendered links", () => {
    setMockPathname("/decisions");
    setMockSearchParams("type=renewal");
    renderSidebar({ role: "admin", navSurface: advancedSurface, v5Flags: advancedSurface.featureFlags });
    const renewalQuery = screen.getAllByRole("link", { name: /^renewals$/i }).find((link) => link.getAttribute("href") === "/decisions?type=renewal");
    expect(renewalQuery?.getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: /^decision queue$/i }).getAttribute("aria-current")).toBeNull();
  });
});
