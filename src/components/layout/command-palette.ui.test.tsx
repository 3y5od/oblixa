import "@/test-utils/mock-navigation";
import { act, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { openCommandPalette } from "@/test-utils/mock-command-palette-bridge";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import { CommandPalette } from "./command-palette";

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

describe("CommandPalette", () => {
  it("opens through the bridge event and shows workspace results", async () => {
    renderWithProviders(
      <CommandPalette
        role="viewer"
        navSurface={coreSurface}
        v5Flags={{} as Record<FeatureFlagKey, boolean>}
      />
    );

    await act(async () => {
      openCommandPalette("contracts");
    });

    expect(await screen.findByRole("dialog", { name: /command palette/i })).toBeTruthy();
    expect(screen.getByPlaceholderText(/search pages, queues, reports, or tools/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /contracts/i })).toBeTruthy();
  });

  it("renders recent commands when local storage is seeded", async () => {
    window.localStorage.setItem("oblixa.command-palette.recent", JSON.stringify(["/contracts"]));
    renderWithProviders(
      <CommandPalette
        role="viewer"
        navSurface={coreSurface}
        v5Flags={{} as Record<FeatureFlagKey, boolean>}
      />
    );

    await act(async () => {
      openCommandPalette("");
    });

    expect(await screen.findByText("Recent")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /contracts/i }).length).toBeGreaterThanOrEqual(2);
  });
});

