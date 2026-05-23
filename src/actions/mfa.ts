"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient, getAuthContext } from "@/lib/supabase/server";
import { recordSecurityAuditEvent } from "@/lib/security/audit-write";
import { hasSensitiveActionProof } from "@/lib/security/sensitive-action-proof";
import { isUuid } from "@/lib/security/validation";
import { mapAuthError, mapDataSourceError } from "@/lib/errors/user-facing";

// SPEC: security-page-maximal-pass §1.40 — discriminated-union
// result shape so the client panel can narrow on `needStepUp` and
// surface a contextual prompt (per §1.33) instead of a generic
// error. All MFA server actions return this shape (or a richer
// subtype that extends success).
export type MfaActionError = {
  error: string;
  needStepUp?: boolean;
};
export type MfaActionResult = MfaActionError | { success: true };

async function recordMfaDeniedAudit(userId: string, action: "security.mfa_totp_unenrolled" | "security.org_mfa_required_updated", targetId: string) {
  try {
    const admin = await createAdminClient();
    const ctx = await getAuthContext();
    if (!ctx?.orgId) return;
    void recordSecurityAuditEvent(admin, {
      organizationId: ctx.orgId,
      actorUserId: userId,
      action,
      targetType: action === "security.org_mfa_required_updated" ? "organization" : "user",
      targetId,
      outcome: "forbidden",
      safeMetadata: { reason: "sensitive_action_proof_required" },
    });
  } catch {
    // audit is best-effort on denial
  }
}

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
  if (error || !data) return { error: error ? mapAuthError(error.message) : "Enrollment failed" as const };

  // SPEC: security-page-maximal-pass §1.34 — emit audit event when
  // enrollment starts. The verify step has its own emission; this
  // closes the audit gap on the start-flow.
  try {
    const admin = await createAdminClient();
    const ctx = await getAuthContext();
    if (ctx?.orgId) {
      void recordSecurityAuditEvent(admin, {
        organizationId: ctx.orgId,
        actorUserId: user.id,
        action: "security.mfa_totp_enrollment_started",
        targetType: "user",
        targetId: user.id,
        outcome: "success",
        safeMetadata: { factorId: data.id },
      });
    }
  } catch {
    // audit is best-effort
  }

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
  if (error) return { error: mapAuthError(error.message) };

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
  if (!(await hasSensitiveActionProof(supabase, user.id))) {
    await recordMfaDeniedAudit(user.id, "security.mfa_totp_unenrolled", user.id);
    return {
      error: "Confirm your password or complete MFA before removing an authenticator factor.",
      needStepUp: true as const,
    };
  }

  const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
  if (error) return { error: mapAuthError(error.message) };

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
  if (!(await hasSensitiveActionProof(supabase, user.id))) {
    await recordMfaDeniedAudit(user.id, "security.org_mfa_required_updated", orgId);
    return {
      error: "Confirm your password or complete MFA before changing the organization MFA policy.",
      needStepUp: true as const,
    };
  }

  const { error } = await admin.from("organizations").update({ mfa_required: input.required }).eq("id", orgId);
  if (error) return { error: mapDataSourceError(error.message) };

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
