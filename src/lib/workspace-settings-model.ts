import { SETTINGS_DESTINATION_STRINGS, SETTINGS_GROUP_STRINGS } from "@/lib/settings/spec-strings";
import type { OrgRole } from "@/lib/types";

export type WorkspaceSettingsRole = OrgRole;

export type SettingsSectionKey =
  | "profile"
  | "workspace"
  | "team"
  | "billing"
  | "notifications"
  | "security"
  | "imports_exports"
  | "data_export";
export type SettingsDestinationGroupKey = "account" | "workspace" | "operations";
export type SettingsDestinationState = "available" | "read_only" | "unavailable";
export type SettingsDestinationSurfaceKind = "route" | "anchor" | "external" | "disclosure";
export type SettingsStatusTone = "neutral" | "attention" | "healthy";

export type SettingsDestination = {
  key: SettingsSectionKey;
  group: SettingsDestinationGroupKey;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  state: SettingsDestinationState;
  surfaceKind: SettingsDestinationSurfaceKind;
  currentStateLabel?: string;
  noteLabel?: string;
  statusLabel?: string;
  statusTone?: SettingsStatusTone;
  unavailableReason?: string;
  fallbackHref?: string;
  fallbackActionLabel?: string;
  requiredRole?: WorkspaceSettingsRole;
  requiredCapability?: "settings_manage";
};

export type SettingsDestinationGroup = {
  key: SettingsDestinationGroupKey;
  title: string;
  description: string;
  destinations: SettingsDestination[];
};

export type SettingsStatusItem = {
  key: string;
  label: string;
  value: string;
  impact: string;
  href: string;
  actionLabel: string;
  tone?: SettingsStatusTone;
};
export type SettingsStatusSummary = { items: SettingsStatusItem[] };

export type WorkspaceSettingsViewModel = {
  roleLabel: string;
  planLabel?: string;
  groups: SettingsDestinationGroup[];
  statusSummary: SettingsStatusSummary;
  canInviteMembers: boolean;
  canEditWorkspaceIdentity: boolean;
};

export const WORKSPACE_SETTINGS_ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
  ops_manager: "Ops manager",
  legal_reviewer: "Legal reviewer",
  finance_reviewer: "Finance reviewer",
  manager: "Manager",
};

type BaseDestination = Omit<SettingsDestination, "state" | "surfaceKind"> & {
  visibility?: "all" | "admin" | "settings";
};

const GROUP_META: Array<Omit<SettingsDestinationGroup, "destinations">> = [
  { key: "account", title: SETTINGS_GROUP_STRINGS.account, description: "" },
  { key: "workspace", title: SETTINGS_GROUP_STRINGS.workspace, description: "" },
  { key: "operations", title: SETTINGS_GROUP_STRINGS.operations, description: "" },
];

const BASE_DESTINATIONS: BaseDestination[] = [
  {
    key: "profile",
    group: "account",
    title: SETTINGS_DESTINATION_STRINGS.profile.title,
    description: SETTINGS_DESTINATION_STRINGS.profile.description,
    href: "#profile",
    actionLabel: SETTINGS_DESTINATION_STRINGS.profile.actionLabel,
    currentStateLabel: SETTINGS_DESTINATION_STRINGS.profile.currentStateLabel,
  },
  {
    key: "security",
    group: "account",
    title: SETTINGS_DESTINATION_STRINGS.security.title,
    description: SETTINGS_DESTINATION_STRINGS.security.description,
    href: "/settings/security",
    actionLabel: SETTINGS_DESTINATION_STRINGS.security.actionLabel,
    currentStateLabel: SETTINGS_DESTINATION_STRINGS.security.currentStateLabel,
  },
  {
    key: "workspace",
    group: "workspace",
    title: SETTINGS_DESTINATION_STRINGS.workspace.title,
    description: SETTINGS_DESTINATION_STRINGS.workspace.description,
    href: "#workspace-identity",
    actionLabel: SETTINGS_DESTINATION_STRINGS.workspace.actionLabel,
    requiredRole: "admin",
  },
  {
    key: "team",
    group: "workspace",
    title: SETTINGS_DESTINATION_STRINGS.team.title,
    description: SETTINGS_DESTINATION_STRINGS.team.description,
    href: "#team-access",
    actionLabel: SETTINGS_DESTINATION_STRINGS.team.actionLabel,
    requiredRole: "admin",
  },
  {
    key: "billing",
    group: "workspace",
    title: SETTINGS_DESTINATION_STRINGS.billing.title,
    description: SETTINGS_DESTINATION_STRINGS.billing.description,
    href: "/settings/billing",
    actionLabel: SETTINGS_DESTINATION_STRINGS.billing.actionLabel,
    requiredRole: "admin",
  },
  {
    key: "notifications",
    group: "operations",
    title: SETTINGS_DESTINATION_STRINGS.notifications.title,
    description: SETTINGS_DESTINATION_STRINGS.notifications.description,
    href: "/settings/operations#notifications",
    actionLabel: SETTINGS_DESTINATION_STRINGS.notifications.actionLabel,
    currentStateLabel: SETTINGS_DESTINATION_STRINGS.notifications.currentStateLabel,
    visibility: "settings",
    requiredCapability: "settings_manage",
  },
  {
    key: "imports_exports",
    group: "operations",
    title: SETTINGS_DESTINATION_STRINGS.imports_exports.title,
    description: SETTINGS_DESTINATION_STRINGS.imports_exports.description,
    href: "/contracts/bulk",
    actionLabel: SETTINGS_DESTINATION_STRINGS.imports_exports.actionLabel,
    currentStateLabel: SETTINGS_DESTINATION_STRINGS.imports_exports.currentStateLabel,
  },
  {
    key: "data_export",
    group: "operations",
    title: SETTINGS_DESTINATION_STRINGS.data_export.title,
    description: SETTINGS_DESTINATION_STRINGS.data_export.description,
    href: "/reports?report=contract_inventory",
    actionLabel: SETTINGS_DESTINATION_STRINGS.data_export.actionLabel,
    currentStateLabel: SETTINGS_DESTINATION_STRINGS.data_export.currentStateLabel,
  },
];

function surfaceKind(href: string): SettingsDestinationSurfaceKind {
  if (href.startsWith("/api/")) return "external";
  if (href.startsWith("#")) return "anchor";
  return "route";
}

function destinationState(
  dest: BaseDestination,
  input: { role: WorkspaceSettingsRole | null; canManageSettings: boolean }
): SettingsDestinationState | "hidden" {
  if (dest.visibility === "settings" && !input.canManageSettings) return "read_only";
  if (dest.requiredRole === "admin" && input.role !== "admin") return "read_only";
  return "available";
}

function destinationCurrentStateLabel(
  dest: BaseDestination,
  input: { role: WorkspaceSettingsRole | null; memberCount: number; pendingInviteCount: number; planLabel?: string | null }
) {
  if (dest.key === "workspace") {
    return input.role === "admin"
      ? SETTINGS_DESTINATION_STRINGS.workspace.currentStateLabel
      : SETTINGS_DESTINATION_STRINGS.workspace.readOnlyLabel;
  }
  if (dest.key === "team") {
    return `${input.memberCount} member${input.memberCount === 1 ? "" : "s"}${
      input.pendingInviteCount > 0 ? ` · ${input.pendingInviteCount} pending` : ""
    }`;
  }
  if (dest.key === "billing") {
    return input.planLabel && input.planLabel !== "No plan" ? input.planLabel : "Free";
  }
  return dest.currentStateLabel;
}

function buildDestination(
  dest: BaseDestination,
  input: {
    role: WorkspaceSettingsRole | null;
    canManageSettings: boolean;
    memberCount: number;
    pendingInviteCount: number;
    planLabel?: string | null;
  }
): SettingsDestination | null {
  const state = destinationState(dest, input);
  if (state === "hidden") return null;
  const unavailableReason =
    state === "read_only"
      ? dest.key === "notifications"
        ? "Ask a workspace admin to change notification defaults."
        : "Only admins can change this setting."
      : undefined;
  return {
    ...dest,
    state,
    surfaceKind: surfaceKind(dest.href),
    currentStateLabel: destinationCurrentStateLabel(dest, input),
    noteLabel: unavailableReason,
    statusLabel: dest.key === "team" && input.pendingInviteCount > 0 ? `${input.pendingInviteCount} pending` : undefined,
    statusTone: dest.key === "team" && input.pendingInviteCount > 0 ? "attention" : undefined,
    unavailableReason,
  };
}

function attentionItems(input: {
  role: WorkspaceSettingsRole | null;
  pendingInviteCount: number;
  planBlockKnown?: boolean;
}) {
  const items: SettingsStatusItem[] = [];
  if (input.role === "admin" && input.pendingInviteCount > 0) {
    items.push({
      key: "invites",
      label: "Pending invites",
      value: String(input.pendingInviteCount),
      impact: "Team access is waiting on invite acceptance.",
      href: "#team-access",
      actionLabel: "View invites",
      tone: "attention",
    });
  }
  if (input.planBlockKnown) {
    items.push({
      key: "plan",
      label: "Plan required",
      value: "Billing attention",
      impact: "Billing setup is required for the current plan policy.",
      href: "/settings/billing",
      actionLabel: "Open billing",
      tone: "attention",
    });
  }
  return items;
}

export function buildWorkspaceSettingsViewModel(input: {
  role: WorkspaceSettingsRole | null;
  canManageSettings: boolean;
  memberCount: number;
  pendingInviteCount: number;
  planLabel?: string | null;
  planBlockKnown?: boolean;
}): WorkspaceSettingsViewModel {
  const destinations = BASE_DESTINATIONS
    .map((dest) => buildDestination(dest, input))
    .filter((dest): dest is SettingsDestination => Boolean(dest));
  const groups = GROUP_META.map((group) => ({
    ...group,
    destinations: destinations.filter((dest) => dest.group === group.key),
  })).filter((group) => group.destinations.length > 0);

  return {
    roleLabel: input.role ? WORKSPACE_SETTINGS_ROLE_LABELS[input.role] ?? input.role : "Unknown",
    planLabel: input.planLabel ?? undefined,
    groups,
    statusSummary: { items: attentionItems(input) },
    canInviteMembers: input.role === "admin",
    canEditWorkspaceIdentity: input.role === "admin",
  };
}
