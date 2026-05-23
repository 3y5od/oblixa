"use server";

import { createClient, createAdminClient, getAuthContext } from "@/lib/supabase/server";
import { recordSecurityAuditEvent } from "@/lib/security/audit-write";
import { hasSensitiveActionProof } from "@/lib/security/sensitive-action-proof";
import { mapAuthError } from "@/lib/errors/user-facing";
import { revalidatePath } from "next/cache";

// SPEC: docs/security-page-v4-pass.md §1.2 — Supabase exposes
// `session.expires_at` (epoch seconds) but no creation timestamp.
// We surface expiresAt separately so the panel can render
// "EXPIRES in 3h" context instead of an ambiguous timestamp.
export type SessionSummary = {
  id: string;
  current: boolean;
  userAgent: string | null;
  createdAt: string | null;
  expiresAt: string | null;
};

export async function listMySessions(): Promise<
  { sessions: SessionSummary[] } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { session },
    error: sessErr,
  } = await supabase.auth.getSession();
  if (sessErr || !session) return { error: "Not authenticated" };

  const expiresAt =
    typeof session.expires_at === "number"
      ? new Date(session.expires_at * 1000).toISOString()
      : null;

  return {
    sessions: [
      {
        id: "current",
        current: true,
        userAgent: null,
        // Supabase doesn't expose session creation time; null by design.
        createdAt: null,
        expiresAt,
      },
    ],
  };
}

export async function revokeOtherSessions() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const };
  if (!(await hasSensitiveActionProof(supabase, user.id))) {
    try {
      const admin = await createAdminClient();
      const ctx = await getAuthContext();
      if (ctx?.orgId) {
        void recordSecurityAuditEvent(admin, {
          organizationId: ctx.orgId,
          actorUserId: user.id,
          action: "security.sessions_revoke_others",
          targetType: "user",
          targetId: user.id,
          outcome: "forbidden",
          safeMetadata: { reason: "sensitive_action_proof_required" },
        });
      }
    } catch {
      // audit is best-effort on denial
    }
    return {
      error: "Confirm your password or complete MFA before revoking other sessions.",
      needStepUp: true as const,
    };
  }

  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) return { error: mapAuthError(error.message) };

  const admin = await createAdminClient();
  const ctx = await getAuthContext();
  if (ctx?.orgId) {
    void recordSecurityAuditEvent(admin, {
      organizationId: ctx.orgId,
      actorUserId: user.id,
      action: "security.sessions_revoke_others",
      targetType: "user",
      targetId: user.id,
      outcome: "success",
      safeMetadata: {},
    });
  }

  revalidatePath("/settings/security");
  return { success: true as const };
}
