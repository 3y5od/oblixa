import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { buildOrganizationCalendarIcs } from "@/lib/integrations/calendar";

export async function GET() {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: membership } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }

  const body = await buildOrganizationCalendarIcs(admin, membership.organization_id);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="contractops-calendar.ics"',
    },
  });
}
