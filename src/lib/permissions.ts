import { createAdminClient } from "@/lib/supabase/server";
import type { OrgRole } from "@/lib/types";

export async function getOrgMemberRole(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string,
  orgId: string
): Promise<OrgRole | null> {
  const { data } = await admin
    .from("organization_members")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .limit(1)
    .single();
  return (data?.role as OrgRole) ?? null;
}

export function canEditContracts(role: OrgRole | null): boolean {
  return role === "admin" || role === "editor";
}
