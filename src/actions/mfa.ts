"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient, getAuthContext } from "@/lib/supabase/server";
import { recordSecurityAuditEvent } from "@/lib/security/audit-write";
import { isUuid } from "@/lib/security/validation";

export async function startTotpEnrollment() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const };

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Authenticator app",
  });
  if (error || !data) return { error: error?.message ?? "Enrollment failed" as const };

  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri,
  };
}

export async function verifyTotpEnrollment(input: { factorId: string; code: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const };
  const factorId = input.factorId.trim();
  const code = input.code.trim().replace(/\s/g, "");
  if (!factorId || !code) return { error: "Missing factor or code" as const };

  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code,
  });
  if (error) return { error: error.message };

  const admin = await createAdminClient();
  const ctx = await getAuthContext();
  if (ctx?.orgId) {
    void recordSecurityAuditEvent(admin, {
      organizationId: ctx.orgId,
      actorUserId: user.id,
      action: "security.mfa_totp_verified",
      targetType: "user",
      targetId: user.id,
      outcome: "success",
      safeMetadata: { factorId },
    });
  }

  revalidatePath("/settings/security");
  return { success: true as const };
}

export async function unenrollTotpFactor(factorId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const };
  const id = factorId.trim();
  if (!id) return { error: "Missing factor" as const };

  const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
  if (error) return { error: error.message };

  const admin = await createAdminClient();
  const ctx = await getAuthContext();
  if (ctx?.orgId) {
    void recordSecurityAuditEvent(admin, {
      organizationId: ctx.orgId,
      actorUserId: user.id,
      action: "security.mfa_totp_unenrolled",
      targetType: "user",
      targetId: user.id,
      outcome: "success",
      safeMetadata: { factorId: id },
    });
  }

  revalidatePath("/settings/security");
  return { success: true as const };
}

export async function updateOrganizationMfaRequired(input: {
  organizationId: string;
  required: boolean;
}) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const };
  const orgId = input.organizationId.trim();
  if (!isUuid(orgId)) return { error: "Invalid organization" as const };

  const { data: row } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (row?.role !== "admin") return { error: "Only admins can change this policy" as const };

  const { error } = await admin.from("organizations").update({ mfa_required: input.required }).eq("id", orgId);
  if (error) return { error: error.message };

  void recordSecurityAuditEvent(admin, {
    organizationId: orgId,
    actorUserId: user.id,
    action: "security.org_mfa_required_updated",
    targetType: "organization",
    targetId: orgId,
    outcome: "success",
    safeMetadata: { required: input.required },
  });

  revalidatePath("/settings/security");
  revalidatePath("/settings");
  return { success: true as const };
}
