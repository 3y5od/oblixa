import { getAuthContext } from "@/lib/supabase/server";
import { format } from "date-fns";
import Link from "next/link";
import { ProfileForm } from "@/components/settings/profile-form";
import { OrgForm } from "@/components/settings/org-form";
import { DemoSeedButton } from "@/components/settings/demo-seed-button";
import { InviteMemberForm } from "@/components/settings/invite-member-form";
import {
  PendingInvitesList,
  type PendingInviteRow,
} from "@/components/settings/pending-invites";
import type { OrganizationMember } from "@/lib/types";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { hasRoleCapability } from "@/lib/access-control";

export default async function SettingsPage() {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;

  const { user, orgId, admin } = ctx;

  const [
    { data: profile },
    { data: membership },
    { data: membersData },
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
        .select("id, organization_id, role, organizations(name)")
        .eq("user_id", user.id)
        .eq("organization_id", orgId)
        .limit(1)
        .single(),
      admin
        .from("organization_members")
        .select("id, organization_id, user_id, role, created_at, profiles(full_name, email)")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: true }),
      admin
        .from("organization_workflow_settings")
        .select("role_policy_json")
        .eq("organization_id", orgId)
        .maybeSingle(),
    ]);
  const canOpenHealth = hasRoleCapability({
    role: (membership?.role as OrganizationMember["role"] | null) ?? null,
    capability: "settings_manage",
    rolePolicyJson: (workflowSettings?.role_policy_json as Record<string, unknown> | null) ?? null,
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

  const roleLabels: Record<string, string> = {
    admin: "Admin",
    editor: "Editor",
    viewer: "Viewer",
    ops_manager: "Ops manager",
    legal_reviewer: "Legal reviewer",
    finance_reviewer: "Finance reviewer",
    manager: "Manager",
  };

  return (
    <div className="ui-page-stack mx-auto max-w-6xl">
      <header className="ui-page-header">
        <div className="min-w-0">
          <p className="ui-eyebrow">Workspace</p>
          <h1 className="ui-display-title mt-2">Settings</h1>
          <p className="ui-muted-tight mt-3 max-w-2xl">
            Profile, organization, team access, and operational controls for the workspace.
          </p>
        </div>
        <div className="ui-page-actions w-full shrink-0 justify-start pt-0">
          {canOpenHealth && (
            <Link href="/settings/health" className="ui-btn-secondary px-4 py-2 text-[13px]">
              System health
            </Link>
          )}
          <Link href="/settings/operations" className="ui-btn-secondary px-4 py-2 text-[13px]">
            Workflow configuration
          </Link>
          {membership?.role === "admin" ? (
            <Link href="/settings/product" className="ui-btn-secondary px-4 py-2 text-[13px]">
              Product experience
            </Link>
          ) : null}
          {membership?.role === "admin" ? (
            <Link href="/settings/policy" className="ui-btn-secondary px-4 py-2 text-[13px]">
              Policy registry
            </Link>
          ) : null}
          <a
            href="/api/export/calendar?role=legal"
            className="ui-btn-secondary px-4 py-2 text-[13px]"
            target="_blank"
            rel="noreferrer"
          >
            Legal calendar (.ics)
          </a>
          <a
            href="/api/export/calendar?role=finance"
            className="ui-btn-secondary px-4 py-2 text-[13px]"
            target="_blank"
            rel="noreferrer"
          >
            Finance calendar (.ics)
          </a>
        </div>
      </header>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-[var(--border-subtle)]/90 bg-[color:color-mix(in_oklab,var(--surface-muted)_52%,transparent)] px-6 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="ui-eyebrow">You</p>
              <h2 className="ui-section-title mt-1 text-base">Profile</h2>
            </div>
            <p className="shrink-0 text-[12px] text-[var(--text-secondary)] sm:pt-0.5 sm:text-right">
              Joined{" "}
              {user.created_at
                ? format(new Date(user.created_at), "MMM d, yyyy")
                : "—"}
            </p>
          </div>
        </div>
        <div className="p-6 md:p-8">
        <ProfileForm
          fullName={profile?.full_name ?? null}
          email={user.email || ""}
        />
        </div>
      </section>

      {membership && (
        <section className="ui-card overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-[var(--border-subtle)]/90 bg-[color:color-mix(in_oklab,var(--surface-muted)_52%,transparent)] px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="ui-eyebrow">Workspace</p>
              <h2 className="ui-section-title mt-1 text-base">Organization</h2>
            </div>
            <span className="inline-flex w-fit shrink-0 rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_84%,white)] px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              {roleLabels[membership.role] || membership.role}
            </span>
          </div>

          <div className="space-y-8 p-6 md:p-8">
            <OrgForm
              organizationId={membership.organization_id}
              name={orgName}
              isAdmin={membership.role === "admin"}
            />

            <div>
              <p className="ui-eyebrow">Access</p>
              <h3 className="ui-section-title mt-1 text-base">Team members</h3>
              <div className="ui-table-shell mt-4">
                <table className="min-w-full divide-y divide-[var(--border-subtle)]">
                  <thead className="bg-[color:color-mix(in_oklab,var(--surface-muted)_64%,transparent)]">
                    <tr>
                      <th className="ui-table-header px-4 py-3">
                        Name
                      </th>
                      <th className="ui-table-header px-4 py-3">Email</th>
                      <th className="ui-table-header px-4 py-3">Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200/70">
                    {members.map((m) => (
                      <tr key={m.id} className="ui-table-row">
                        <td className="px-4 py-2.5 text-sm font-medium text-[var(--text-primary)]">
                          {m.profiles?.full_name || "—"}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-[var(--text-secondary)]">
                          {m.profiles?.email || "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_64%,transparent)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
                            {roleLabels[m.role] || m.role}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          {membership.role === "admin" && (
            <>
              <InviteMemberForm organizationId={membership.organization_id} />
              <PendingInvitesList invites={pendingInvites} />
            </>
          )}

          {membership.role === "admin" && (
            <div className="mt-8 border-t border-[var(--border-subtle)] pt-6">
              <DemoSeedButton />
            </div>
          )}
          </div>
        </section>
      )}
    </div>
  );
}
