import { NextResponse } from "next/server";
import { jsonForbidden, jsonNotFound, jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { getApiAuthContext, canManageCapability } from "@/lib/contract-operations/api-auth";
import { sendSlackRenewalDecisionSummary } from "@/lib/integrations/slack";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";

const ROUTE = "/api/integrations/slack/renewal-summary";

export const maxDuration = 60;

export async function POST(request: Request) {
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  if (!(await canManageCapability(ctx, "contracts_edit"))) {
    return jsonForbidden(ROUTE);
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/integrations/slack/renewal-summary",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "integrations.slack.renewal-summary",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/integrations/slack/renewal-summary",
    method: "POST",
  }).catch(() => undefined);

  const _lb_payload = await readJsonBodyLimited(request);
  if (!_lb_payload.ok) return _lb_payload.response;
  const payload = (_lb_payload.body ?? {}) as {
    contractId?: string;
    outcome?: string;
    details?: string;
  };
  const contractId = String(payload.contractId ?? "").trim();
  const outcome = String(payload.outcome ?? "").trim();
  if (!contractId || !outcome) {
    return jsonProblem(400, {
      error: "contractId and outcome are required",
      code: "contract_outcome_required",
      diagnostic_id: "slack_renewal_summary_contract_outcome_required",
      route: ROUTE,
    });
  }

  const { data: contract } = await ctx.admin
    .from("contracts")
    .select("id, title")
    .eq("id", contractId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!contract) return jsonNotFound(ROUTE);

  const res = await sendSlackRenewalDecisionSummary(ctx.admin, {
    organizationId: ctx.orgId,
    contractId: contract.id,
    contractTitle: contract.title ?? contract.id,
    outcome,
    details: payload.details ? String(payload.details) : undefined,
  });

  if (!res.ok) {
    return jsonProblem(400, {
      error: res.reason,
      code: "slack_summary_send_failed",
      diagnostic_id: "slack_renewal_summary_send_failed",
      route: ROUTE,
    });
  }
  return NextResponse.json({ ok: true });
}
