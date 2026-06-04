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
    <div className="ui-page-stack mx-auto w-full max-w-5xl gap-4">
      <DashboardPageHeader
        icon={<Settings className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow={SETTINGS_PAGE_STRINGS.eyebrow}
        title={SETTINGS_PAGE_STRINGS.title}
        lead={SETTINGS_PAGE_STRINGS.lead}
      />

      <SettingsAttentionSummary summary={viewModel.statusSummary} />
      <SettingsDirectory groups={viewModel.groups} />

      {membership ? (
        // IA transition — the Directory above jumps to dedicated settings
        // areas; the cards below edit workspace / account / team inline. The
        // top hairline + caps eyebrow (not a heading, to keep the h1→h2
        // hierarchy clean) marks the shift so the two no longer read as one
        // competing surface.
        <div className="flex flex-col gap-4 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] pt-5">
          <div className="flex flex-col gap-1">
            <p className="ui-caps-1 text-[11px] text-[var(--text-tertiary)]">Workspace &amp; account</p>
            <p className="text-[12.5px] leading-snug text-[var(--text-secondary)]">
              Edit these directly — changes apply to your workspace right away.
            </p>
          </div>
          {/* §10.17 + §10.18 — pair the two compact identity editors side by
              side so neither sits half-empty at full width, then let the dense
              Team access ledger span full width below. `lg:items-start` keeps
              the shorter workspace card from stretching to match Profile. */}
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
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] pt-5">
          <div className="flex flex-col gap-1">
            <p className="ui-caps-1 text-[11px] text-[var(--text-tertiary)]">Your account</p>
            <p className="text-[12.5px] leading-snug text-[var(--text-secondary)]">
              Update how your name appears across workspace activity.
            </p>
          </div>
          <ProfileSettingsSection
            fullName={profile?.full_name ?? null}
            email={user.email || ""}
            joinedAt={user.created_at}
          />
        </div>
      )}
    </div>
  );
}
