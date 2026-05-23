import { isPlanEnforcementEnabled, orgHasActivePlan } from "@/lib/plan";
import { canDeleteContracts, canEditContracts, getOrgMemberRole } from "@/lib/permissions";
import { requireServerActionEligibility } from "@/lib/product-surface/server-action-guard";
import { createAdminClient } from "@/lib/supabase/server";

export async function verifyOrgMembership(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string,
  orgId: string
) {
  const { data } = await admin
    .from("organization_members")
    .select("id")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .limit(1)
    .single();
  return !!data;
}

export async function requireContractWriteAccess(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string,
  orgId: string,
  actionId: string = "contracts:write"
): Promise<{ error: string } | null> {
  const eligibility = await requireServerActionEligibility({
    actionId,
    featureFamily: "contracts",
  });
  if (!eligibility.ok) {
    return { error: eligibility.message };
  }

  const role = await getOrgMemberRole(admin, userId, orgId);
  if (!canEditContracts(role)) {
    return { error: "Viewers cannot make changes." };
  }
  if (isPlanEnforcementEnabled() && !(await orgHasActivePlan(admin, orgId))) {
    return {
      error: "An active subscription is required. Open Billing to subscribe.",
    };
  }
  return null;
}

export async function requireContractDeleteAccess(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string,
  orgId: string
): Promise<{ error: string } | null> {
  const eligibility = await requireServerActionEligibility({
    actionId: "contracts:delete",
    featureFamily: "contracts",
  });
  if (!eligibility.ok) {
    return { error: eligibility.message };
  }

  const role = await getOrgMemberRole(admin, userId, orgId);
  if (!canDeleteContracts(role)) {
    return { error: "Only admins and managers can delete contracts." };
  }
  if (isPlanEnforcementEnabled() && !(await orgHasActivePlan(admin, orgId))) {
    return {
      error: "An active subscription is required. Open Billing to subscribe.",
    };
  }
  return null;
}
