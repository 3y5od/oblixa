import { getAuthContext } from "@/lib/supabase/server";
import { format } from "date-fns";
import { ProfileForm } from "@/components/settings/profile-form";
import { OrgForm } from "@/components/settings/org-form";
import { DemoSeedButton } from "@/components/settings/demo-seed-button";
import { InviteMemberForm } from "@/components/settings/invite-member-form";
import type { OrganizationMember } from "@/lib/types";

export default async function SettingsPage() {
  const ctx = await getAuthContext();
  if (!ctx) return null;

  const { user, orgId, admin } = ctx;

  const [{ data: profile }, { data: membership }, { data: membersData }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single(),
      admin
        .from("organization_members")
        .select("*, organizations(name)")
        .eq("user_id", user.id)
        .eq("organization_id", orgId)
        .limit(1)
        .single(),
      admin
        .from("organization_members")
        .select("*, profiles(full_name, email)")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: true }),
    ]);

  const members = (membersData as OrganizationMember[]) || [];

  const orgName =
    (membership as OrganizationMember & { organizations: { name: string } } | null)
      ?.organizations?.name || "";

  const roleLabels: Record<string, string> = {
    admin: "Admin",
    editor: "Editor",
    viewer: "Viewer",
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="ui-page-title">Settings</h1>

      <section className="ui-card p-6 shadow-none">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="ui-section-title">Profile</h2>
          <p className="text-xs text-zinc-400">
            Joined{" "}
            {user.created_at
              ? format(new Date(user.created_at), "MMM d, yyyy")
              : "—"}
          </p>
        </div>
        <ProfileForm
          fullName={profile?.full_name ?? null}
          email={user.email || ""}
        />
      </section>

      {membership && (
        <section className="ui-card p-6 shadow-none">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="ui-section-title">Organization</h2>
            <span className="inline-flex rounded-full border border-zinc-200/80 bg-zinc-50 px-2.5 py-0.5 text-xs font-semibold text-zinc-700">
              {roleLabels[membership.role] || membership.role}
            </span>
          </div>

          <div className="mb-6">
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
            <InviteMemberForm organizationId={membership.organization_id} />
          )}

          {membership.role === "admin" && (
            <div className="mt-8 border-t border-zinc-100 pt-6">
              <DemoSeedButton />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
