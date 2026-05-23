"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { resolveAppBaseUrl } from "@/lib/app-url";
import { revalidatePath } from "next/cache";
import { sendWorkspaceInviteLinkEmail } from "@/lib/email";
import { mapAuthError, mapDataSourceError } from "@/lib/errors/user-facing";
import type { OrgRole } from "@/lib/types";
import { isReasonableEmail, isUuid, parseFixedEnumParam, validateBoundedString } from "@/lib/security/validation";
import {
  getClientIpFromHeaders,
  rateLimitCheck,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { isKillInvites } from "@/lib/security/kill-switches";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";
import { loadOrgMemberProfileRows } from "@/lib/org-member-profiles";

const MAX_PROFILE_NAME_LEN = 200;
const MAX_ORG_NAME_LEN = 200;
const MAX_INVITE_EMAIL_LEN = 254;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const VALID_INVITE_ROLES: OrgRole[] = ["admin", "editor", "viewer"];

type SettingsActionResult = { error?: string; success?: true };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "Unknown error");
}

async function recoverSettingsAction(scope: string, run: () => Promise<SettingsActionResult>): Promise<SettingsActionResult> {
  try {
    return await run();
  } catch (error) {
    console.error(`[settings] ${scope} failed`, error);
    return { error: describeRecoverableMutationError(errorMessage(error)) };
  }
}

async function safeInsertSettingsAuditEvent(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  row: Record<string, unknown>,
  failureMessage: string
): Promise<{ error: string } | null> {
  try {
    const { error } = await admin.from("audit_events").insert(row);
    if (!error) return null;
    console.error("[settings] audit_events insert failed:", error.message);
  } catch (error) {
    console.error("[settings] audit_events insert threw:", error);
  }
  return { error: failureMessage };
}

/** Supabase rejects admin invite-by-email when the address already exists in Auth. */
function isExistingAuthUserInviteConflict(message: string): boolean {
  const m = message.toLowerCase();
  if (m.includes("already been registered")) return true;
  if (m.includes("user already registered")) return true;
  if (m.includes("users_email_partial_key")) return true;
  if (m.includes("duplicate key") && m.includes("users") && m.includes("email")) return true;
  return false;
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
    .select("role")
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

  if (membership.role !== "admin") {
    return { error: "Only admins can update the organization" };
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
    .select("role")
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

  if (membership.role !== "admin") {
    return { error: "Only admins can invite team members" };
  }

  if (isKillInvites()) {
    return { error: "Invitations are temporarily disabled." };
  }

  const existingMember = (await loadOrgMemberProfileRows(admin, orgId, {
    memberColumns: "id, user_id",
  })).find((member) => member.profiles?.email?.toLowerCase() === email);
  if (existingMember) {
    return { error: "This user is already a member of the organization." };
  }

  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();

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
    .select("role")
    .eq("organization_id", inv.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || membership.role !== "admin") {
    return { error: "Only admins can revoke invites" };
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
    .select("role")
    .eq("organization_id", inv.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || membership.role !== "admin") {
    return { error: "Only admins can resend invites" };
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
