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
import { mockRouter, resetMockRouter } from "@/test-utils/mock-router";
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

const RECENT_COMMANDS_KEY = "oblixa.command-palette.recent";

describe("CommandPalette", () => {
  afterEach(() => {
    vi.useRealTimers();
    telemetry.emitCmdkPaletteOpenedTelemetry.mockClear();
    telemetry.emitCmdkResultSelectedTelemetry.mockClear();
    telemetry.emitCmdkSearchFailedTelemetry.mockClear();
    telemetry.emitCmdkZeroResultsTelemetry.mockClear();
    resetMockRouter();
    vi.unstubAllGlobals();
    window.localStorage.clear();
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
            actionLabel: "Inspect recovery action",
          },
        ]}
      />
    );

    await act(async () => {
      openCommandPalette("smtp");
    });

    const links = await screen.findAllByRole("link");
    expect(links[0]?.getAttribute("href")).toBe("/reports?run=report-1");
    expect(links[0]?.textContent).toContain("Inspect recovery action");
  });

  it("dedupes local nav items when the remote index returns the same destination", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            contracts: [
              {
                id: "/settings",
                title: "Settings",
                href: "/settings",
                resultType: "setting",
                description: "Members, workspace product mode, and workflow configuration.",
                actionLabel: "Go to destination",
              },
            ],
            partial: null,
            recovery: null,
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
      openCommandPalette("settings");
    });

    await waitFor(() => {
      const settingsLinks = screen
        .getAllByRole("link")
        .filter((link) => link.getAttribute("href") === "/settings");
      expect(settingsLinks).toHaveLength(1);
    });
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

  it("navigates the active result when Enter is pressed", async () => {
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

    expect(await screen.findByRole("dialog", { name: /command palette/i })).toBeTruthy();
    fireEvent.keyDown(window, { key: "Enter" });

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith("/contracts/contract-1");
    });
    expect(telemetry.emitCmdkResultSelectedTelemetry).toHaveBeenCalledWith({
      href: "/contracts/contract-1",
      queryLen: 4,
    });
  });

  it("returns focus to the trigger after Escape closes the palette", async () => {
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

    const trigger = screen.getByRole("button", { name: /open command palette/i });
    expect(await screen.findByRole("dialog", { name: /command palette/i })).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /command palette/i })).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });
  });

  it("returns focus to the invoking control when the palette opens through the bridge", async () => {
    renderWithProviders(
      <>
        <input aria-label="Workspace search bridge invoker" />
        <CommandPalette
          role="viewer"
          navSurface={coreSurface}
          v5Flags={{} as Record<FeatureFlagKey, boolean>}
        />
      </>
    );

    const invoker = screen.getByRole("textbox", { name: /workspace search bridge invoker/i });
    invoker.focus();

    await act(async () => {
      openCommandPalette("contracts");
    });

    expect(await screen.findByRole("dialog", { name: /command palette/i })).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /command palette/i })).toBeNull();
      expect(document.activeElement).toBe(invoker);
    });
  });

  it("renders recent commands when local storage is seeded", async () => {
    window.localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(["/contracts"]));
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

  it("prunes hidden recent destinations when the current surface no longer allows them", async () => {
    window.localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(["/assurance", "/contracts"]));
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
    expect(screen.queryByRole("link", { name: /assurance/i })).toBeNull();

    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem(RECENT_COMMANDS_KEY) ?? "[]")).toEqual(["/contracts"]);
    });
  });

  it("emits debounced zero-results telemetry when no command matches", async () => {
    vi.useFakeTimers();
    renderWithProviders(
      <CommandPalette
        role="viewer"
        navSurface={coreSurface}
        v5Flags={{} as Record<FeatureFlagKey, boolean>}
      />
    );

    await act(async () => {
      openCommandPalette("zzzz-no-local-match");
    });

    await act(async () => {
      vi.advanceTimersByTime(700);
    });

    expect(telemetry.emitCmdkZeroResultsTelemetry).toHaveBeenCalledWith({ queryLen: 19 });
  });

  it("shows V10 recovery actions when remote command search fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
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
    expect(screen.getByRole("link", { name: "Review workspace health" }).getAttribute("href")).toBe("/settings/health");
    expect(telemetry.emitCmdkSearchFailedTelemetry).toHaveBeenCalledWith({ queryLen: 19 });
  });

  it("renders V10 recovery diagnostics from remote command search", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            contracts: [],
            recovery: {
              message: "No command result matched this query.",
              diagnosticId: "v10_command_zero_result",
              actions: [{ label: "Review work queue", href: "/work", reason: "zero_result" }],
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
    expect(screen.getByRole("link", { name: "Review work queue" }).getAttribute("href")).toBe("/work");
  });

  it("clears stale partial-search recovery copy when the query becomes too short for remote search", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            contracts: [],
            partial: {
              reason: "V10 command index could not load; contract matches are still available.",
              diagnosticId: "v10_command_index_partial",
            },
            recovery: {
              message: "Some indexed destinations are temporarily unavailable; direct destinations are still available.",
              diagnosticId: "v10_command_index_partial",
              actions: [{ label: "Review work queue", href: "/work", reason: "partial_index" }],
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
      openCommandPalette("zzzz-partial");
    });

    expect(await screen.findByText("Command search is partially available")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText(/search pages, queues, reports, tools/i), {
      target: { value: "a" },
    });

    await waitFor(() => {
      expect(screen.queryByText("Command search is partially available")).toBeNull();
      expect(screen.queryByText("Some indexed destinations are temporarily unavailable; direct destinations are still available.")).toBeNull();
    });
  });
});