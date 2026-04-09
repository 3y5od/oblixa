import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { ensureCronAuthorized } from "@/lib/v4/cron";

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

export function requireV5CronAuth(request: Request) {
  return ensureCronAuthorized(request);
}

export async function listOrganizationIds(admin: AdminClient): Promise<string[]> {
  const { data } = await admin.from("organizations").select("id").limit(200);
  return (data ?? []).map((row) => String(row.id));
}

export function cronErrorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

