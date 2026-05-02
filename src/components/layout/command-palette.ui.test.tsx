import "@/test-utils/mock-navigation";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const telemetry = vi.hoisted(() => ({
  emitCmdkPaletteOpenedTelemetry: vi.fn().mockResolvedValue(undefined),
  emitCmdkResultSelectedTelemetry: vi.fn().mockResolvedValue(undefined),
  emitCmdkSearchFailedTelemetry: vi.fn().mockResolvedValue(undefined),
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
    telemetry.emitCmdkSearchFailedTelemetry.mockClear();
    telemetry.emitCmdkZeroResultsTelemetry.mockClear();
    vi.unstubAllGlobals();
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
    expect(links[0]?.textContent).toContain("Contract");
    expect(links[0]?.textContent).toContain("Acme Corp");
    expect(links[0]?.textContent).toContain("Taylor Ops");
    expect(links[0]?.textContent).toContain("Active");
  });

  it("keeps V10 indexed destinations when the query matches description or action metadata", async () => {
    renderWithProviders(
      <CommandPalette
        role="viewer"
        navSurface={coreSurface}
        v5Flags={{} as Record<FeatureFlagKey, boolean>}
        contractResults={[
          {
            id: "report-1",
            title: "Workspace health report",
            href: "/reports?run=report-1",
            resultType: "report run",
            description: "SMTP delivery failure needs retry",
            actionLabel: "Open recovery action",
          },
        ]}
      />
    );

    await act(async () => {
      openCommandPalette("smtp");
    });

    const links = await screen.findAllByRole("link");
    expect(links[0]?.getAttribute("href")).toBe("/reports?run=report-1");
    expect(links[0]?.textContent).toContain("Open recovery action");
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

  it("shows V10 recovery actions when remote command search fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    renderWithProviders(
      <CommandPalette
        role="viewer"
        navSurface={coreSurface}
        v5Flags={{} as Record<FeatureFlagKey, boolean>}
      />
    );

    await act(async () => {
      openCommandPalette("zzzz-remote-failure");
    });

    expect(await screen.findByText("Command search could not load.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry search" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open workspace health" }).getAttribute("href")).toBe("/settings/health");
    expect(telemetry.emitCmdkSearchFailedTelemetry).toHaveBeenCalledWith({ queryLen: 19 });
  });

  it("renders V10 recovery diagnostics from remote command search", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          contracts: [],
          recovery: {
            message: "No command result matched this query.",
            diagnosticId: "v10_command_zero_result",
            actions: [{ label: "Open work queue", href: "/work", reason: "zero_result" }],
          },
        }),
      })
    );
    renderWithProviders(
      <CommandPalette
        role="viewer"
        navSurface={coreSurface}
        v5Flags={{} as Record<FeatureFlagKey, boolean>}
      />
    );

    await act(async () => {
      openCommandPalette("zzzz-no-result");
    });

    expect(await screen.findByText("No command result matched this query.")).toBeTruthy();
    expect(screen.getByText("No command result matched this query.").closest("[data-v10-diagnostic-id]")?.getAttribute("data-v10-diagnostic-id")).toBe(
      "v10_command_zero_result"
    );
    expect(screen.getByRole("link", { name: "Open work queue" }).getAttribute("href")).toBe("/work");
  });
});

