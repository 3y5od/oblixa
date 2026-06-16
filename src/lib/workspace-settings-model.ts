import {
  SETTINGS_DESTINATION_STRINGS,
  SETTINGS_GROUP_STRINGS,
  SETTINGS_OPERATIONS_TRUST_NOTE,
} from "@/lib/settings/spec-strings";
import type { OrgRole } from "@/lib/types";
import {
  canInviteWorkspaceMembers,
  canManageWorkspaceSettings,
  canonicalRoleLabel,
  isWorkspaceAdminRole,
} from "@/lib/roles";

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
  groups: SettingsDestinationGroup[];
  statusSummary: SettingsStatusSummary;
  canInviteMembers: boolean;
  canEditWorkspaceIdentity: boolean;
  billingLabel: string;
  billingTone: SettingsStatusTone;
};

// Maps the page's raw plan label into a canonical access/billing state phrase
// (release-state Billing And Access State Matrix). A workspace with no active
// subscription is in "Approved access", not a pricing tier or a pending review.
// Trialing is provider-recovery only and never surfaced as a trial.
export function billingAccessLabel(planLabel?: string | null): {
  label: string;
  tone: SettingsStatusTone;
} {
  const raw = (planLabel ?? "").trim().toLowerCase();
  if (!raw || raw === "no plan") return { label: "Approved access", tone: "neutral" };
  if (raw === "trialing") return { label: "Approved access", tone: "neutral" };
  if (raw === "active" || raw === "active paid") return { label: "Active paid", tone: "neutral" };
  if (raw === "past due" || raw === "past_due") return { label: "Past due", tone: "attention" };
  if (raw === "canceled" || raw === "cancelled") return { label: "Canceled", tone: "attention" };
  if (raw === "unpaid") return { label: "Unpaid", tone: "attention" };
  if (raw === "provider unavailable") return { label: "Provider unavailable", tone: "attention" };
  // Humanize any other provider status (already underscore-stripped upstream).
  return { label: raw.replace(/\b\w/g, (c) => c.toUpperCase()), tone: "neutral" };
}

export const WORKSPACE_SETTINGS_ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Member",
  member: "Member",
  viewer: "Viewer",
  ops_manager: "Member",
  legal_reviewer: "Member",
  finance_reviewer: "Member",
  manager: "Member",
};

type BaseDestination = Omit<SettingsDestination, "state" | "surfaceKind"> & {
  visibility?: "all" | "admin" | "settings";
};

const GROUP_META: Array<Omit<SettingsDestinationGroup, "destinations">> = [
  { key: "account", title: SETTINGS_GROUP_STRINGS.account, description: "" },
  // Workspace name + team are edited inline in their own cards below, so this
  // group only links to Billing. The inline "Workspace and account" section
  // header below makes that split clear, so no per-group explainer prose is
  // needed here (it previously read as loose text under the row).
  { key: "workspace", title: SETTINGS_GROUP_STRINGS.workspace, description: "" },
  // Export scope is disclosed at the point of risk (design §20).
  { key: "operations", title: SETTINGS_GROUP_STRINGS.operations, description: SETTINGS_OPERATIONS_TRUST_NOTE },
];

// IA: the directory is the full index of settings areas. Account-and-profile,
// Workspace identity, and Team access are edited inline in their own panels on
// /settings, so their rows are anchor jump-links into those panels; the
// remaining rows open dedicated pages. Each row carries a current-state value so
// the index reads as an administrative overview, not a bare link list.
const BASE_DESTINATIONS: BaseDestination[] = [
  {
    key: "profile",
    group: "account",
    title: SETTINGS_DESTINATION_STRINGS.profile.title,
    description: SETTINGS_DESTINATION_STRINGS.profile.description,
    href: "#profile",
    actionLabel: SETTINGS_DESTINATION_STRINGS.profile.actionLabel,
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
  },
  {
    key: "team",
    group: "workspace",
    title: SETTINGS_DESTINATION_STRINGS.team.title,
    description: SETTINGS_DESTINATION_STRINGS.team.description,
    href: "#team-access",
    actionLabel: SETTINGS_DESTINATION_STRINGS.team.actionLabel,
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
  input: { role: WorkspaceSettingsRole | null; canManageSettings: boolean; isWorkspaceOwner?: boolean }
): SettingsDestinationState | "hidden" {
  if (dest.visibility === "settings" && !input.canManageSettings) return "read_only";
  if (dest.requiredRole === "admin" && !isWorkspaceAdminRole(input.role, input)) return "read_only";
  return "available";
}

function destinationCurrentStateLabel(
  dest: BaseDestination,
  input: {
    role: WorkspaceSettingsRole | null;
    memberCount: number;
    pendingInviteCount: number;
    planLabel?: string | null;
    isWorkspaceOwner?: boolean;
  }
) {
  if (dest.key === "workspace") {
    return isWorkspaceAdminRole(input.role, input)
      ? SETTINGS_DESTINATION_STRINGS.workspace.currentStateLabel
      : SETTINGS_DESTINATION_STRINGS.workspace.readOnlyLabel;
  }
  if (dest.key === "team") {
    return `${input.memberCount} member${input.memberCount === 1 ? "" : "s"}${
      input.pendingInviteCount > 0 ? ` · ${input.pendingInviteCount} pending` : ""
    }`;
  }
  if (dest.key === "billing") {
    // Access-status framing, not a pricing tier: a workspace with no Stripe
    // subscription is in approved access, not on a "Free" plan or pending
    // review. Provider statuses are mapped to canonical billing-state phrases.
    return billingAccessLabel(input.planLabel).label;
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
    isWorkspaceOwner?: boolean;
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
  const billingTone = dest.key === "billing" ? billingAccessLabel(input.planLabel).tone : undefined;
  return {
    ...dest,
    state,
    surfaceKind: surfaceKind(dest.href),
    currentStateLabel: destinationCurrentStateLabel(dest, input),
    noteLabel: unavailableReason,
    statusLabel: dest.key === "team" && input.pendingInviteCount > 0 ? `${input.pendingInviteCount} pending` : undefined,
    statusTone:
      dest.key === "team" && input.pendingInviteCount > 0
        ? "attention"
        : billingTone && billingTone !== "neutral"
          ? billingTone
          : undefined,
    unavailableReason,
  };
}

function attentionItems(input: {
  role: WorkspaceSettingsRole | null;
  pendingInviteCount: number;
  planBlockKnown?: boolean;
  isWorkspaceOwner?: boolean;
}) {
  const items: SettingsStatusItem[] = [];
  if (isWorkspaceAdminRole(input.role, input) && input.pendingInviteCount > 0) {
    items.push({
      key: "invites",
      label: "Pending invites",
      value: String(input.pendingInviteCount),
      impact: "Team access needs invite acceptance.",
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
  isWorkspaceOwner?: boolean;
}): WorkspaceSettingsViewModel {
  const destinations = BASE_DESTINATIONS
    .map((dest) => buildDestination(dest, input))
    .filter((dest): dest is SettingsDestination => Boolean(dest));
  const groups = GROUP_META.map((group) => ({
    ...group,
    destinations: destinations.filter((dest) => dest.group === group.key),
  })).filter((group) => group.destinations.length > 0);

  const billing = billingAccessLabel(input.planLabel);
  return {
    roleLabel: canonicalRoleLabel(input.role, { isWorkspaceOwner: input.isWorkspaceOwner }),
    groups,
    statusSummary: { items: attentionItems(input) },
    canInviteMembers: canInviteWorkspaceMembers(input.role, input),
    canEditWorkspaceIdentity: canManageWorkspaceSettings(input.role, input),
    billingLabel: billing.label,
    billingTone: billing.tone,
  };
}
