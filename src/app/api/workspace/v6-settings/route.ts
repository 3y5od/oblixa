import { NextResponse } from "next/server";
import { jsonProblem } from "@/lib/http/problem";
import { BODY_LIMIT_SMALL_JSON, readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { readJsonBody } from "@/lib/decision-intelligence/api";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { requireV6Context } from "@/lib/assurance/api-auth";
import { requireV6ApiFeature } from "@/lib/assurance/feature-guards";
import { runIncrementalAssuranceChecks } from "@/lib/assurance/assurance-checks";
import {
  getV6OrgSettingsSnapshot,
  mergeOrgSettingsJson,
  type OrgSettingsJson,
} from "@/lib/assurance/org-settings";
import { incrementAssuranceQualityCounter } from "@/lib/assurance/telemetry";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent, recordApiRouteAuditEvent } from "@/lib/security/api-mutation-audit";
import { requireExpectedVersionForMutation, staleExpectedVersionResponse } from "@/lib/security/stale-write-guard";

const ROUTE = "/api/workspace/v6-settings";

export async function GET() {
  const disabled = requireV6ApiFeature("v6AssuranceCore");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/workspace/v6-settings",
  });
  if (modeGate) return modeGate;

  void recordApiRouteAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: ROUTE,
    method: "GET",
    action: "api.sensitive_read_authorized",
  }).catch(() => undefined);

  await incrementAssuranceQualityCounter(ctx.admin, ctx.orgId, "api_get_workspace_v6_settings_total", 1).catch(() => undefined);

  const snapshot = await getV6OrgSettingsSnapshot(ctx.admin, ctx.orgId);
  return NextResponse.json({ settings: snapshot.settings, settingsVersion: snapshot.updatedAt });
}

export async function PATCH(request: Request) {
  const disabled = requireV6ApiFeature("v6AssuranceCore");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("settings_manage");
  if (!ctx) return errorResponse!;
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/workspace/v6-settings",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.workspace.v6-settings",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/workspace/v6-settings",
    method: "PATCH",
  }).catch(() => undefined);

  const _lb_body = await readJsonBodyLimited(request, BODY_LIMIT_SMALL_JSON);
  if (!_lb_body.ok) return _lb_body.response;
  const body = readJsonBody<{
    autopilotAllowExecution?: boolean;
    reviewBoardNotificationEmails?: string[];
  }>(_lb_body.body ?? {}, {});

  const patch: Partial<OrgSettingsJson> = {};
  if (typeof body.autopilotAllowExecution === "boolean") {
    patch.autopilot_allow_execution = body.autopilotAllowExecution;
  }
  if (Array.isArray(body.reviewBoardNotificationEmails)) {
    patch.review_board_notification_emails = body.reviewBoardNotificationEmails.map((e) => String(e).trim());
  }

  if (Object.keys(patch).length === 0) {
    return jsonProblem(400, {
      error: "No valid fields",
      code: "no_valid_fields",
      diagnostic_id: "workspace_v6_settings_no_valid_fields",
      route: ROUTE,
    });
  }

  const expectedVersionResult = requireExpectedVersionForMutation(request, {
    route: ROUTE,
    diagnosticPrefix: "workspace_v6_settings",
  });
  if (!expectedVersionResult.ok) return expectedVersionResult.response;

  const { data, error } = await mergeOrgSettingsJson(ctx.admin, ctx.orgId, patch, {
    expectedVersion: expectedVersionResult.expectedVersion,
  });
  if (error) {
    if (error.message === "stale_version") {
      return staleExpectedVersionResponse({
        route: ROUTE,
        diagnosticPrefix: "workspace_v6_settings",
      });
    }
    return jsonProblem(400, {
      error: error.message,
      code: "workspace_v6_settings_update_failed",
      diagnostic_id: "workspace_v6_settings_update_failed",
      route: ROUTE,
    });
  }
  if (!data) {
    return staleExpectedVersionResponse({
      route: ROUTE,
      diagnosticPrefix: "workspace_v6_settings",
    });
  }
  await incrementAssuranceQualityCounter(ctx.admin, ctx.orgId, "api_patch_workspace_v6_settings_total", 1).catch(() => undefined);
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }
  return NextResponse.json({ settings: data });
}
