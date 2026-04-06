"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getAppBaseUrl } from "@/lib/app-url";
import type { OrgRole } from "@/lib/types";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const fullName = formData.get("fullName") as string;

  const { error } = await admin
    .from("profiles")
    .update({ full_name: fullName || null })
    .eq("id", user.id);

  if (error) return { error: error.message };

  await supabase.auth.updateUser({
    data: { full_name: fullName },
  });

  return { success: true };
}

export async function updateOrganization(formData: FormData) {
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const orgId = formData.get("organizationId") as string;
  const name = (formData.get("name") as string)?.trim();

  if (!orgId || !name) return { error: "Organization name is required" };

  const { data: membership } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .single();

  if (membership?.role !== "admin") {
    return { error: "Only admins can update the organization" };
  }

  const { error } = await admin
    .from("organizations")
    .update({ name })
    .eq("id", orgId);

  if (error) return { error: error.message };

  return { success: true };
}

export async function inviteOrgMember(formData: FormData) {
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const orgId = formData.get("organizationId") as string;
  const email = ((formData.get("email") as string) || "").trim().toLowerCase();
  const role = (formData.get("role") as string) || "editor";

  if (!orgId) return { error: "Organization is required" };
  if (!email) return { error: "Email is required" };

  const validRoles: OrgRole[] = ["admin", "editor", "viewer"];
  if (!validRoles.includes(role as OrgRole)) {
    return { error: "Invalid role" };
  }

  const { data: membership } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .single();

  if (membership?.role !== "admin") {
    return { error: "Only admins can invite team members" };
  }

  const appUrl = getAppBaseUrl();

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: {
      invited_org_id: orgId,
      invited_role: role,
    },
    redirectTo: `${appUrl}/auth/callback`,
  });

  if (error) return { error: error.message };

  await admin.from("audit_events").insert({
    organization_id: orgId,
    contract_id: null,
    user_id: user.id,
    action: "member.invited",
    details: { email, role },
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

  if (error) return { error: error.message };

  return { success: true };
}
