import { hasRoleCapability, type RoleCapability } from "@/lib/access-control";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import { canEditContracts, getOrgMemberRole } from "@/lib/permissions";
import {
  createAdminClient,
  createClient,
  getOrEnsureDeterministicMembership,
} from "@/lib/supabase/server";
import type { OrgRole } from "@/lib/types";

export type ActionUser = {
  id: string;
  email?: string | null;
  user_metadata?: {
    full_name?: unknown;
  } | null;
};

export type AuthenticatedActionContext = {
  admin: Awaited<ReturnType<typeof createAdminClient>>;
  user: ActionUser;
};

export type MembershipContext = {
  userId: string;
  orgId: string;
  role: OrgRole | null;
};

export async function getAuthenticatedActionContext(): Promise<AuthenticatedActionContext | null> {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return {
    admin,
    user: user as ActionUser,
  };
}

export async function getAuthenticatedMembershipContext(): Promise<
  (AuthenticatedActionContext & {
    membership: { organization_id: string; role: OrgRole };
  }) | null
> {
  const ctx = await getAuthenticatedActionContext();
  if (!ctx) return null;
  const membership = await getOrEnsureDeterministicMembership(ctx.admin, ctx.user);
  if (!membership) return null;
  return {
    ...ctx,
    membership,
  };
}

export async function getRolePolicyJson(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  orgId: string
): Promise<Record<string, unknown> | null> {
  const { data: workflowSettings } = await admin
    .from("organization_workflow_settings")
    .select("role_policy_json")
    .eq("organization_id", orgId)
    .maybeSingle();
  return (workflowSettings?.role_policy_json as Record<string, unknown> | null) ?? null;
}

export async function hasOrgCapability(input: {
  admin: Awaited<ReturnType<typeof createAdminClient>>;
  organizationId: string;
  userId: string;
  capability: RoleCapability;
  allowContractEditors?: boolean;
}): Promise<boolean> {
  const role = await getOrgMemberRole(input.admin, input.userId, input.organizationId);
  if (input.allowContractEditors && canEditContracts(role)) return true;
  const rolePolicyJson = await getRolePolicyJson(input.admin, input.organizationId);
  return hasRoleCapability({
    role,
    capability: input.capability,
    rolePolicyJson,
  });
}

export async function getContractAccessContext(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string,
  contractId: string
): Promise<
  | {
      ok: true;
      ctx: MembershipContext;
    }
  | {
      ok: false;
      error: string;
      status: number;
    }
> {
  const { data: contract, error } = await admin
    .from("contracts")
    .select("id, organization_id")
    .eq("id", contractId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: mapDataSourceError(error.message),
      status: 500,
    };
  }
  if (!contract) {
    return { ok: false, error: "Contract not found", status: 404 };
  }

  const role = await getOrgMemberRole(admin, userId, contract.organization_id);
  if (!role) {
    return { ok: false, error: "Access denied", status: 403 };
  }

  return {
    ok: true,
    ctx: {
      userId,
      orgId: contract.organization_id,
      role,
    },
  };
}
