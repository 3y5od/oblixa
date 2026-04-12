import { NextResponse } from "next/server";
import { RATE_LIMITS, rateLimitCheck } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/server";
import { requireV6CronFeature } from "@/lib/v6/feature-guards";
import {
  listOrganizationIds,
  logV6Cron,
  requireV6CronAuth,
  v6CronRunMetadata,
} from "@/lib/v6/cron";
import { runAssuranceChecksForAllOrgs } from "@/lib/v6/cron-jobs";

export async function GET(request: Request) {
  const unauthorized = requireV6CronAuth(request);
  if (unauthorized) return unauthorized;
  const rate = await rateLimitCheck("cron:v6:assurance-checks", RATE_LIMITS.v6CronDefault);
  if (!rate.ok) {
    return NextResponse.json({ error: "Too many requests", retryAfterMs: rate.retryAfterMs }, { status: 429 });
  }

  const skipped = requireV6CronFeature("v6AssuranceCore");
  if (skipped) return skipped;

  const t0 = Date.now();
  const admin = await createAdminClient();
  const orgIds = await listOrganizationIds(admin);
  logV6Cron("assurance-checks", "batch_start", { orgs: orgIds.length });
  const result = await runAssuranceChecksForAllOrgs(admin);
  const meta = v6CronRunMetadata(orgIds.length, t0, Math.max(0, orgIds.length - result.checkRuns));
  logV6Cron("assurance-checks", "batch_complete", { checkRuns: result.checkRuns, ...meta });
  return NextResponse.json({
    ok: true,
    checkRuns: result.checkRuns,
    ...meta,
  });
}
