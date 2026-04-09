import type { OrgRole } from "@/lib/types";
import {
  createAdminClient,
  createClient,
  getDeterministicMembership,
} from "@/lib/supabase/server";
import { hasRoleCapability, type RoleCapability } from "@/lib/access-control";

type AuthContext = {
  admin: Awaited<ReturnType<typeof createAdminClient>>;
  userId: string;
  orgId: string;
  role: OrgRole;
};

export async function getApiAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const membership = await getDeterministicMembership(admin, user.id);
  if (!membership) return null;

  return {
    admin,
    userId: user.id,
    orgId: membership.organization_id,
    role: membership.role,
  };
}

export async function canManageCapability(
  ctx: AuthContext,
  capability: RoleCapability
): Promise<boolean> {
  const { data: settings } = await ctx.admin
    .from("organization_workflow_settings")
    .select("role_policy_json")
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  return hasRoleCapability({
    role: ctx.role,
    capability,
    rolePolicyJson: (settings?.role_policy_json as Record<string, unknown> | null) ?? null,
  });
}
