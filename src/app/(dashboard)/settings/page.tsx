import { Settings } from "lucide-react";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { getAuthContext } from "@/lib/supabase/server";
import { type PendingInviteRow } from "@/components/settings/pending-invites";
import type { OrganizationMember } from "@/lib/types";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { hasRoleCapability } from "@/lib/access-control";
import { loadOrgMemberProfileRows } from "@/lib/org-member-profiles";
import { isPlanEnforcementEnabled } from "@/lib/plan";
import { SETTINGS_PAGE_STRINGS } from "@/lib/settings/spec-strings";
import { KeyValueChip } from "@/components/ui/key-value-chip";
import {
  AccessManagementSection,
  ProfileSettingsSection,
  SettingsAttentionSummary,
  SettingsDirectory,
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
        .select("id, organization_id, role, organizations(name, stripe_subscription_id, stripe_subscription_status)")
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
  if (membership && membership.role === "admin") {
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

  const orgName =
    (membership as OrganizationMember & { organizations: { name: string } } | null)
      ?.organizations?.name || "";
  const orgBilling = (membership as OrganizationMember & { organizations: { stripe_subscription_id?: string | null; stripe_subscription_status?: string | null } } | null)?.organizations;
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
  });

  return (
    <div className="ui-page-stack mx-auto max-w-6xl gap-4">
      <DashboardPageHeader
        icon={<Settings className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow={SETTINGS_PAGE_STRINGS.eyebrow}
        title={SETTINGS_PAGE_STRINGS.title}
        lead={SETTINGS_PAGE_STRINGS.lead}
        actions={
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <KeyValueChip label="Role" value={viewModel.roleLabel} />
            {viewModel.planLabel ? (
              <KeyValueChip
                label="Plan"
                value={viewModel.planLabel === "No plan" ? "Free" : viewModel.planLabel}
              />
            ) : null}
          </div>
        }
      />

      <SettingsAttentionSummary summary={viewModel.statusSummary} />
      <SettingsDirectory groups={viewModel.groups} />

      {membership && (
        <>
          <WorkspaceIdentitySection
            organizationId={membership.organization_id}
            orgName={orgName}
            roleLabel={viewModel.roleLabel}
            isAdmin={viewModel.canEditWorkspaceIdentity}
          />
          <AccessManagementSection
            members={members}
            organizationId={membership.organization_id}
            roleLabels={WORKSPACE_SETTINGS_ROLE_LABELS}
            canInvite={viewModel.canInviteMembers}
            pendingInvites={pendingInvites}
          />
        </>
      )}

      <ProfileSettingsSection fullName={profile?.full_name ?? null} email={user.email || ""} joinedAt={user.created_at} />
    </div>
  );
}
