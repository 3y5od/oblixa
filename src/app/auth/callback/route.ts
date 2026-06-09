import { NextResponse } from "next/server";
import {
  createClient,
  createAdminClient,
  ensureUserOrg,
  resolveDefaultOrganizationNameForUser,
} from "@/lib/supabase/server";
import { getSafeRedirectPath } from "@/lib/security/redirect";
import { getTrustedPublicOriginFromRequest } from "@/lib/security/trusted-forwarded";
import { isUuid } from "@/lib/security/validation";
import { hasEmailConfirmationSignal } from "@/lib/auth/email-confirmation";
import { recoverPendingOrganizationInviteForAuthenticatedUser } from "@/lib/auth/invite-recovery";
import {
  recoverApprovedWorkspaceAccessRequestForAuthenticatedUser,
  recoverWorkspaceAccessGrantForAuthenticatedUser,
  resolveApprovedAccessRequestWorkspaceName,
  type ApprovedAccessRequestRecoveryRow,
  type AccessGrantRow,
} from "@/lib/access-review";
import {
  getUserPrimaryOrganizationId,
  resolveDestinationWithBlockingCalibration,
  resolvePostAuthRedirectPath,
} from "@/lib/auth/post-auth-redirect";
import { resolveBlockingCalibrationPathForAdminOrg } from "@/lib/onboarding/calibration-gate";
import { evaluateSeatMutation } from "@/lib/billing/operational-entitlements";

async function resolveAccessGrantWorkspaceName(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  grant: AccessGrantRow,
  user: {
    user_metadata?: {
      full_name?: unknown;
      company_name?: unknown;
    } | null;
  }
): Promise<string> {
  const metadataName = resolveDefaultOrganizationNameForUser(user);
  if (metadataName !== "My Organization") return metadataName;
  if (!grant.request_id) return metadataName;

  const { data, error } = await admin
    .from("workspace_access_requests")
    .select("company_name, requester_name")
    .eq("id", grant.request_id)
    .maybeSingle();
  if (error || !data) return metadataName;

  const companyName =
    typeof (data as { company_name?: unknown }).company_name === "string"
      ? (data as { company_name: string }).company_name.trim()
      : "";
  if (companyName) return companyName;

  const requesterName =
    typeof (data as { requester_name?: unknown }).requester_name === "string"
      ? (data as { requester_name: string }).requester_name.trim()
      : "";
  return requesterName ? `${requesterName}'s Organization` : metadataName;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = getTrustedPublicOriginFromRequest(request);
  const code = searchParams.get("code");
  const next = getSafeRedirectPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const user = data.user;
      const meta = user.user_metadata as Record<string, unknown>;
      const inviteIdRaw = typeof meta.invite_id === "string" ? meta.invite_id : undefined;
      const accessGrantIdRaw =
        typeof meta.access_grant_id === "string" ? meta.access_grant_id : undefined;

      const admin = await createAdminClient();
      const emailLower = user.email?.trim().toLowerCase() ?? "";
      let orgIdForLanding: string | null = null;

      if (inviteIdRaw && isUuid(inviteIdRaw)) {
        const { data: inv, error: invErr } = await admin
          .from("organization_invites")
          .select("id, organization_id, email, role, expires_at, consumed_at, revoked_at")
          .eq("id", inviteIdRaw)
          .maybeSingle();

        if (
          invErr ||
          !inv ||
          inv.consumed_at ||
          inv.revoked_at ||
          new Date(inv.expires_at).getTime() < Date.now()
        ) {
          return NextResponse.redirect(`${origin}/login?error=invite_invalid`);
        }

        if (!emailLower || emailLower !== inv.email.toLowerCase()) {
          return NextResponse.redirect(`${origin}/login?error=invite_email_mismatch`);
        }

        const role =
          ["admin", "editor", "viewer"].includes(inv.role) ? inv.role : "editor";

        const { data: orgMembers, error: orgMembersErr } = await admin
          .from("organization_members")
          .select("user_id")
          .eq("organization_id", inv.organization_id);
        if (orgMembersErr || !Array.isArray(orgMembers)) {
          return NextResponse.redirect(`${origin}/login?error=invite_invalid`);
        }

        const existingMember = orgMembers.some(
          (member) => (member as { user_id?: unknown }).user_id === user.id
        );
        const seatDecision = evaluateSeatMutation({
          operation: "invite_accept",
          activeSeats: orgMembers.length,
          existingMember,
          sameTenant: true,
        });
        if (!seatDecision.allowed) {
          return NextResponse.redirect(`${origin}/login?error=invite_seat_limit`);
        }

        const { error: memberUpsertError } = await admin.from("organization_members").upsert(
          {
            organization_id: inv.organization_id,
            user_id: user.id,
            role,
          },
          { onConflict: "organization_id,user_id" }
        );
        if (memberUpsertError) {
          console.error("[auth/callback] invite membership upsert failed", memberUpsertError.message);
          return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
        }

        const consumeTimeIso = new Date().toISOString();
        const { data: consumedInvite, error: inviteConsumeError } = await admin
          .from("organization_invites")
          .update({ consumed_at: consumeTimeIso })
          .eq("id", inv.id)
          .is("consumed_at", null)
          .is("revoked_at", null)
          .gt("expires_at", consumeTimeIso)
          .select("id")
          .maybeSingle();
        if (inviteConsumeError || !consumedInvite?.id) {
          if (!existingMember) {
            await admin
              .from("organization_members")
              .delete()
              .eq("organization_id", inv.organization_id)
              .eq("user_id", user.id);
          }
          console.error("[auth/callback] invite consume failed", inviteConsumeError?.message);
          return NextResponse.redirect(`${origin}/login?error=invite_invalid`);
        }
        orgIdForLanding = inv.organization_id;
      } else {
        orgIdForLanding = await getUserPrimaryOrganizationId(admin, user.id);
        if (!orgIdForLanding) {
          let workspaceGrant: AccessGrantRow | null = null;
          let approvedAccessRequest: ApprovedAccessRequestRecoveryRow | null = null;
          let recoveredOrganizationInvite:
            | Awaited<ReturnType<typeof recoverPendingOrganizationInviteForAuthenticatedUser>>
            | null = null;
          if (accessGrantIdRaw && isUuid(accessGrantIdRaw)) {
            const { data: grant, error: grantErr } = await admin
              .from("workspace_access_grants")
              .select("id, request_id, normalized_email, status, expires_at, issued_by, used_by, used_at, revoked_at, created_at")
              .eq("id", accessGrantIdRaw)
              .maybeSingle();
            if (
              !grantErr &&
              grant &&
              grant.status === "used" &&
              grant.used_by === user.id &&
              emailLower &&
              grant.normalized_email === emailLower
            ) {
              workspaceGrant = grant as AccessGrantRow;
            }
          }

          if (!workspaceGrant && emailLower && hasEmailConfirmationSignal(user)) {
            const recovered = await recoverWorkspaceAccessGrantForAuthenticatedUser(admin, {
              email: emailLower,
              userId: user.id,
            });
            if (recovered.ok) {
              workspaceGrant = recovered.grant;
              await admin.auth.admin.updateUserById?.(user.id, {
                user_metadata: {
                  ...(user.user_metadata ?? {}),
                  access_grant_id: recovered.grant.id,
                },
              });
            }
            if (!recovered.ok) {
              const request = await recoverApprovedWorkspaceAccessRequestForAuthenticatedUser(admin, {
                email: emailLower,
              });
              if (request.ok) {
                approvedAccessRequest = request.request;
              }
            }
          }

          if (!workspaceGrant && !approvedAccessRequest && emailLower && hasEmailConfirmationSignal(user)) {
            const inviteRecovery = await recoverPendingOrganizationInviteForAuthenticatedUser(admin, {
              email: emailLower,
              userId: user.id,
            });
            if (inviteRecovery.ok) {
              recoveredOrganizationInvite = inviteRecovery;
            }
          }

          if (!workspaceGrant && !approvedAccessRequest && !recoveredOrganizationInvite?.ok) {
            return NextResponse.redirect(`${origin}/login?error=access_grant_required`);
          }

          let workspaceName: string;
          if (workspaceGrant) {
            workspaceName = await resolveAccessGrantWorkspaceName(admin, workspaceGrant, user);
          } else if (approvedAccessRequest) {
            workspaceName = resolveApprovedAccessRequestWorkspaceName(
              approvedAccessRequest,
              resolveDefaultOrganizationNameForUser(user)
            );
          } else if (recoveredOrganizationInvite?.ok) {
            orgIdForLanding = recoveredOrganizationInvite.organizationId;
            workspaceName = "";
          } else {
            return NextResponse.redirect(`${origin}/login?error=access_grant_required`);
          }
          if (!orgIdForLanding) {
            await ensureUserOrg(user.id, workspaceName, admin);
            orgIdForLanding = await getUserPrimaryOrganizationId(admin, user.id);
          }
          if (!orgIdForLanding) {
            return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
          }
        }
      }

      const destination = await resolvePostAuthRedirectPath(admin, orgIdForLanding, next);
      const calibrationPath = await resolveBlockingCalibrationPathForAdminOrg({
        admin,
        userId: user.id,
        orgId: orgIdForLanding,
      });
      const finalDestination = resolveDestinationWithBlockingCalibration(destination, calibrationPath);
      return NextResponse.redirect(`${origin}${finalDestination}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
