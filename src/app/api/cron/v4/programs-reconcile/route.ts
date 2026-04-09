import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { ensureCronAuthorized } from "@/lib/v4/cron";
import { RATE_LIMITS, rateLimitCheck } from "@/lib/rate-limit";
import { pingCronHealthcheck } from "@/lib/observability/cron-healthcheck";
import { recordAutomationEvent } from "@/lib/v4/automation-audit";
import { backfillAutoAttachPrograms } from "@/lib/v4/program-auto-attach";

export async function GET(request: Request) {
  const startedAt = Date.now();
  const unauthorized = ensureCronAuthorized(request);
  if (unauthorized) return unauthorized;
  const rate = await rateLimitCheck("cron:v4:programs-reconcile", RATE_LIMITS.v4ProgramReconcileCron);
  if (!rate.ok) {
    return NextResponse.json({ error: "Too many requests", retryAfterMs: rate.retryAfterMs }, { status: 429 });
  }

  const admin = await createAdminClient();
  const { data: programs } = await admin
    .from("contract_programs")
    .select("id, organization_id")
    .eq("state", "published")
    .limit(500);

  let fixed = 0;
  for (const program of programs ?? []) {
    const { data: latestVersion } = await admin
      .from("contract_program_versions")
      .select("id")
      .eq("organization_id", program.organization_id)
      .eq("program_id", program.id)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!latestVersion) continue;
    const { error } = await admin
      .from("contract_programs")
      .update({ current_version_id: latestVersion.id })
      .eq("id", program.id)
      .neq("current_version_id", latestVersion.id);
    if (!error) {
      fixed += 1;
      await recordAutomationEvent({
        admin,
        organizationId: program.organization_id,
        action: "programs_reconcile",
        entityType: "contract_program",
        entityId: program.id,
        details: { current_version_id: latestVersion.id },
      });
    }
  }

  const orgIds = [...new Set((programs ?? []).map((p) => p.organization_id as string))];
  let autoAttachScanned = 0;
  let autoAttachProgramsAttached = 0;
  for (const organizationId of orgIds.slice(0, 40)) {
    const r = await backfillAutoAttachPrograms({ admin, organizationId });
    autoAttachScanned += r.scanned;
    autoAttachProgramsAttached += r.attached;
  }

  const payload = {
    reconciledPrograms: fixed,
    autoAttachScanned,
    autoAttachProgramsAttached,
    ok: true,
    durationMs: Date.now() - startedAt,
  };
  pingCronHealthcheck("cron/v4/programs-reconcile", payload);
  return NextResponse.json(payload);
}
