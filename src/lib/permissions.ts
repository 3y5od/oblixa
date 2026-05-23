import { createAdminClient } from "@/lib/supabase/server";
import type { OrgRole } from "@/lib/types";

export async function getOrgMemberRole(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string,
  orgId: string
): Promise<OrgRole | null> {
  const { data, error } = await admin
    .from("organization_members")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();
  if (error) {
    console.error("[permissions] getOrgMemberRole query failed:", error.message);
    return null;
  }
  return (data?.role as OrgRole) ?? null;
}

export function canEditContracts(role: OrgRole | null): boolean {
  return role === "admin" || role === "editor" || role === "ops_manager" || role === "manager";
}

export function canDeleteContracts(role: OrgRole | null): boolean {
  return role === "admin" || role === "manager";
}
