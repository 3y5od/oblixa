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

  const rate = await rateLimitCheck("cron:v4:attestations-issue", RATE_LIMITS.v4AttestationsIssueCron);
  if (!rate.ok) {
    return NextResponse.json({ error: "Too many requests", retryAfterMs: rate.retryAfterMs }, { status: 429 });
  }

  const admin = await createAdminClient();
  const now = new Date().toISOString();
  const { data: requests } = await admin
    .from("attestation_requests")
    .select("id, organization_id, contract_id")
    .in("status", ["open", "overdue"])
    .lte("due_at", now)
    .limit(500);

  if ((requests?.length ?? 0) > 0) {
    await admin
      .from("attestation_requests")
      .update({ status: "overdue", last_reminded_at: now })
      .in("id", (requests ?? []).map((r) => r.id));
  }
  const orgIds = new Set((requests ?? []).map((row) => row.organization_id));
  for (const orgId of orgIds) {
    await recordAutomationEvent({
      admin,
      organizationId: orgId,
      action: "attestations_issue",
      details: { overdueMarked: requests?.length ?? 0 },
    });
  }

  const payload = { issued: requests?.length ?? 0, ok: true, durationMs: Date.now() - startedAt };
  pingCronHealthcheck("cron/v4/attestations-issue", payload);
  return NextResponse.json(payload);
}
