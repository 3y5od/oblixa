import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SETTINGS_PAGE = join(process.cwd(), "src/app/(dashboard)/settings/page.tsx");
const SETTINGS_SECTIONS = join(process.cwd(), "src/app/(dashboard)/settings/settings-page-sections.tsx");
const SETTINGS_ANCHOR_LINK = join(process.cwd(), "src/app/(dashboard)/settings/settings-anchor-link.tsx");
const SETTINGS_BILLING = join(process.cwd(), "src/app/(dashboard)/settings/billing/page.tsx");
const SETTINGS_SECURITY = join(process.cwd(), "src/app/(dashboard)/settings/security/page.tsx");
const SETTINGS_OPERATIONS = join(process.cwd(), "src/app/(dashboard)/settings/operations/page.tsx");
const SETTINGS_OPERATIONS_VIEW = join(process.cwd(), "src/app/(dashboard)/settings/operations/operations-settings-view.tsx");
const SETTINGS_MODEL = join(process.cwd(), "src/lib/workspace-settings-model.ts");
const SETTINGS_STRINGS = join(process.cwd(), "src/lib/settings/spec-strings.ts");

function readPublicSettingsSource() {
  return [
    SETTINGS_PAGE,
    SETTINGS_SECTIONS,
    SETTINGS_BILLING,
    SETTINGS_SECURITY,
    SETTINGS_OPERATIONS,
    SETTINGS_OPERATIONS_VIEW,
    SETTINGS_MODEL,
    SETTINGS_STRINGS,
  ]
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
}

describe("settings page release-state compliance", () => {
  it("renders the release-state Settings page header and directory model", () => {
    const page = readFileSync(SETTINGS_PAGE, "utf8");
    expect(page).toContain("SETTINGS_PAGE_STRINGS.eyebrow");
    expect(page).toContain("SETTINGS_PAGE_STRINGS.title");
    expect(page).toContain("SETTINGS_PAGE_STRINGS.lead");
    expect(page).toContain("<SettingsDirectory groups={viewModel.groups} />");
    expect(page).toContain("<SettingsAttentionSummary summary={viewModel.statusSummary} />");
  });

  it("centralizes public Settings labels in source constants", () => {
    const raw = readFileSync(SETTINGS_STRINGS, "utf8");
    for (const phrase of [
      "Settings",
      "Manage workspace, team, billing, notifications, security, and export settings.",
      "Profile",
      "Workspace",
      "Team",
      "Billing",
      "Notifications",
      "Security",
      "Imports and exports",
      "Data export",
    ]) {
      expect(raw).toContain(phrase);
    }
  });

  it("keeps the directory as grouped release-state rows", () => {
    const model = readFileSync(SETTINGS_MODEL, "utf8");
    const sections = readFileSync(SETTINGS_SECTIONS, "utf8");
    expect(model).toContain('key: "account"');
    expect(model).toContain('key: "workspace"');
    expect(model).toContain('key: "operations"');
    expect(sections).toContain("group.destinations.map");
    expect(sections).toContain("destination.title");
    expect(sections).toContain("destination.currentStateLabel");
    expect(sections).toContain("destination.noteLabel ?? destination.unavailableReason ?? destination.description");
    expect(sections).toContain("<DestinationAction");
  });

  it("does not expose product complexity in public Core Settings", () => {
    const raw = readPublicSettingsSource();
    for (const forbidden of [
      "Product experience",
      "Change mode",
      "Module visibility",
      "Edit modules",
      "Feature eligibility",
      "Check eligibility",
      "Policy registry",
      "Edit policy registry",
      "Assurance controls",
      "Autopilot",
      "System health",
      "Operational audit events",
      "Report subscriptions",
      "Legal calendar",
      "Finance calendar",
      "Subscribe to legal calendar",
      "Subscribe to finance calendar",
      "Workspace setup tools",
      "workspace-mode-eligibility",
      "Core workspace. Advanced controls are unavailable.",
      "/settings/product",
      "/settings/policy",
      "/settings/health#recent-operational-events",
      "/contracts/reports#subscriptions",
    ]) {
      expect(raw).not.toContain(forbidden);
    }
  });

  it("keeps release-state forms and anchors for editable same-page sections", () => {
    const sections = readFileSync(SETTINGS_SECTIONS, "utf8");
    for (const component of ["ProfileForm", "OrgForm", "InviteMemberForm", "PendingInvitesList"]) {
      expect(sections).toContain(component);
    }
    for (const id of ["workspace-identity", "team-access", "profile"]) {
      expect(sections).toContain(`id="${id}"`);
    }
    expect(sections).not.toContain("DemoSeedButton");
  });

  it("keeps public Settings routes free of documentation runtime dependencies and landing decoration", () => {
    const raw = readPublicSettingsSource();
    const runtimeSource = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(runtimeSource).not.toMatch(/from\s+["'][^"']*docs\//);
    expect(runtimeSource).not.toMatch(/readFileSync\([^)]*\.md/);
    expect(runtimeSource).not.toContain(".md");
    expect(runtimeSource).not.toContain("landing-corner-ring");
    expect(runtimeSource).not.toContain("landing-eyebrow-dot");
    expect(runtimeSource).not.toContain("ui-page-header");
    expect(runtimeSource).not.toContain("w-fit");
  });

  it("uses native anchors and scroll margins for same-page settings links", () => {
    const sections = readFileSync(SETTINGS_SECTIONS, "utf8");
    const anchorLink = readFileSync(SETTINGS_ANCHOR_LINK, "utf8");
    expect(sections).toContain('destination.href.startsWith("#")');
    expect(sections).toContain("SettingsAnchorLink");
    expect(sections).toContain("scroll-mt-6");
    expect(anchorLink).toContain("MAIN_CONTENT_ID");
    expect(anchorLink).toContain("main.scrollTo");
    expect(anchorLink).toContain("replaceState");
  });
});
