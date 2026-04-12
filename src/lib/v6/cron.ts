import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { ensureCronAuthorized } from "@/lib/v4/cron";

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

/** Grep-friendly prefix for V6 cron routes in host logs (`[cron:v6] job phase`). */
export const V6_CRON_LOG_PREFIX = "[cron:v6]";

export function logV6Cron(job: string, phase: string, detail?: Record<string, unknown>) {
  const suffix = detail && Object.keys(detail).length > 0 ? ` ${JSON.stringify(detail)}` : "";
  console.info(`${V6_CRON_LOG_PREFIX} ${job} ${phase}${suffix}`);
}

export function requireV6CronAuth(request: Request) {
  return ensureCronAuthorized(request);
}

export async function listOrganizationIds(admin: AdminClient): Promise<string[]> {
  // FUTURE: paginate past 500 for full-table stale sweeps when operator SLO requires it.
  const { data } = await admin.from("organizations").select("id").limit(500);
  return (data ?? []).map((row) => String(row.id));
}

export function cronErrorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Non-breaking extras on V6 cron JSON for operators (canary scripts only require older keys). */
export function v6CronRunMetadata(orgsProcessed: number, startedAtMs: number, errorsCount = 0) {
  return {
    duration_ms: Date.now() - startedAtMs,
    orgs_processed: orgsProcessed,
    errors_count: errorsCount,
  };
}
