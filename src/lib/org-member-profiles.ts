import type { Profile } from "@/lib/types";
import type { createAdminClient } from "@/lib/supabase/server";

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

export type OrgMemberProfileSummary = Pick<Profile, "full_name" | "email">;

export type OrgMemberProfileRow = {
  id?: string;
  organization_id?: string;
  user_id: string;
  role?: string;
  created_at?: string;
  profiles: OrgMemberProfileSummary | null;
};

export function orgMemberProfileLabel(
  profile: OrgMemberProfileSummary | null | undefined,
  fallback = "Member"
): string {
  return profile?.full_name || profile?.email || fallback;
}

export async function loadOrgMemberProfileRows(
  admin: AdminClient,
  orgId: string,
  options: {
    userIds?: string[];
    memberColumns?: string;
    orderByCreatedAt?: boolean;
    limit?: number;
  } = {}
): Promise<OrgMemberProfileRow[]> {
  let query = admin
    .from("organization_members")
    .select(options.memberColumns ?? "user_id")
    .eq("organization_id", orgId);

  const userIds = [...new Set((options.userIds ?? []).filter(Boolean))];
  if (userIds.length > 0) query = query.in("user_id", userIds);
  if (options.orderByCreatedAt) query = query.order("created_at", { ascending: true });
  if (typeof options.limit === "number") query = query.limit(options.limit);

  const { data: members, error } = await query;
  if (error || !members) return [];

  const memberRows = members as unknown as Array<Record<string, unknown> & { user_id?: string | null }>;
  const profileIds = [
    ...new Set(memberRows.map((member) => member.user_id).filter(Boolean) as string[]),
  ];

  if (profileIds.length === 0) {
    return memberRows.flatMap((member) =>
      member.user_id ? [{ ...member, user_id: member.user_id, profiles: null } as OrgMemberProfileRow] : []
    );
  }

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .in("id", profileIds);

  const profileById = new Map(
    ((profiles ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map(
      (profile) => [profile.id, { full_name: profile.full_name, email: profile.email }]
    )
  );

  return memberRows.flatMap((member) => {
    if (!member.user_id) return [];
    return [
      {
        ...member,
        user_id: member.user_id,
        profiles: profileById.get(member.user_id) ?? null,
      } as OrgMemberProfileRow,
    ];
  });
}