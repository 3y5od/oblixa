import { NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/v4/api-auth";

export async function GET() {
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await ctx.admin
    .from("role_command_center_preferences")
    .select("id, role, preferences_json, updated_at")
    .eq("organization_id", ctx.orgId)
    .eq("user_id", ctx.userId)
    .eq("role", ctx.role)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ preferences: data ?? null });
}

export async function POST(request: Request) {
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { preferences?: Record<string, unknown> };
  const { data, error } = await ctx.admin
    .from("role_command_center_preferences")
    .upsert(
      {
        organization_id: ctx.orgId,
        user_id: ctx.userId,
        role: ctx.role,
        preferences_json: body.preferences ?? {},
      },
      {
        onConflict: "organization_id,user_id,role",
        ignoreDuplicates: false,
      }
    )
    .select("id, role, preferences_json, updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ preferences: data });
}
