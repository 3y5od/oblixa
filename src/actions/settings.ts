"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import { isUuid, validateBoundedString } from "@/lib/security/validation";
import {
  inviteOrgMemberUnsafe,
  resendOrgInviteUnsafe,
  revokeOrgInviteUnsafe,
} from "./settings-invite-actions";
import {
  removeOrgMemberUnsafe,
  transferOrgOwnershipUnsafe,
  updateOrgMemberRoleUnsafe,
} from "./settings-member-actions";
import {
  MAX_ORG_NAME_LEN,
  MAX_PROFILE_NAME_LEN,
  canManageTeamOrWorkspace,
  recoverSettingsAction,
  type MembershipPermissionRow,
  type SettingsActionResult,
} from "./settings-helpers";

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

export async function revokeOrgInvite(inviteId: string): Promise<SettingsActionResult> {
  return recoverSettingsAction("revokeOrgInvite", () => revokeOrgInviteUnsafe(inviteId));
}

export async function resendOrgInvite(inviteId: string): Promise<SettingsActionResult> {
  return recoverSettingsAction("resendOrgInvite", () => resendOrgInviteUnsafe(inviteId));
}

export async function updateOrgMemberRole(formData: FormData): Promise<SettingsActionResult> {
  return recoverSettingsAction("updateOrgMemberRole", () => updateOrgMemberRoleUnsafe(formData));
}

export async function removeOrgMember(formData: FormData): Promise<SettingsActionResult> {
  return recoverSettingsAction("removeOrgMember", () => removeOrgMemberUnsafe(formData));
}

export async function transferOrgOwnership(formData: FormData): Promise<SettingsActionResult> {
  return recoverSettingsAction("transferOrgOwnership", () => transferOrgOwnershipUnsafe(formData));
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
