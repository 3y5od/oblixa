import { NextResponse } from "next/server";
import {
  createClient,
  createAdminClient,
  ensureUserOrg,
} from "@/lib/supabase/server";
import { getSafeRedirectPath } from "@/lib/security/redirect";
import { isUuid } from "@/lib/security/validation";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = getSafeRedirectPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const user = data.user;
      const meta = user.user_metadata as Record<string, unknown>;
      const inviteIdRaw = typeof meta.invite_id === "string" ? meta.invite_id : undefined;
      const invitedOrgId =
        typeof meta.invited_org_id === "string" ? meta.invited_org_id : undefined;
      const invitedRoleRaw =
        typeof meta.invited_role === "string" ? meta.invited_role : "editor";

      const admin = await createAdminClient();
      const emailLower = user.email?.trim().toLowerCase() ?? "";

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
      } else if (
        invitedOrgId &&
        isUuid(invitedOrgId) &&
        ["admin", "editor", "viewer"].includes(invitedRoleRaw)
      ) {
        await admin.from("organization_members").upsert(
          {
            organization_id: invitedOrgId,
            user_id: user.id,
            role: invitedRoleRaw,
          },
          { onConflict: "organization_id,user_id" }
        );
      } else {
        const fullName = user.user_metadata?.full_name;
        await ensureUserOrg(
          user.id,
          fullName ? `${fullName}'s Organization` : "My Organization"
        );
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
