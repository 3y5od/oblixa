import type { AdminClient } from "@/lib/assurance/service";
import { evaluateSeatMutation } from "@/lib/billing/operational-entitlements";
import { isReasonableEmail } from "@/lib/security/validation";
import type { OrgRole } from "@/lib/types";

export type OrganizationInviteRecoveryRow = {
  id: string;
  organization_id: string;
  email: string;
  role: string | null;
  expires_at: string;
  consumed_at: string | null;
  revoked_at: string | null;
};

export type OrganizationInviteRecoveryResult =
  | { ok: true; organizationId: string; role: OrgRole; inviteId: string }
  | {
      ok: false;
      error:
        | "invalid_email"
        | "invite_not_found"
        | "invite_ambiguous"
        | "invite_expired_or_closed"
        | "invite_lookup_failed"
        | "seat_lookup_failed"
        | "seat_limit_reached"
        | "membership_insert_failed"
        | "invite_consume_failed";
    };

function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeInviteRole(role: string | null | undefined): OrgRole {
  return role === "admin" || role === "viewer" || role === "editor" ? role : "editor";
}

async function acceptOrganizationInvite(
  admin: AdminClient,
  invite: OrganizationInviteRecoveryRow,
  input: { userId: string; nowIso: string }
): Promise<OrganizationInviteRecoveryResult> {
  if (invite.consumed_at || invite.revoked_at || new Date(invite.expires_at).getTime() <= Date.parse(input.nowIso)) {
    return { ok: false, error: "invite_expired_or_closed" };
  }

  const { data: orgMembers, error: orgMembersErr } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", invite.organization_id);
  if (orgMembersErr || !Array.isArray(orgMembers)) {
    return { ok: false, error: "seat_lookup_failed" };
  }

  const existingMember = orgMembers.some((member) => (member as { user_id?: unknown }).user_id === input.userId);
  const seatDecision = evaluateSeatMutation({
    operation: "invite_accept",
    activeSeats: orgMembers.length,
    existingMember,
    sameTenant: true,
  });
  if (!seatDecision.allowed) {
    return { ok: false, error: "seat_limit_reached" };
  }

  const role = normalizeInviteRole(invite.role);
  const { error: memberUpsertError } = await admin.from("organization_members").upsert(
    {
      organization_id: invite.organization_id,
      user_id: input.userId,
      role,
    },
    { onConflict: "organization_id,user_id" }
  );
  if (memberUpsertError) {
    return { ok: false, error: "membership_insert_failed" };
  }

  const { data: consumedInvite, error: inviteConsumeError } = await admin
    .from("organization_invites")
    .update({ consumed_at: input.nowIso })
    .eq("id", invite.id)
    .is("consumed_at", null)
    .is("revoked_at", null)
    .gt("expires_at", input.nowIso)
    .select("id")
    .maybeSingle();
  if (inviteConsumeError || !consumedInvite?.id) {
    if (!existingMember) {
      await admin
        .from("organization_members")
        .delete()
        .eq("organization_id", invite.organization_id)
        .eq("user_id", input.userId);
    }
    return { ok: false, error: "invite_consume_failed" };
  }

  return {
    ok: true,
    organizationId: invite.organization_id,
    role,
    inviteId: invite.id,
  };
}

export async function recoverPendingOrganizationInviteForAuthenticatedUser(
  admin: AdminClient,
  input: { email: string; userId: string; now?: Date }
): Promise<OrganizationInviteRecoveryResult> {
  const email = normalizeInviteEmail(input.email);
  if (!isReasonableEmail(email)) return { ok: false, error: "invalid_email" };

  const userId = input.userId.trim();
  if (!userId) return { ok: false, error: "invite_not_found" };

  const nowIso = (input.now ?? new Date()).toISOString();
  const { data, error } = await admin
    .from("organization_invites")
    .select("id, organization_id, email, role, expires_at, consumed_at, revoked_at")
    .eq("email", email)
    .is("consumed_at", null)
    .is("revoked_at", null)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(2);
  if (error) return { ok: false, error: "invite_lookup_failed" };

  const invites = Array.isArray(data) ? (data as OrganizationInviteRecoveryRow[]) : [];
  if (invites.length === 0) return { ok: false, error: "invite_not_found" };
  if (invites.length > 1) return { ok: false, error: "invite_ambiguous" };

  const invite = invites[0];
  if (normalizeInviteEmail(invite.email) !== email) {
    return { ok: false, error: "invite_not_found" };
  }

  return acceptOrganizationInvite(admin, invite, { userId, nowIso });
}
