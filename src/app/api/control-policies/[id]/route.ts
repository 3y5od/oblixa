import { NextResponse } from "next/server";
import { jsonProblem } from "@/lib/http/problem";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { patchControlPolicySettings } from "@/lib/v6/control-policies";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { requireExpectedVersionForMutation, staleExpectedVersionResponse } from "@/lib/security/stale-write-guard";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/control-policies/[id]";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6ControlPolicies");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("settings_manage");
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/control-policies/[id]",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.control-policies.id",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  const expectedVersionResult = requireExpectedVersionForMutation(request, {
    route: ROUTE,
    diagnosticPrefix: "control_policy",
  });
  if (!expectedVersionResult.ok) return expectedVersionResult.response;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/control-policies/[id]",
    method: "PATCH",
  }).catch(() => undefined);

  const policyId = toSafeString((await params).id);

  const routeParamRejection = rejectUnsafeRouteParams({ id: policyId }, ["id"], "/api/control-policies/[id]");

  if (routeParamRejection) return routeParamRejection;
  const _lb_body = await readJsonBodyLimited(request);
  if (!_lb_body.ok) return _lb_body.response;
  const body = readJsonBody<{ remediationPlaybookId?: string | null }>(_lb_body.body ?? {}, {});

  let remediationPlaybookId: string | null | undefined;
  if ("remediationPlaybookId" in body) {
    const raw = body.remediationPlaybookId;
    if (raw === null || raw === "") {
      remediationPlaybookId = null;
    } else {
      const pbId = toSafeString(raw);
      if (!pbId) {
        return jsonProblem(400, {
          error: "remediationPlaybookId invalid",
          code: "invalid_remediation_playbook_id",
          diagnostic_id: "control_policy_remediation_playbook_id_invalid",
          route: ROUTE,
        });
      }
      const { data: pb } = await ctx.admin
        .from("adaptive_playbooks")
        .select("id")
        .eq("organization_id", ctx.orgId)
        .eq("id", pbId)
        .maybeSingle();
      if (!pb) {
        return jsonProblem(400, {
          error: "Playbook not found in this organization",
          code: "playbook_not_found",
          diagnostic_id: "control_policy_playbook_not_found",
          route: ROUTE,
        });
      }
      remediationPlaybookId = pbId;
    }
  }

  if (!("remediationPlaybookId" in body)) {
    return jsonProblem(400, {
      error: "remediationPlaybookId is required",
      code: "remediation_playbook_id_required",
      diagnostic_id: "control_policy_remediation_playbook_id_required",
      route: ROUTE,
    });
  }

  const result = await patchControlPolicySettings(
    ctx.admin,
    ctx.orgId,
    policyId,
    {
      remediationPlaybookId,
    },
    expectedVersionResult.expectedVersion
  );
  if (result.error) {
    return jsonProblem(400, {
      error: result.error.message,
      code: "control_policy_update_failed",
      diagnostic_id: "control_policy_update_failed",
      route: ROUTE,
    });
  }
  if (!result.data) {
    return staleExpectedVersionResponse({
      route: ROUTE,
      diagnosticPrefix: "control_policy",
    });
  }
  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_patch_control_policy_remediation_total", 1).catch(
    () => undefined
  );
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }
  return NextResponse.json({ policy: result.data });
}
