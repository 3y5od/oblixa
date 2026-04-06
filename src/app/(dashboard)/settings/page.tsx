import { getAuthContext } from "@/lib/supabase/server";
import { format } from "date-fns";
import { ProfileForm } from "@/components/settings/profile-form";
import { OrgForm } from "@/components/settings/org-form";
import { DemoSeedButton } from "@/components/settings/demo-seed-button";
import { InviteMemberForm } from "@/components/settings/invite-member-form";
import {
  PendingInvitesList,
  type PendingInviteRow,
} from "@/components/settings/pending-invites";
import type { OrganizationMember } from "@/lib/types";

export default async function SettingsPage() {
  const ctx = await getAuthContext();
  if (!ctx) return null;

  const { user, orgId, admin } = ctx;

  const [{ data: profile }, { data: membership }, { data: membersData }] =
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
    ]);

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
  };

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header className="border-b border-zinc-200/60 pb-8">
        <p className="ui-eyebrow">Workspace</p>
        <h1 className="ui-display-title mt-2">Settings</h1>
        <p className="ui-muted mt-3">
          Profile, organization, and team access for your workspace.
        </p>
      </header>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-zinc-100/90 bg-zinc-50/40 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="ui-section-title text-base">Profile</h2>
            <p className="text-[12px] text-zinc-400">
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
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100/90 bg-zinc-50/40 px-6 py-4">
            <h2 className="ui-section-title text-base">Organization</h2>
            <span className="inline-flex rounded-full border border-zinc-200/80 bg-white px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-700">
              {roleLabels[membership.role] || membership.role}
            </span>
          </div>

          <div className="p-6 md:p-8">
          <div className="mb-8">
            <OrgForm
              organizationId={membership.organization_id}
              name={orgName}
              isAdmin={membership.role === "admin"}
            />
          </div>

          <h3 className="mb-3 text-sm font-bold tracking-tight text-zinc-900">
            Team members
          </h3>
          <div className="overflow-hidden rounded-xl border border-zinc-200/90">
            <table className="min-w-full divide-y divide-zinc-200/80">
              <thead className="bg-zinc-50/80">
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
                  <tr key={m.id}>
                    <td className="px-4 py-2.5 text-sm font-medium text-zinc-900">
                      {m.profiles?.full_name || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-zinc-500">
                      {m.profiles?.email || "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex rounded-full border border-zinc-200/80 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-700">
                        {roleLabels[m.role] || m.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {membership.role === "admin" && (
            <>
              <InviteMemberForm organizationId={membership.organization_id} />
              <PendingInvitesList invites={pendingInvites} />
            </>
          )}

          {membership.role === "admin" && (
            <div className="mt-8 border-t border-zinc-100 pt-6">
              <DemoSeedButton />
            </div>
          )}
          </div>
        </section>
      )}
    </div>
  );
}
