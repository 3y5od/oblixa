import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/security/cron-auth";
import { RATE_LIMITS, rateLimitCheck } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/server";
import { recomputeContractSignals } from "@/lib/workflow-signals";
import { pingCronHealthcheck } from "@/lib/observability/cron-healthcheck";

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return false;
  return authorizeCronRequest(request, cronSecret);
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  if (!isAuthorized(request)) {
    pingCronHealthcheck("contracts/recompute-signals", {
      ok: false,
      status: 401,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = await rateLimitCheck("cron:contracts:recompute-signals", RATE_LIMITS.contractsRecomputeSignalsCron);
  if (!rate.ok) {
    return NextResponse.json({ error: "Too many requests", retryAfterMs: rate.retryAfterMs }, { status: 429 });
  }

  const admin = await createAdminClient();
  const { data: contracts } = await admin
    .from("contracts")
    .select("id")
    .in("status", ["pending_review", "active", "expired"])
    .limit(1000);

  let updated = 0;
  for (const contract of contracts ?? []) {
    const res = await recomputeContractSignals(admin, contract.id);
    if (res.ok) updated++;
  }

  const payload = {
    scanned: contracts?.length ?? 0,
    updated,
    ok: true,
    durationMs: Date.now() - startedAt,
  };
  pingCronHealthcheck("contracts/recompute-signals", payload);
  return NextResponse.json(payload);
}
