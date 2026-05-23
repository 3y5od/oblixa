"use server";

import { createClient, createAdminClient, getAuthContext } from "@/lib/supabase/server";
import { recordSecurityAuditEvent } from "@/lib/security/audit-write";
import { mapAuthError } from "@/lib/errors/user-facing";

// SPEC: docs/security-page-v4-pass.md §5.2 — resend email
// verification when ctx.user.email_confirmed_at is null. Powers
// the inline "Resend verification" CTA in the Resources card
// EMAIL STATUS row.
//
// Uses Supabase auth.resend with type "signup" (the canonical
// path for re-sending the initial confirmation email).

export type ResendVerificationResult =
  | { success: true }
  | { error: string };

export async function resendEmailVerification(): Promise<ResendVerificationResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return { error: "Not authenticated" };
  if (!user.email) return { error: "No email on this account" };
  if (user.email_confirmed_at) {
    return { error: "Email is already verified" };
  }

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: user.email,
  });
  if (error) return { error: mapAuthError(error.message) };

  // Best-effort audit emission.
  try {
    const admin = await createAdminClient();
    const ctx = await getAuthContext();
    if (ctx?.orgId) {
      void recordSecurityAuditEvent(admin, {
        organizationId: ctx.orgId,
        actorUserId: user.id,
        action: "security.email_verification_resent",
        targetType: "user",
        targetId: user.id,
        outcome: "success",
        safeMetadata: {},
      });
    }
  } catch {
    // audit is best-effort
  }

  return { success: true };
}
