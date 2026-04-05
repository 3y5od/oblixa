import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const { data: existingMembership } = await supabase
        .from("organization_members")
        .select("id")
        .eq("user_id", data.user.id)
        .limit(1)
        .single();

      if (!existingMembership) {
        const fullName = data.user.user_metadata?.full_name;
        await supabase.rpc("create_user_org", {
          user_id: data.user.id,
          org_name: fullName
            ? `${fullName}'s Organization`
            : "My Organization",
        });
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
