import type { createAdminClient } from "@/lib/supabase/server";
import type { OrgRole } from "@/lib/types";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";
import { isWorkspaceAdminRole } from "@/lib/roles";

export const MAX_PROFILE_NAME_LEN = 200;
export const MAX_ORG_NAME_LEN = 200;
export const MAX_INVITE_EMAIL_LEN = 254;
// Workspace-invite grants expire after 14 days (release-state: Access Review
// And Grants — email-bound, single-use, revocable, expires after 14 days).
export const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
export const VALID_INVITE_ROLES: OrgRole[] = ["admin", "editor", "viewer"];

export type SettingsActionResult = {
  error?: string;
  success?: true;
  /** Set when a sensitive action (e.g. ownership transfer) needs fresh step-up
   *  proof; the client routes the user through re-auth and retries. */
  needStepUp?: true;
};

export type MembershipPermissionRow = {
  role?: string | null;
  organizations?: { owner_user_id?: string | null } | null;
};

export function canManageTeamOrWorkspace(
  row: MembershipPermissionRow | null | undefined,
  userId: string
): boolean {
  return isWorkspaceAdminRole(row?.role, {
    isWorkspaceOwner: row?.organizations?.owner_user_id === userId,
  });
}

type PendingInviteSeatRow = {
  id: string;
  email: string;
  expires_at: string;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "Unknown error");
}

export async function recoverSettingsAction(
  scope: string,
  run: () => Promise<SettingsActionResult>
): Promise<SettingsActionResult> {
  try {
    return await run();
  } catch (error) {
    console.error(`[settings] ${scope} failed`, error);
    return { error: describeRecoverableMutationError(errorMessage(error)) };
  }
}

export async function safeInsertSettingsAuditEvent(
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

export async function loadPendingInviteSeatRows(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  orgId: string,
  nowIso: string
): Promise<{ rows: PendingInviteSeatRow[]; error: boolean }> {
  const { data, error } = await admin
    .from("organization_invites")
    .select("id, email, expires_at")
    .eq("organization_id", orgId)
    .is("consumed_at", null)
    .is("revoked_at", null)
    .gt("expires_at", nowIso);

  if (error || !Array.isArray(data)) return { rows: [], error: true };
  return {
    rows: data.flatMap((row) => {
      const invite = row as Partial<PendingInviteSeatRow>;
      return typeof invite.id === "string" &&
        typeof invite.email === "string" &&
        typeof invite.expires_at === "string"
        ? [{ id: invite.id, email: invite.email, expires_at: invite.expires_at }]
        : [];
    }),
    error: false,
  };
}

/** Supabase rejects admin invite-by-email when the address already exists in Auth. */
export function isExistingAuthUserInviteConflict(message: string): boolean {
  const m = message.toLowerCase();
  if (m.includes("already been registered")) return true;
  if (m.includes("user already registered")) return true;
  if (m.includes("users_email_partial_key")) return true;
  if (m.includes("duplicate key") && m.includes("users") && m.includes("email")) return true;
  return false;
}
