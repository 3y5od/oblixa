"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { resolveAppBaseUrl } from "@/lib/app-url";
import { revalidatePath } from "next/cache";
import { sendWorkspaceInviteLinkEmail } from "@/lib/email";
import { mapAuthError, mapDataSourceError } from "@/lib/errors/user-facing";
import { isReasonableEmail, isUuid, parseFixedEnumParam, validateBoundedString } from "@/lib/security/validation";
import {
  getClientIpFromHeaders,
  rateLimitCheck,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { isKillInvites } from "@/lib/security/kill-switches";
import { loadOrgMemberProfileRows } from "@/lib/org-member-profiles";
import { evaluateSeatMutation } from "@/lib/billing/operational-entitlements";
import { canTransferOwnership, isWorkspaceAdminRole } from "@/lib/roles";
import { hasSensitiveActionProof } from "@/lib/security/sensitive-action-proof";
import {
  INVITE_TTL_MS,
  MAX_INVITE_EMAIL_LEN,
  MAX_ORG_NAME_LEN,
  MAX_PROFILE_NAME_LEN,
  type SettingsActionResult,
  VALID_INVITE_ROLES,
  isExistingAuthUserInviteConflict,
  loadPendingInviteSeatRows,
  recoverSettingsAction,
  safeInsertSettingsAuditEvent,
} from "./settings-helpers";

type MembershipPermissionRow = {
  role?: string | null;
  organizations?: { owner_user_id?: string | null } | null;
};

function canManageTeamOrWorkspace(row: MembershipPermissionRow | null | undefined, userId: string): boolean {
  return isWorkspaceAdminRole(row?.role, {
    isWorkspaceOwner: row?.organizations?.owner_user_id === userId,
  });
}

export async function updateProfile(formData: FormData): Promise<SettingsActionResult> {
  return recoverSettingsAction("updateProfile", () => updateProfileUnsafe(formData));
}

async function updateProfileUnsafe(formData: FormData): Promise<SettingsActionResult> {
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const fullNameValidation = validateBoundedString(formData.get("fullName") ?? "", {
    maxLength: MAX_PROFILE_NAME_LEN,
    allowEmpty: true,
  });
  if (!fullNameValidation.ok) {
    if (fullNameValidation.error === "string_too_long") return { error: "Name is too long" };
    return { error: "Name contains unsupported characters" };
  }
  const fullName = fullNameValidation.value;

  const { error } = await admin
    .from("profiles")
    .update({ full_name: fullName || null })
    .eq("id", user.id);

  if (error) return { error: mapDataSourceError(error.message) };

  const { error: updateUserError } = await supabase.auth.updateUser({
    data: { full_name: fullName },
  });
  if (updateUserError) {
    console.error("[settings] updateUser:", updateUserError.message);
  }

  revalidatePath("/settings");
  return { success: true };
}

export async function updateOrganization(formData: FormData): Promise<SettingsActionResult> {
  return recoverSettingsAction("updateOrganization", () => updateOrganizationUnsafe(formData));
}

async function updateOrganizationUnsafe(formData: FormData): Promise<SettingsActionResult> {
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const orgIdEntry = formData.get("organizationId");
  const orgId = typeof orgIdEntry === "string" ? orgIdEntry.trim() : "";
  const nameValidation = validateBoundedString(formData.get("name") ?? "", {
    maxLength: MAX_ORG_NAME_LEN,
  });

  if (!isUuid(orgId)) return { error: "Invalid organization" };
  if (!nameValidation.ok) {
    if (nameValidation.error === "string_too_long") return { error: "Organization name is too long" };
    if (nameValidation.error === "unsafe_characters") return { error: "Organization name contains unsupported characters" };
    return { error: "Organization name is required" };
  }
  const name = nameValidation.value;

  const { data: membership, error: memErr } = await admin
    .from("organization_members")
    .select("role, organizations(owner_user_id)")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (memErr) {
    console.error("[settings] updateOrganization membership:", memErr.message);
    return { error: "Could not verify permissions" };
  }

  if (!membership) {
    return { error: "You are not a member of this organization" };
  }

  if (!canManageTeamOrWorkspace(membership as MembershipPermissionRow, user.id)) {
    return { error: "Only workspace owners or admins can update the organization" };
  }

  const { error } = await admin
    .from("organizations")
    .update({ name })
    .eq("id", orgId);

  if (error) return { error: mapDataSourceError(error.message) };

  revalidatePath("/settings");
  return { success: true };
}

export async function inviteOrgMember(formData: FormData): Promise<SettingsActionResult> {
  return recoverSettingsAction("inviteOrgMember", () => inviteOrgMemberUnsafe(formData));
}

async function inviteOrgMemberUnsafe(formData: FormData): Promise<SettingsActionResult> {
  const orgIdEntry = formData.get("organizationId");
  const orgId = typeof orgIdEntry === "string" ? orgIdEntry.trim() : "";
  const emailValidation = validateBoundedString(formData.get("email") ?? "", {
    maxLength: MAX_INVITE_EMAIL_LEN,
  });
  const roleEntry = formData.get("role");
  if (roleEntry != null && typeof roleEntry !== "string") {
    return { error: "Invalid role" };
  }
  const roleValue = typeof roleEntry === "string" && roleEntry.trim() ? roleEntry.trim() : "editor";
  const role = parseFixedEnumParam(roleValue, VALID_INVITE_ROLES, "editor");

  if (!orgId) return { error: "Organization is required" };
  if (!isUuid(orgId)) return { error: "Invalid organization" };
  if (!emailValidation.ok) {
    if (emailValidation.error === "invalid_string") return { error: "Email is required" };
    return { error: "Invalid email address" };
  }
  const email = emailValidation.value.toLowerCase();
  if (!isReasonableEmail(email)) {
    return { error: "Invalid email address" };
  }
  if (role !== roleValue) {
    return { error: "Invalid role" };
  }

  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const ip = await getClientIpFromHeaders();
  const rl = await rateLimitCheck(`invite:${user.id}:${ip}`, RATE_LIMITS.inviteMember);
  if (!rl.ok) {
    return { error: "Too many invites. Try again later." };
  }

  const { data: membership, error: memErr } = await admin
    .from("organization_members")
    .select("role, organizations(owner_user_id)")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (memErr) {
    console.error("[settings] invite membership:", memErr.message);
    return { error: "Could not verify permissions" };
  }

  if (!membership) {
    return { error: "You are not a member of this organization" };
  }

  if (!canManageTeamOrWorkspace(membership as MembershipPermissionRow, user.id)) {
    return { error: "Only workspace owners or admins can invite team members" };
  }

  if (isKillInvites()) {
    return { error: "Invitations are temporarily disabled." };
  }

  const memberRows = await loadOrgMemberProfileRows(admin, orgId, {
    memberColumns: "id, user_id",
  });
  const existingMember = memberRows.find((member) => member.profiles?.email?.toLowerCase() === email);
  if (existingMember) {
    return { error: "This user is already a member of the organization." };
  }

  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
  const pendingInviteResult = await loadPendingInviteSeatRows(admin, orgId, new Date().toISOString());
  if (pendingInviteResult.error) {
    return { error: "Could not verify team member limit. Try again later." };
  }
  const pendingInvites = pendingInviteResult.rows;
  const duplicatePendingInvite = pendingInvites.some((invite) => invite.email.toLowerCase() === email);
  const seatDecision = evaluateSeatMutation({
    operation: "invite_creation",
    activeSeats: memberRows.length,
    pendingInvites: pendingInvites.length,
    duplicatePendingInvite,
    sameTenant: true,
  });

  if (!seatDecision.allowed) {
    return {
      error:
        seatDecision.reason === "seat_limit_reached"
          ? "Your workspace has reached its team member limit. Revoke a pending invite or remove a member before inviting someone new."
          : "This invite cannot be created for the current billing state.",
    };
  }

  await admin
    .from("organization_invites")
    .delete()
    .eq("organization_id", orgId)
    .eq("email", email)
    .is("consumed_at", null)
    .is("revoked_at", null);

  const { data: inviteRow, error: inviteErr } = await admin
    .from("organization_invites")
    .insert({
      organization_id: orgId,
      email,
      role,
      invited_by: user.id,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (inviteErr || !inviteRow) {
    console.error("[settings] organization_invites insert:", inviteErr?.message);
    return { error: mapDataSourceError(inviteErr?.message ?? "Could not create invite") };
  }

  const appUrl = await resolveAppBaseUrl();

  const redirectTo = `${appUrl}/auth/callback`;
  const { error: inviteMailErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: {
      invite_id: inviteRow.id,
    },
    redirectTo,
  });

  if (inviteMailErr) {
    if (isExistingAuthUserInviteConflict(inviteMailErr.message)) {
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: {
          redirectTo,
          data: { invite_id: inviteRow.id },
        },
      });
      const actionUrl = linkData?.properties?.action_link;
      if (linkErr || !actionUrl) {
        await admin.from("organization_invites").delete().eq("id", inviteRow.id);
        return { error: mapAuthError(linkErr?.message ?? inviteMailErr.message) };
      }
      const sent = await sendWorkspaceInviteLinkEmail({ to: email, actionUrl });
      if (sent.error) {
        await admin.from("organization_invites").delete().eq("id", inviteRow.id);
        console.error("[settings] invite magic-link email:", sent.error.message);
        return {
          error:
            sent.error.message === "Email provider is not configured"
              ? "This email already has an account. Set RESEND_API_KEY so we can send a sign-in link, or ask them to sign in with that address."
              : "Could not send the invite email. Try again later.",
        };
      }
    } else {
      await admin.from("organization_invites").delete().eq("id", inviteRow.id);
      return { error: mapAuthError(inviteMailErr.message) };
    }
  }

  const auditError = await safeInsertSettingsAuditEvent(
    admin,
    {
      organization_id: orgId,
      contract_id: null,
      user_id: user.id,
      action: "member.invited",
      details: { email, role },
    },
    "Invite created, but audit evidence could not be recorded. Refresh the page before retrying."
  );
  if (auditError) return auditError;

  revalidatePath("/settings");
  return { success: true };
}

export async function revokeOrgInvite(inviteId: string): Promise<SettingsActionResult> {
  return recoverSettingsAction("revokeOrgInvite", () => revokeOrgInviteUnsafe(inviteId));
}

async function revokeOrgInviteUnsafe(inviteId: string): Promise<SettingsActionResult> {
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(inviteId)) return { error: "Invalid invite" };

  const { data: inv, error: fetchErr } = await admin
    .from("organization_invites")
    .select("id, organization_id, consumed_at, revoked_at")
    .eq("id", inviteId)
    .maybeSingle();

  if (fetchErr || !inv) return { error: "Invite not found" };
  if (inv.consumed_at || inv.revoked_at) {
    return { error: "This invite is no longer pending." };
  }

  const { data: membership } = await admin
    .from("organization_members")
    .select("role, organizations(owner_user_id)")
    .eq("organization_id", inv.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!canManageTeamOrWorkspace(membership as MembershipPermissionRow | null, user.id)) {
    return { error: "Only workspace owners or admins can revoke invites" };
  }

  const { error: upErr } = await admin
    .from("organization_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId);

  if (upErr) return { error: mapDataSourceError(upErr.message) };

  const auditError = await safeInsertSettingsAuditEvent(
    admin,
    {
      organization_id: inv.organization_id,
      contract_id: null,
      user_id: user.id,
      action: "member.invite_revoked",
      details: { invite_id: inviteId },
    },
    "Invite revoked, but audit evidence could not be recorded. Refresh the page before retrying."
  );
  if (auditError) return auditError;

  revalidatePath("/settings");
  return { success: true };
}

export async function resendOrgInvite(inviteId: string): Promise<SettingsActionResult> {
  return recoverSettingsAction("resendOrgInvite", () => resendOrgInviteUnsafe(inviteId));
}

async function resendOrgInviteUnsafe(inviteId: string): Promise<SettingsActionResult> {
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(inviteId)) return { error: "Invalid invite" };

  const ip = await getClientIpFromHeaders();
  const rl = await rateLimitCheck(`invite:${user.id}:${ip}`, RATE_LIMITS.inviteMember);
  if (!rl.ok) {
    return { error: "Too many invite actions. Try again later." };
  }

  const { data: inv, error: fetchErr } = await admin
    .from("organization_invites")
    .select("id, organization_id, email, role, consumed_at, revoked_at")
    .eq("id", inviteId)
    .maybeSingle();

  if (fetchErr || !inv) return { error: "Invite not found" };
  if (inv.consumed_at || inv.revoked_at) {
    return { error: "This invite is no longer pending." };
  }

  const { data: membership } = await admin
    .from("organization_members")
    .select("role, organizations(owner_user_id)")
    .eq("organization_id", inv.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!canManageTeamOrWorkspace(membership as MembershipPermissionRow | null, user.id)) {
    return { error: "Only workspace owners or admins can resend invites" };
  }

  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
  const { error: expErr } = await admin
    .from("organization_invites")
    .update({ expires_at: expiresAt })
    .eq("id", inviteId);

  if (expErr) return { error: mapDataSourceError(expErr.message) };

  const appUrl = await resolveAppBaseUrl();
  const redirectTo = `${appUrl}/auth/callback`;

  const { error: inviteMailErr } = await admin.auth.admin.inviteUserByEmail(inv.email, {
    data: {
      invite_id: inviteId,
    },
    redirectTo,
  });

  if (inviteMailErr) {
    if (isExistingAuthUserInviteConflict(inviteMailErr.message)) {
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: inv.email,
        options: {
          redirectTo,
          data: { invite_id: inviteId },
        },
      });
      const actionUrl = linkData?.properties?.action_link;
      if (linkErr || !actionUrl) {
        return { error: mapAuthError(linkErr?.message ?? inviteMailErr.message) };
      }
      const sent = await sendWorkspaceInviteLinkEmail({
        to: inv.email,
        actionUrl,
      });
      if (sent.error) {
        console.error("[settings] resend invite magic-link email:", sent.error.message);
        return {
          error:
            sent.error.message === "Email provider is not configured"
              ? "This email already has an account. Set RESEND_API_KEY to resend a sign-in link."
              : "Could not send the invite email. Try again later.",
        };
      }
    } else {
      return { error: mapAuthError(inviteMailErr.message) };
    }
  }

  const auditError = await safeInsertSettingsAuditEvent(
    admin,
    {
      organization_id: inv.organization_id,
      contract_id: null,
      user_id: user.id,
      action: "member.invite_resent",
      details: { invite_id: inviteId, email: inv.email },
    },
    "Invite resent, but audit evidence could not be recorded. Refresh the page before retrying."
  );
  if (auditError) return auditError;

  revalidatePath("/settings");
  return { success: true };
}

export async function updateOrgMemberRole(formData: FormData): Promise<SettingsActionResult> {
  return recoverSettingsAction("updateOrgMemberRole", () => updateOrgMemberRoleUnsafe(formData));
}

async function updateOrgMemberRoleUnsafe(formData: FormData): Promise<SettingsActionResult> {
  // Validate before any client/auth work (mirrors inviteOrgMember; the
  // action-scope contract test asserts createClient is not called on bad input).
  const orgIdEntry = formData.get("organizationId");
  const orgId = typeof orgIdEntry === "string" ? orgIdEntry.trim() : "";
  const targetEntry = formData.get("targetUserId");
  const targetUserId = typeof targetEntry === "string" ? targetEntry.trim() : "";
  const roleEntry = formData.get("role");
  if (roleEntry != null && typeof roleEntry !== "string") return { error: "Invalid role" };
  const roleValue = typeof roleEntry === "string" ? roleEntry.trim() : "";
  // Owner is the organizations.owner_user_id relation, never an assignable
  // member role — granting Owner only happens via ownership transfer.
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

  // The workspace owner's role is not editable here (it is resolved from
  // organizations.owner_user_id, and the last owner cannot be downgraded);
  // changing the owner happens through ownership transfer.
  const ownerUserId =
    (membership as MembershipPermissionRow).organizations?.owner_user_id ?? null;
  if (targetUserId === ownerUserId) {
    return { error: "Transfer ownership to change the workspace owner's role." };
  }

  // Target must be an existing member of the caller's workspace (generic
  // not-found so foreign/other-workspace ids are not enumerable).
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

export async function removeOrgMember(formData: FormData): Promise<SettingsActionResult> {
  return recoverSettingsAction("removeOrgMember", () => removeOrgMemberUnsafe(formData));
}

async function removeOrgMemberUnsafe(formData: FormData): Promise<SettingsActionResult> {
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
  // The workspace owner cannot be removed — that would strand the workspace with
  // no Owner (release-state: a workspace must always keep at least one Owner).
  // Transferring ownership is the supported path to change the owner first.
  if (targetUserId === ownerUserId) {
    return { error: "Transfer ownership before removing the current owner." };
  }
  // Removing yourself is not a management action (use account/leave-workspace
  // recovery); blocking it also avoids an admin self-lockout footgun.
  if (targetUserId === user.id) {
    return { error: "You cannot remove your own membership here." };
  }

  // Target must be an existing member of the caller's workspace (generic
  // not-found so foreign/other-workspace ids are not enumerable).
  const { data: target } = await admin
    .from("organization_members")
    .select("user_id, role")
    .eq("organization_id", orgId)
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (!target) {
    return { error: "Member not found" };
  }

  // Ending access removes only the org↔user membership link; the member's
  // historical activity/uploads/reviews reference user_id and are preserved.
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

export async function transferOrgOwnership(formData: FormData): Promise<SettingsActionResult> {
  return recoverSettingsAction("transferOrgOwnership", () => transferOrgOwnershipUnsafe(formData));
}

async function transferOrgOwnershipUnsafe(formData: FormData): Promise<SettingsActionResult> {
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
  // Owner-only (release-state: only the Owner can transfer ownership; Admin = No).
  if (!canTransferOwnership((membership as MembershipPermissionRow).role, { isWorkspaceOwner })) {
    return { error: "Only the workspace owner can transfer ownership." };
  }
  if (newOwnerUserId === user.id) {
    return { error: "You already own this workspace." };
  }

  // The new owner must already be an active member of this workspace.
  const { data: target } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("user_id", newOwnerUserId)
    .maybeSingle();
  if (!target) {
    return { error: "Choose an existing workspace member to transfer ownership to." };
  }

  // Fresh step-up is REQUIRED for this irreversible action (release-state:
  // ownership transfer requires a fresh authentication step). The client routes
  // the user through re-auth and retries on { needStepUp: true }.
  const hasProof = await hasSensitiveActionProof(supabase, user.id);
  if (!hasProof) {
    return { needStepUp: true };
  }

  // Single owner_user_id model: setting it to the new owner replaces the prior
  // owner, so the workspace always resolves exactly one owner (no transient gap).
  const { error: orgErr } = await admin
    .from("organizations")
    .update({ owner_user_id: newOwnerUserId })
    .eq("id", orgId);
  if (orgErr) return { error: mapDataSourceError(orgErr.message) };

  // Ensure the new owner retains admin-level capability if ownership is ever
  // transferred away again (owner powers themselves resolve from owner_user_id).
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

export async function completeProductOnboarding(): Promise<SettingsActionResult> {
  return recoverSettingsAction("completeProductOnboarding", () => completeProductOnboardingUnsafe());
}

async function completeProductOnboardingUnsafe(): Promise<SettingsActionResult> {
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await admin
    .from("profiles")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return { error: mapDataSourceError(error.message) };

  revalidatePath("/settings");
  return { success: true };
}
