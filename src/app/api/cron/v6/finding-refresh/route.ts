import { NextResponse } from "next/server";
import { RATE_LIMITS, rateLimitCheck } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/server";
import { requireV6CronFeature } from "@/lib/v6/feature-guards";
import { listOrganizationIds, requireV6CronAuth, v6CronRunMetadata } from "@/lib/v6/cron";
import { refreshFindingsAging } from "@/lib/v6/cron-jobs";

export async function GET(request: Request) {
  const unauthorized = requireV6CronAuth(request);
  if (unauthorized) return unauthorized;
  const rate = await rateLimitCheck("cron:v6:finding-refresh", RATE_LIMITS.v6CronDefault);
  if (!rate.ok) {
    return NextResponse.json({ error: "Too many requests", retryAfterMs: rate.retryAfterMs }, { status: 429 });
  }

  const skipped = requireV6CronFeature("v6AssuranceCore");
  if (skipped) return skipped;

  const t0 = Date.now();
  const admin = await createAdminClient();
  const orgIds = await listOrganizationIds(admin);
  const result = await refreshFindingsAging(admin);
  return NextResponse.json({
    ok: true,
    updated: result.updated,
    ...v6CronRunMetadata(orgIds.length, t0, 0),
  });
}
