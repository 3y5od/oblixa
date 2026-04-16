import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { ensureCronAuthorized } from "@/lib/v4/cron";

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;
const ORG_PAGE_SIZE = 500;
const ORG_MAX_SCAN = 10_000;

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
  const ids: string[] = [];
  for (let offset = 0; offset < ORG_MAX_SCAN; offset += ORG_PAGE_SIZE) {
    const { data, error } = await admin
      .from("organizations")
      .select("id")
      .order("id", { ascending: true })
      .range(offset, offset + ORG_PAGE_SIZE - 1);
    if (error) {
      console.error(`${V6_CRON_LOG_PREFIX} listOrganizationIds query error`, error);
      break;
    }
    const page = (data ?? []).map((row) => String(row.id)).filter(Boolean);
    ids.push(...page);
    if (page.length < ORG_PAGE_SIZE) break;
  }
  return ids;
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
