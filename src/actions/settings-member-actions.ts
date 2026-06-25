import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import { isUuid, parseFixedEnumParam } from "@/lib/security/validation";
import { getClientIpFromHeaders, rateLimitCheck, RATE_LIMITS } from "@/lib/rate-limit";
import { canTransferOwnership } from "@/lib/roles";
import { hasSensitiveActionProof } from "@/lib/security/sensitive-action-proof";
import {
  VALID_INVITE_ROLES,
  canManageTeamOrWorkspace,
  safeInsertSettingsAuditEvent,
  type MembershipPermissionRow,
  type SettingsActionResult,
} from "./settings-helpers";

export async function updateOrgMemberRoleUnsafe(formData: FormData): Promise<SettingsActionResult> {
  const orgIdEntry = formData.get("organizationId");
  const orgId = typeof orgIdEntry === "string" ? orgIdEntry.trim() : "";
  const targetEntry = formData.get("targetUserId");
  const targetUserId = typeof targetEntry === "string" ? targetEntry.trim() : "";
  const roleEntry = formData.get("role");
  if (roleEntry != null && typeof roleEntry !== "string") return { error: "Invalid role" };
  const roleValue = typeof roleEntry === "string" ? roleEntry.trim() : "";
  const role = parseFixedEnumParam(roleValue, VALID_INVITE_ROLES, "");

  if (!orgId) return { error: "Organization is required" };
  if (!isUuid(orgId)) return { error: "Invalid organization" };
  if (!targetUserId || !isUuid(targetUserId)) return { error: "Invalid member" };
  if (!role || role !== roleValue) return { error: "Invalid role" };

  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const ip = await getClientIpFromHeaders();
  const rl = await rateLimitCheck(`member-role:${user.id}:${ip}`, RATE_LIMITS.inviteMember);
  if (!rl.ok) {
    return { error: "Too many changes. Try again later." };
  }

  const { data: membership, error: memErr } = await admin
    .from("organization_members")
    .select("role, organizations(owner_user_id)")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (memErr) {
    console.error("[settings] member-role membership:", memErr.message);
    return { error: "Could not verify permissions" };
  }
  if (!membership) {
    return { error: "You are not a member of this organization" };
  }
  if (!canManageTeamOrWorkspace(membership as MembershipPermissionRow, user.id)) {
    return { error: "Only workspace owners or admins can change team roles" };
  }

  const ownerUserId =
    (membership as MembershipPermissionRow).organizations?.owner_user_id ?? null;
  if (targetUserId === ownerUserId) {
    return { error: "Transfer ownership to change the workspace owner's role." };
  }

  const { data: target } = await admin
    .from("organization_members")
    .select("user_id, role")
    .eq("organization_id", orgId)
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (!target) {
    return { error: "Member not found" };
  }

  const { error: upErr } = await admin
    .from("organization_members")
    .update({ role })
    .eq("organization_id", orgId)
    .eq("user_id", targetUserId);

  if (upErr) return { error: mapDataSourceError(upErr.message) };

  const auditError = await safeInsertSettingsAuditEvent(
    admin,
    {
      organization_id: orgId,
      contract_id: null,
      user_id: user.id,
      action: "member.role_changed",
      details: { target_user_id: targetUserId, new_role: role },
    },
    "Role updated, but audit evidence could not be recorded. Refresh the page before retrying."
  );
  if (auditError) return auditError;

  revalidatePath("/settings");
  return { success: true };
}

export async function removeOrgMemberUnsafe(formData: FormData): Promise<SettingsActionResult> {
  const orgIdEntry = formData.get("organizationId");
  const orgId = typeof orgIdEntry === "string" ? orgIdEntry.trim() : "";
  const targetEntry = formData.get("targetUserId");
  const targetUserId = typeof targetEntry === "string" ? targetEntry.trim() : "";

  if (!orgId) return { error: "Organization is required" };
  if (!isUuid(orgId)) return { error: "Invalid organization" };
  if (!targetUserId || !isUuid(targetUserId)) return { error: "Invalid member" };

  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const ip = await getClientIpFromHeaders();
  const rl = await rateLimitCheck(`member-remove:${user.id}:${ip}`, RATE_LIMITS.inviteMember);
  if (!rl.ok) {
    return { error: "Too many changes. Try again later." };
  }

  const { data: membership, error: memErr } = await admin
    .from("organization_members")
    .select("role, organizations(owner_user_id)")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (memErr) {
    console.error("[settings] member-remove membership:", memErr.message);
    return { error: "Could not verify permissions" };
  }
  if (!membership) {
    return { error: "You are not a member of this organization" };
  }
  if (!canManageTeamOrWorkspace(membership as MembershipPermissionRow, user.id)) {
    return { error: "Only workspace owners or admins can remove members" };
  }

  const ownerUserId =
    (membership as MembershipPermissionRow).organizations?.owner_user_id ?? null;
  if (targetUserId === ownerUserId) {
    return { error: "Transfer ownership before removing the current owner." };
  }
  if (targetUserId === user.id) {
    return { error: "You cannot remove your own membership here." };
  }

  const { data: target } = await admin
    .from("organization_members")
    .select("user_id, role")
    .eq("organization_id", orgId)
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (!target) {
    return { error: "Member not found" };
  }

  const { error: delErr } = await admin
    .from("organization_members")
    .delete()
    .eq("organization_id", orgId)
    .eq("user_id", targetUserId);

  if (delErr) return { error: mapDataSourceError(delErr.message) };

  const auditError = await safeInsertSettingsAuditEvent(
    admin,
    {
      organization_id: orgId,
      contract_id: null,
      user_id: user.id,
      action: "member.removed",
      details: { target_user_id: targetUserId, former_role: target.role ?? null },
    },
    "Member removed, but audit evidence could not be recorded. Refresh the page before retrying."
  );
  if (auditError) return auditError;

  revalidatePath("/settings");
  return { success: true };
}

export async function transferOrgOwnershipUnsafe(formData: FormData): Promise<SettingsActionResult> {
  const orgIdEntry = formData.get("organizationId");
  const orgId = typeof orgIdEntry === "string" ? orgIdEntry.trim() : "";
  const newOwnerEntry = formData.get("newOwnerUserId");
  const newOwnerUserId = typeof newOwnerEntry === "string" ? newOwnerEntry.trim() : "";

  if (!orgId) return { error: "Organization is required" };
  if (!isUuid(orgId)) return { error: "Invalid organization" };
  if (!newOwnerUserId || !isUuid(newOwnerUserId)) return { error: "Invalid member" };

  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const ip = await getClientIpFromHeaders();
  const rl = await rateLimitCheck(`ownership-transfer:${user.id}:${ip}`, RATE_LIMITS.inviteMember);
  if (!rl.ok) {
    return { error: "Too many changes. Try again later." };
  }

  const { data: membership, error: memErr } = await admin
    .from("organization_members")
    .select("role, organizations(owner_user_id)")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (memErr) {
    console.error("[settings] ownership-transfer membership:", memErr.message);
    return { error: "Could not verify permissions" };
  }
  if (!membership) {
    return { error: "You are not a member of this organization" };
  }

  const ownerUserId =
    (membership as MembershipPermissionRow).organizations?.owner_user_id ?? null;
  const isWorkspaceOwner = ownerUserId === user.id;
  if (!canTransferOwnership((membership as MembershipPermissionRow).role, { isWorkspaceOwner })) {
    return { error: "Only the workspace owner can transfer ownership." };
  }
  if (newOwnerUserId === user.id) {
    return { error: "You already own this workspace." };
  }

  const { data: target } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("user_id", newOwnerUserId)
    .maybeSingle();
  if (!target) {
    return { error: "Choose an existing workspace member to transfer ownership to." };
  }

  const hasProof = await hasSensitiveActionProof(supabase, user.id);
  if (!hasProof) {
    return { needStepUp: true };
  }

  const { error: orgErr } = await admin
    .from("organizations")
    .update({ owner_user_id: newOwnerUserId })
    .eq("id", orgId);
  if (orgErr) return { error: mapDataSourceError(orgErr.message) };

  await admin
    .from("organization_members")
    .update({ role: "admin" })
    .eq("organization_id", orgId)
    .eq("user_id", newOwnerUserId);

  const auditError = await safeInsertSettingsAuditEvent(
    admin,
    {
      organization_id: orgId,
      contract_id: null,
      user_id: user.id,
      action: "member.ownership_transferred",
      details: { previous_owner: user.id, new_owner: newOwnerUserId },
    },
    "Ownership transferred, but audit evidence could not be recorded. Refresh the page."
  );
  if (auditError) return auditError;

  revalidatePath("/settings");
  return { success: true };
}
