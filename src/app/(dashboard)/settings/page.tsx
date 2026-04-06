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
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
          <p className="text-xs text-gray-400">
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
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Organization</h2>
            <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
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

          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Team members
          </h3>
          <div className="overflow-hidden rounded-md border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    Name
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    Email
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    Role
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {members.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {m.profiles?.full_name || "—"}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500">
                      {m.profiles?.email || "—"}
                    </td>
                    <td className="px-4 py-2">
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
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
            <div className="mt-8 border-t border-gray-100 pt-6">
              <DemoSeedButton />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
