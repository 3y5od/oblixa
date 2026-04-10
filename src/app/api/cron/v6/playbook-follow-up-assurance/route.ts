import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireV6CronFeature } from "@/lib/v6/feature-guards";
import { listOrganizationIds, requireV6CronAuth, v6CronRunMetadata } from "@/lib/v6/cron";
import { runPlaybookFollowUpAssurancePasses } from "@/lib/v6/cron-jobs";

export async function GET(request: Request) {
  const unauthorized = requireV6CronAuth(request);
  if (unauthorized) return unauthorized;

  const skipped = requireV6CronFeature("v6AssuranceCore");
  if (skipped) return skipped;

  const t0 = Date.now();
  const admin = await createAdminClient();
  const orgIds = await listOrganizationIds(admin);
  const { assuranceRuns } = await runPlaybookFollowUpAssurancePasses(admin);
  return NextResponse.json({
    ok: true,
    assuranceRuns,
    ...v6CronRunMetadata(orgIds.length, t0, 0),
  });
}
