import { describe, expect, it } from "vitest";
import { buildWorkspaceSettingsViewModel } from "@/lib/workspace-settings-model";

function adminSettings() {
  return buildWorkspaceSettingsViewModel({
    role: "admin",
    canManageSettings: true,
    memberCount: 4,
    pendingInviteCount: 2,
    planLabel: "No plan",
  });
}

describe("workspace settings model", () => {
  it("emits the release-state settings groups in fixed order", () => {
    expect(adminSettings().groups.map((group) => group.title)).toEqual([
      "Account",
      "Workspace",
      "Operations",
    ]);
  });

  it("emits only public Core settings destinations", () => {
    const titles = adminSettings().groups.flatMap((group) => group.destinations.map((dest) => dest.title));
    expect(titles).toEqual([
      "Profile",
      "Security",
      "Workspace",
      "Team",
      "Billing",
      "Notifications",
      "Imports and exports",
      "Data export",
    ]);
    for (const forbidden of [
      "Product experience",
      "Module visibility",
      "Feature eligibility",
      "Policy registry",
      "Assurance controls",
      "System health",
      "Operational audit events",
      "Legal calendar",
      "Finance calendar",
      "Report subscriptions",
      "API access",
    ]) {
      expect(titles).not.toContain(forbidden);
    }
  });

  it("uses release-state destinations and actions", () => {
    const destinations = adminSettings().groups.flatMap((group) => group.destinations);
    expect(destinations.find((dest) => dest.key === "profile")).toMatchObject({
      href: "#profile",
      actionLabel: "Edit profile",
    });
    expect(destinations.find((dest) => dest.key === "workspace")).toMatchObject({
      href: "#workspace-identity",
      actionLabel: "Rename",
    });
    expect(destinations.find((dest) => dest.key === "team")).toMatchObject({
      href: "#team-access",
      actionLabel: "Invite member",
      currentStateLabel: "4 members · 2 pending",
    });
    expect(destinations.find((dest) => dest.key === "notifications")).toMatchObject({
      href: "/settings/operations#notifications",
      actionLabel: "Edit notifications",
    });
    expect(destinations.find((dest) => dest.key === "imports_exports")).toMatchObject({
      href: "/contracts/bulk",
      actionLabel: "Open imports",
    });
    expect(destinations.find((dest) => dest.key === "data_export")).toMatchObject({
      href: "/reports?report=contract_inventory",
      actionLabel: "Export data",
    });
  });

  it("marks admin-only workspace rows read-only for non-admins without hiding the directory", () => {
    const vm = buildWorkspaceSettingsViewModel({
      role: "viewer",
      canManageSettings: false,
      memberCount: 1,
      pendingInviteCount: 0,
      planLabel: "No plan",
    });
    const destinations = vm.groups.flatMap((group) => group.destinations);
    expect(destinations.find((dest) => dest.key === "workspace")).toMatchObject({
      state: "read_only",
      unavailableReason: "Only admins can change this setting.",
    });
    expect(destinations.find((dest) => dest.key === "team")).toMatchObject({ state: "read_only" });
    expect(destinations.find((dest) => dest.key === "billing")).toMatchObject({ state: "read_only" });
    expect(destinations.find((dest) => dest.key === "notifications")).toMatchObject({
      state: "read_only",
      unavailableReason: "Ask a workspace admin to change notification defaults.",
    });
    expect(vm.canInviteMembers).toBe(false);
    expect(vm.canEditWorkspaceIdentity).toBe(false);
  });

  it("surfaces only release-state attention items", () => {
    const vm = buildWorkspaceSettingsViewModel({
      role: "admin",
      canManageSettings: true,
      memberCount: 1,
      pendingInviteCount: 1,
      planBlockKnown: true,
    });
    expect(vm.statusSummary.items.map((item) => item.key)).toEqual(["invites", "plan"]);
  });

  it("does not expose workspace-mode, demo, calendar, or API-access public state", () => {
    const vm = buildWorkspaceSettingsViewModel({
      role: "admin",
      canManageSettings: true,
      memberCount: 1,
      pendingInviteCount: 0,
    });
    const raw = JSON.stringify(vm);
    expect(raw).not.toMatch(/workspace mode|Core workspace|Advanced controls|Assurance controls|demo|calendar|API access/i);
  });
});
