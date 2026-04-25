import "@/test-utils/mock-navigation";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { setMockPathname } from "@/test-utils/mock-navigation";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import { COMMAND_PALETTE_OPEN_EVENT } from "@/lib/product-surface/command-palette-bridge";
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
  it("renders context line and tools entrypoint", () => {
    setMockPathname("/dashboard");
    renderWithProviders(
      <Header
        fullName="Taylor Test"
        email="taylor@example.com"
        navSurface={coreSurface}
        showUtilitiesLink
      />
    );

    expect(screen.getByText("Home · Execution workspace")).toBeTruthy();
    expect(screen.getAllByText("Tools").length).toBeGreaterThan(0);
    expect(screen.getByText("Taylor Test")).toBeTruthy();
  });

  it("submits header search through the command palette bridge", async () => {
    setMockPathname("/contracts");
    const user = userEvent.setup();
    let receivedQuery = "";
    window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, (event) => {
      receivedQuery = ((event as CustomEvent<{ query?: string }>).detail?.query ?? "").trim();
    });

    renderWithProviders(<Header email="user@example.com" navSurface={coreSurface} showUtilitiesLink />);

    const input = screen.getByTestId("workspace-header-search");
    await user.type(input, "renewals");
    fireEvent.submit(input.closest("form")!);

    expect(receivedQuery).toBe("renewals");
  });
});

