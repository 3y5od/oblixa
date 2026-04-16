import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { ensureCronAuthorized } from "@/lib/v4/cron";

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;
const ORG_PAGE_SIZE = 200;
const ORG_MAX_SCAN = 5_000;

export function requireV5CronAuth(request: Request) {
  return ensureCronAuthorized(request);
}

export async function listOrganizationIds(admin: AdminClient): Promise<string[]> {
  const ids: string[] = [];
  for (let offset = 0; offset < ORG_MAX_SCAN; offset += ORG_PAGE_SIZE) {
    const { data, error } = await admin
      .from("organizations")
      .select("id")
      .order("id", { ascending: true })
      .range(offset, offset + ORG_PAGE_SIZE - 1);
    if (error) console.error("[v5/cron] listOrganizationIds page query failed:", error.message);
    const page = (data ?? []).map((row) => String(row.id)).filter(Boolean);
    ids.push(...page);
    if (page.length < ORG_PAGE_SIZE) break;
  }
  return ids;
}

export function cronErrorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

