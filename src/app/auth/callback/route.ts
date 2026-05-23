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
import {
  getUserPrimaryOrganizationId,
  resolveDestinationWithBlockingCalibration,
  resolvePostAuthRedirectPath,
} from "@/lib/auth/post-auth-redirect";
import { resolveBlockingCalibrationPathForAdminOrg } from "@/lib/onboarding/calibration-gate";

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

        await admin.from("organization_members").upsert(
          {
            organization_id: inv.organization_id,
            user_id: user.id,
            role,
          },
          { onConflict: "organization_id,user_id" }
        );

        await admin
          .from("organization_invites")
          .update({ consumed_at: new Date().toISOString() })
          .eq("id", inv.id);
        orgIdForLanding = inv.organization_id;
      } else {
        await ensureUserOrg(user.id, resolveDefaultOrganizationNameForUser(user));
        orgIdForLanding = await getUserPrimaryOrganizationId(admin, user.id);
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
