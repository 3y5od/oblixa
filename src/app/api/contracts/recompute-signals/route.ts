import { NextResponse } from "next/server";
import { API_PRIVATE_NO_STORE_HEADERS, requireCronAuthorized } from "@/lib/security/api-guards";
import { RATE_LIMITS, rateLimitCheck } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/server";
import { recomputeContractSignals } from "@/lib/workflow-signals";
import { pingCronHealthcheck } from "@/lib/observability/cron-healthcheck";
import { refreshV10ReadModelsForOrganization } from "@/lib/v10-read-model-refresh";
import { recordV10AuditEvent } from "@/lib/v10-server-contracts";

const PRIVATE_NO_STORE_HEADERS = API_PRIVATE_NO_STORE_HEADERS;
// Cache-Control: enforced for private cron JSON via API_PRIVATE_NO_STORE_HEADERS (catalog literal guard).

export async function GET(request: Request) {
  const startedAt = Date.now();
  const cronDenied = requireCronAuthorized(request);
  if (cronDenied) {
    pingCronHealthcheck("contracts/recompute-signals", {
      ok: false,
      status: cronDenied.status,
      durationMs: Date.now() - startedAt,
    });
    return cronDenied;
  }

  const rate = await rateLimitCheck("cron:contracts:recompute-signals", RATE_LIMITS.contractsRecomputeSignalsCron);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterMs: rate.retryAfterMs },
      { status: 429, headers: PRIVATE_NO_STORE_HEADERS }
    );
  }

  const admin = await createAdminClient();
  const { data: contracts } = await admin
    .from("contracts")
    .select("id, organization_id")
    .in("status", ["pending_review", "active", "expired"])
    .limit(1000);

  let updated = 0;
  for (const contract of contracts ?? []) {
    const res = await recomputeContractSignals(admin, contract.id);
    if (res.ok) updated++;
  }
  const orgIds = [...new Set((contracts ?? []).map((contract) => String(contract.organization_id)).filter(Boolean))];
  const v10Refreshes = [];
  const v10AuditEventIds = [];
  for (const orgId of orgIds) {
    const refresh = await refreshV10ReadModelsForOrganization(admin, orgId, {
      refreshScope: "full_org",
      reason: "contracts_signals_recomputed",
    });
    v10Refreshes.push(refresh);
    v10AuditEventIds.push(
      await recordV10AuditEvent(admin, {
        organizationId: orgId,
        actorUserId: null,
        actorType: "system",
        action: "contracts.signals_recomputed",
        targetType: "workspace_health_diagnostic",
        targetId: orgId,
        outcome: refresh.ok ? "success" : "server_error",
        safeMetadata: {
          scanned_count: contracts?.length ?? 0,
          updated_count: updated,
          read_model_ok: refresh.ok,
        },
        diagnosticId: refresh.ok ? null : "v10_recompute_signals_read_model_refresh_failed",
      })
    );
  }

  const payload = {
    scanned: contracts?.length ?? 0,
    updated,
    v10ReadModels: v10Refreshes,
    v10AuditEventIds,
    ok: true,
    durationMs: Date.now() - startedAt,
  };
  pingCronHealthcheck("contracts/recompute-signals", payload);
  return NextResponse.json(payload, { headers: PRIVATE_NO_STORE_HEADERS });
}
