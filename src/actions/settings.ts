"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { resolveAppBaseUrl } from "@/lib/app-url";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import type { OrgRole } from "@/lib/types";
import { isReasonableEmail, isUuid } from "@/lib/security/validation";
import {
  getClientIpFromHeaders,
  rateLimitCheck,
  RATE_LIMITS,
} from "@/lib/rate-limit";

const MAX_PROFILE_NAME_LEN = 200;
const MAX_ORG_NAME_LEN = 200;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const fullName = ((formData.get("fullName") as string) || "")
    .trim()
    .slice(0, MAX_PROFILE_NAME_LEN);

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

  return { success: true };
}

export async function updateOrganization(formData: FormData) {
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const orgId = (formData.get("organizationId") as string)?.trim() ?? "";
  const name = (formData.get("name") as string)?.trim().slice(0, MAX_ORG_NAME_LEN) ?? "";

  if (!orgId || !name) return { error: "Organization name is required" };
  if (!isUuid(orgId)) return { error: "Invalid organization" };

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

  return { success: true };
}

export async function inviteOrgMember(formData: FormData) {
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

  const orgId = (formData.get("organizationId") as string)?.trim() ?? "";
  const email = ((formData.get("email") as string) || "").trim().toLowerCase();
  const role = (formData.get("role") as string) || "editor";

  if (!orgId) return { error: "Organization is required" };
  if (!isUuid(orgId)) return { error: "Invalid organization" };
  if (!email) return { error: "Email is required" };
  if (!isReasonableEmail(email)) {
    return { error: "Invalid email address" };
  }

  const validRoles: OrgRole[] = ["admin", "editor", "viewer"];
  if (!validRoles.includes(role as OrgRole)) {
    return { error: "Invalid role" };
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

  const { data: existingMember } = await admin
    .from("organization_members")
    .select("id, profiles!inner(email)")
    .eq("organization_id", orgId)
    .eq("profiles.email", email)
    .maybeSingle();
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

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: {
      invite_id: inviteRow.id,
    },
    redirectTo: `${appUrl}/auth/callback`,
  });

  if (error) {
    await admin.from("organization_invites").delete().eq("id", inviteRow.id);
    return { error: mapDataSourceError(error.message) };
  }

  await admin.from("audit_events").insert({
    organization_id: orgId,
    contract_id: null,
    user_id: user.id,
    action: "member.invited",
    details: { email, role },
  });

  return { success: true };
}

export async function revokeOrgInvite(inviteId: string) {
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

  await admin.from("audit_events").insert({
    organization_id: inv.organization_id,
    contract_id: null,
    user_id: user.id,
    action: "member.invite_revoked",
    details: { invite_id: inviteId },
  });

  return { success: true };
}

export async function resendOrgInvite(inviteId: string) {
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

  const { error } = await admin.auth.admin.inviteUserByEmail(inv.email, {
    data: {
      invite_id: inviteId,
    },
    redirectTo: `${appUrl}/auth/callback`,
  });

  if (error) return { error: mapDataSourceError(error.message) };

  await admin.from("audit_events").insert({
    organization_id: inv.organization_id,
    contract_id: null,
    user_id: user.id,
    action: "member.invite_resent",
    details: { invite_id: inviteId, email: inv.email },
  });

  return { success: true };
}

export async function completeProductOnboarding() {
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

  return { success: true };
}
