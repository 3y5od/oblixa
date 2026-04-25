import "@/test-utils/mock-navigation";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const telemetry = vi.hoisted(() => ({
  emitCmdkPaletteOpenedTelemetry: vi.fn().mockResolvedValue(undefined),
  emitCmdkResultSelectedTelemetry: vi.fn().mockResolvedValue(undefined),
  emitCmdkZeroResultsTelemetry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/actions/product-telemetry", () => telemetry);
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
  afterEach(() => {
    vi.useRealTimers();
    telemetry.emitCmdkPaletteOpenedTelemetry.mockClear();
    telemetry.emitCmdkResultSelectedTelemetry.mockClear();
    telemetry.emitCmdkZeroResultsTelemetry.mockClear();
  });

  it("ranks direct contract matches ahead of generic search jumps", async () => {
    renderWithProviders(
      <CommandPalette
        role="viewer"
        navSurface={coreSurface}
        v5Flags={{} as Record<FeatureFlagKey, boolean>}
        contractResults={[
          {
            id: "contract-1",
            title: "Acme Master Services Agreement",
            counterparty: "Acme Corp",
            status: "active",
            ownerLabel: "Taylor Ops",
          },
        ]}
      />
    );

    await act(async () => {
      openCommandPalette("acme");
    });

    const links = await screen.findAllByRole("link");
    expect(links[0]?.getAttribute("href")).toBe("/contracts/contract-1");
    expect(screen.getByText("Contract · Acme Corp · Taylor Ops · Active")).toBeTruthy();
  });

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
    expect(screen.getByPlaceholderText(/search pages, queues, reports, tools/i)).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /contracts/i }).length).toBeGreaterThan(0);
    expect(screen.getByText(/^Workflows · \/contracts$/i)).toBeTruthy();
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

    expect(await screen.findByText("Recent destinations")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /contracts/i }).length).toBeGreaterThanOrEqual(2);
  });

  it("emits debounced zero-results telemetry when no command matches", async () => {
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

    fireEvent.change(screen.getByPlaceholderText(/search pages, queues, reports, tools/i), {
      target: { value: "zzzz-no-match" },
    });

    await waitFor(
      () => {
        expect(telemetry.emitCmdkZeroResultsTelemetry).toHaveBeenCalledWith({ queryLen: 13 });
      },
      { timeout: 3000 }
    );
  });
});

