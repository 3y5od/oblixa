import { NextResponse } from "next/server";
import { createClient, ensureUserOrg } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const fullName = data.user.user_metadata?.full_name;
      await ensureUserOrg(
        data.user.id,
        fullName ? `${fullName}'s Organization` : "My Organization"
      );

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
