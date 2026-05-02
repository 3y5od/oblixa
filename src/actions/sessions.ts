"use server";

import { createClient, createAdminClient, getAuthContext } from "@/lib/supabase/server";
import { recordSecurityAuditEvent } from "@/lib/security/audit-write";

export type SessionSummary = {
  id: string;
  current: boolean;
  userAgent: string | null;
  createdAt: string | null;
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

  return {
    sessions: [
      {
        id: "current",
        current: true,
        userAgent: null,
        createdAt:
          typeof session.expires_at === "number"
            ? new Date(session.expires_at * 1000).toISOString()
            : null,
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

  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) return { error: error.message };

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

  return { success: true as const };
}
