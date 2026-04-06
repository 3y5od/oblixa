import { NextResponse } from "next/server";
import {
  createClient,
  createAdminClient,
  ensureUserOrg,
} from "@/lib/supabase/server";

function getSafeRedirectPath(raw: string | null): string {
  const fallback = "/dashboard";
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) {
    return fallback;
  }
  return raw;
}

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
      const invitedOrgId =
        typeof meta.invited_org_id === "string" ? meta.invited_org_id : undefined;
      const invitedRoleRaw =
        typeof meta.invited_role === "string" ? meta.invited_role : "editor";

      if (
        invitedOrgId &&
        ["admin", "editor", "viewer"].includes(invitedRoleRaw)
      ) {
        const admin = await createAdminClient();
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
