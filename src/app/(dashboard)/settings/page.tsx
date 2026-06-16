import { getAuthContext } from "@/lib/supabase/server";
import { SettingsWorkbench, SettingsStateStrip } from "@/components/settings/settings-workbench";
import { type PendingInviteRow } from "@/components/settings/pending-invites";
import type { OrganizationMember } from "@/lib/types";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { hasRoleCapability } from "@/lib/access-control";
import { loadOrgMemberProfileRows } from "@/lib/org-member-profiles";
import { isPlanEnforcementEnabled } from "@/lib/plan";
import { SETTINGS_PAGE_STRINGS } from "@/lib/settings/spec-strings";
import {
  AccessManagementSection,
  ProfileSettingsSection,
  SettingsAttentionSummary,
  SettingsDirectory,
  SettingsSnapshot,
  WorkspaceIdentitySection,
} from "./settings-page-sections";
import {
  buildWorkspaceSettingsViewModel,
  WORKSPACE_SETTINGS_ROLE_LABELS,
} from "@/lib/workspace-settings-model";

export const metadata = { title: SETTINGS_PAGE_STRINGS.title };

export default async function SettingsPage() {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;

  const { user, orgId, admin } = ctx;

  const [
    { data: profile },
    { data: membership },
    membersData,
    { data: workflowSettings },
  ] =
    await Promise.all([
      admin
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single(),
      admin
        .from("organization_members")
        .select("id, organization_id, role, organizations(name, owner_user_id, stripe_subscription_id, stripe_subscription_status)")
        .eq("user_id", user.id)
        .eq("organization_id", orgId)
        .limit(1)
        .single(),
      loadOrgMemberProfileRows(admin, orgId, {
        memberColumns: "id, organization_id, user_id, role, created_at",
        orderByCreatedAt: true,
      }),
      admin
        .from("organization_workflow_settings")
        .select("role_policy_json")
        .eq("organization_id", orgId)
        .maybeSingle(),
    ]);
  const rolePolicyJson = (workflowSettings?.role_policy_json as Record<string, unknown> | null) ?? null;
  const effectiveRole = (membership?.role as OrganizationMember["role"] | null) ?? null;
  const canManageSettings = hasRoleCapability({
    role: (membership?.role as OrganizationMember["role"] | null) ?? null,
    capability: "settings_manage",
    rolePolicyJson,
  });

  const members = (membersData ?? []) as unknown as OrganizationMember[];

  let pendingInvites: PendingInviteRow[] = [];
  const org = (membership as OrganizationMember & {
    organizations?: {
      name?: string | null;
      owner_user_id?: string | null;
      stripe_subscription_id?: string | null;
      stripe_subscription_status?: string | null;
    } | null;
  } | null)?.organizations ?? null;
  const isWorkspaceOwner = org?.owner_user_id === user.id;

  if (membership && (membership.role === "admin" || isWorkspaceOwner)) {
    const { data: invData } = await admin
      .from("organization_invites")
      .select("id, email, role, expires_at, created_at")
      .eq("organization_id", orgId)
      .is("consumed_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    pendingInvites = (invData ?? []) as PendingInviteRow[];
  }

  const orgName = org?.name || "";
  const orgBilling = org;
  const planLabel = orgBilling?.stripe_subscription_id
    ? orgBilling.stripe_subscription_status
      ? orgBilling.stripe_subscription_status.replace(/_/g, " ")
      : "Active"
    : "No plan";
  const planBlockKnown = isPlanEnforcementEnabled() && !orgBilling?.stripe_subscription_id;
  const viewModel = buildWorkspaceSettingsViewModel({
    role: effectiveRole,
    canManageSettings,
    memberCount: members.length,
    pendingInviteCount: pendingInvites.length,
    planLabel,
    planBlockKnown,
    isWorkspaceOwner,
  });

  const isWorkspaceAdmin = membership?.role === "admin" || isWorkspaceOwner;

  // Header context row (§59) — which workspace, the viewer's role, and which
  // account. Operational counts (members / invites / billing) live in the
  // Workspace administration band below so the same fact is never doubled (§19).
  const contextItems = membership
    ? [
        ...(orgName ? [{ label: "Workspace", value: orgName }] : []),
        { label: "Workspace role", value: viewModel.roleLabel },
        ...(user.email
          ? [
              {
                label: "Account",
                value: <span className="font-mono text-[12px]">{user.email}</span>,
              },
            ]
          : []),
      ]
    : user.email
      ? [{ label: "Account", value: <span className="font-mono text-[12px]">{user.email}</span> }]
      : [];

  return (
    <SettingsWorkbench
      active="overview"
      eyebrow={SETTINGS_PAGE_STRINGS.eyebrow}
      title={SETTINGS_PAGE_STRINGS.title}
      lead={SETTINGS_PAGE_STRINGS.lead}
      stateStrip={contextItems.length > 0 ? <SettingsStateStrip items={contextItems} /> : undefined}
    >
      {membership ? (
        <SettingsSnapshot
          memberCount={members.length}
          pendingInviteCount={pendingInvites.length}
          billingLabel={viewModel.billingLabel}
          billingTone={viewModel.billingTone}
          billingHref={isWorkspaceAdmin ? "/settings/billing" : undefined}
        />
      ) : null}
      <SettingsAttentionSummary summary={viewModel.statusSummary} />
      <SettingsDirectory groups={viewModel.groups} />

      {membership ? (
        <div className="flex flex-col gap-5">
          {/* §10.17 — the two compact identity editors sit side by side so
              neither is half-empty at full width; the Team access ledger spans
              full width below. `lg:items-start` keeps the shorter workspace card
              from stretching to match Profile. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
            <WorkspaceIdentitySection
              organizationId={membership.organization_id}
              orgName={orgName}
              isAdmin={viewModel.canEditWorkspaceIdentity}
            />
            <ProfileSettingsSection
              fullName={profile?.full_name ?? null}
              email={user.email || ""}
              joinedAt={user.created_at}
            />
          </div>
          <AccessManagementSection
            members={members}
            organizationId={membership.organization_id}
            roleLabels={WORKSPACE_SETTINGS_ROLE_LABELS}
            canInvite={viewModel.canInviteMembers}
            pendingInvites={pendingInvites}
            currentUserId={user.id}
            ownerUserId={org?.owner_user_id ?? null}
            canManageMembers={isWorkspaceAdmin}
          />
        </div>
      ) : (
        <ProfileSettingsSection
          fullName={profile?.full_name ?? null}
          email={user.email || ""}
          joinedAt={user.created_at}
        />
      )}
    </SettingsWorkbench>
  );
}
