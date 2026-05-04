import { withCronRoute } from "@/lib/cron/route-runner";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { recomputeContractSignals } from "@/lib/workflow-signals";
import { refreshV10ReadModelsForOrganization } from "@/lib/v10-read-model-refresh";
import { recordV10AuditEvent } from "@/lib/v10-server-contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withCronRoute({
  route: "/api/contracts/recompute-signals",
  healthcheckRoute: "contracts/recompute-signals",
  rateLimitKey: "cron:contracts:recompute-signals",
  rateLimit: RATE_LIMITS.contractsRecomputeSignalsCron,
  handler: async ({ admin }) => {
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

    return {
      body: {
        scanned: contracts?.length ?? 0,
        updated,
        v10ReadModels: v10Refreshes,
        v10AuditEventIds,
      },
    };
  },
});
