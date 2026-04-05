import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import type { OrganizationMember } from "@/lib/types";

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: membership } = await supabase
    .from("organization_members")
    .select("*, organizations(name)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  const orgId = membership?.organization_id;

  let members: OrganizationMember[] = [];
  if (orgId) {
    const { data } = await supabase
      .from("organization_members")
      .select("*, profiles(full_name, email)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true });
    members = (data as OrganizationMember[]) || [];
  }

  const roleLabels: Record<string, string> = {
    admin: "Admin",
    editor: "Editor",
    viewer: "Viewer",
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Profile */}
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile</h2>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-gray-500">Name</dt>
            <dd className="text-sm font-medium text-gray-900">
              {profile?.full_name || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Email</dt>
            <dd className="text-sm font-medium text-gray-900">
              {user.email || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Account created</dt>
            <dd className="text-sm text-gray-900">
              {user.created_at
                ? format(new Date(user.created_at), "MMM d, yyyy")
                : "—"}
            </dd>
          </div>
        </dl>
      </section>

      {/* Organization */}
      {membership && (
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Organization
          </h2>
          <dl className="mb-6 grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-gray-500">Name</dt>
              <dd className="text-sm font-medium text-gray-900">
                {(membership as OrganizationMember & { organizations: { name: string } }).organizations?.name || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Your role</dt>
              <dd className="text-sm font-medium text-gray-900">
                {roleLabels[membership.role] || membership.role}
              </dd>
            </div>
          </dl>

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
        </section>
      )}
    </div>
  );
}
