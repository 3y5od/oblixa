import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { ensureCronAuthorized } from "@/lib/v4/cron";
import { RATE_LIMITS, rateLimitCheck } from "@/lib/rate-limit";
import { pingCronHealthcheck } from "@/lib/observability/cron-healthcheck";
import { upsertDetectedExceptions } from "@/lib/v4/exceptions";
export async function GET(request: Request) {
  const startedAt = Date.now();
  const unauthorized = ensureCronAuthorized(request);
  if (unauthorized) return unauthorized;
  const rate = await rateLimitCheck("cron:v4:evidence-followup", RATE_LIMITS.v4EvidenceFollowupCron);
  if (!rate.ok) {
    return NextResponse.json({ error: "Too many requests", retryAfterMs: rate.retryAfterMs }, { status: 429 });
  }

  const admin = await createAdminClient();
  const today = new Date().toISOString();
  const { data: requirements } = await admin
    .from("evidence_requirements")
    .select("id, organization_id, contract_id")
    .in("status", ["required", "submitted", "rejected"])
    .lte("due_at", today)
    .limit(400);

  const { touched } = await upsertDetectedExceptions({
    admin,
    detector: "cron:v4:evidence-followup",
    rows: (requirements ?? []).map((row) => ({
      organizationId: row.organization_id,
      contractId: row.contract_id,
      linkedEntityType: "evidence_requirement",
      linkedEntityId: row.id,
      exceptionType: "stale_evidence",
      title: "Stale evidence requirement",
      severity: "medium",
      details: "Evidence requirement reached due date without approval.",
    })),
  });
  const orgIds = [...new Set((requirements ?? []).map((row) => row.organization_id))].filter(
    Boolean
  ) as string[];
  const reviewed = requirements?.length ?? 0;
  if (orgIds.length > 0) {
    await admin.from("audit_events").insert(
      orgIds.map((organizationId) => ({
        organization_id: organizationId,
        contract_id: null,
        user_id: null,
        action: "automation.evidence_followup",
        details: { reviewed, exceptionsTouched: touched },
      }))
    );
  }

  const payload = {
    reviewed: requirements?.length ?? 0,
    exceptionsCreated: touched,
    ok: true,
    durationMs: Date.now() - startedAt,
  };
  pingCronHealthcheck("cron/v4/evidence-followup", payload);
  return NextResponse.json(payload);
}
