import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { ensureCronAuthorized } from "@/lib/v4/cron";
import { RATE_LIMITS, rateLimitCheck } from "@/lib/rate-limit";
import { pingCronHealthcheck } from "@/lib/observability/cron-healthcheck";
import { recordAutomationEvent } from "@/lib/v4/automation-audit";

export async function GET(request: Request) {
  const startedAt = Date.now();
  const unauthorized = ensureCronAuthorized(request);
  if (unauthorized) return unauthorized;
  const rate = await rateLimitCheck(
    "cron:v4:renewals-recompute-signals",
    RATE_LIMITS.v4RenewalSignalsCron
  );
  if (!rate.ok) {
    return NextResponse.json({ error: "Too many requests", retryAfterMs: rate.retryAfterMs }, { status: 429 });
  }

  const admin = await createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: rows } = await admin
    .from("contract_renewal_checkpoints")
    .select("id, organization_id, contract_id")
    .eq("status", "pending")
    .lt("due_date", today)
    .limit(1000);

  if ((rows?.length ?? 0) > 0) {
    await admin
      .from("contract_renewal_checkpoints")
      .update({ renewal_state: "slipped" })
      .in("id", (rows ?? []).map((r) => r.id));
    for (const row of rows ?? []) {
      await recordAutomationEvent({
        admin,
        organizationId: row.organization_id,
        contractId: row.contract_id,
        action: "renewal_signals_recompute",
        entityType: "renewal_checkpoint",
        entityId: row.id,
        details: { renewal_state: "slipped" },
      });
    }
  }

  const payload = { updatedSignals: rows?.length ?? 0, ok: true, durationMs: Date.now() - startedAt };
  pingCronHealthcheck("cron/v4/renewals-recompute-signals", payload);
  return NextResponse.json(payload);
}
