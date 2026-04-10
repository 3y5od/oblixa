import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { hashExternalPasscode, readJsonBody, toSafeString } from "@/lib/v5/api";
import {
  externalActionTypeValidationError,
  isValidExternalActionType,
} from "@/lib/v5/external-action-types";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

function createToken() {
  return randomBytes(24).toString("hex");
}

export async function POST(request: Request) {
  const disabled = requireV5ApiFeature("v5ExternalCollaboration");
  if (disabled) return disabled;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await canManageCapability(ctx, "contracts_edit"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const raw = await request.json().catch(() => ({}));
  const body = readJsonBody<{
    actionType?: string;
    expiresInHours?: number;
    scope?: Record<string, unknown>;
    requiresReauth?: boolean;
    passcode?: string;
    workflowConfig?: Record<string, unknown>;
    /** ISO timestamp for external multi-step acknowledgement deadline (stored on link scope). */
    workflowDeadlineIso?: string;
  }>(raw, {});
  const rawAction = toSafeString(body.actionType) || "submit_evidence";
  if (!isValidExternalActionType(rawAction)) {
    return NextResponse.json({ error: externalActionTypeValidationError() }, { status: 400 });
  }
  const actionType = rawAction;
  const expiresInHours = Math.max(1, Math.min(720, Number(body.expiresInHours ?? 72)));
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

  const token = createToken();
  const scope: Record<string, unknown> = {
    ...(body.scope ?? {}),
    workflow_config: body.workflowConfig ?? {},
    collaboration_version: "v6",
  };
  const workflowDeadlineRaw = toSafeString(body.workflowDeadlineIso);
  if (workflowDeadlineRaw) {
    const deadlineMs = Date.parse(workflowDeadlineRaw);
    if (!Number.isFinite(deadlineMs) || deadlineMs <= Date.now()) {
      return NextResponse.json({ error: "workflowDeadlineIso must be a future ISO timestamp" }, { status: 400 });
    }
    const expMs = Date.parse(expiresAt);
    if (Number.isFinite(expMs) && deadlineMs > expMs) {
      return NextResponse.json(
        { error: "workflowDeadlineIso must be on or before the link expires_at" },
        { status: 400 }
      );
    }
    scope.workflow_deadline_iso = workflowDeadlineRaw;
    scope.workflow_ack_required = true;
  }
  const rawDw = scope["decisionWorkspaceId"];
  const decisionWorkspaceId =
    typeof rawDw === "string" && /^[0-9a-f-]{36}$/i.test(rawDw) ? rawDw : null;

  const passPlain = toSafeString(body.passcode);
  const passcodeHash = passPlain.length > 0 ? hashExternalPasscode(passPlain) : null;

  const { data, error } = await ctx.admin
    .from("external_action_links")
    .insert({
      organization_id: ctx.orgId,
      token,
      action_type: actionType,
      scope_json: scope,
      decision_workspace_id: decisionWorkspaceId,
      passcode_hash: passcodeHash,
      expires_at: expiresAt,
      requires_reauth: Boolean(body.requiresReauth),
      created_by: ctx.userId,
    })
    .select("id, token, action_type, expires_at, status")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await ctx.admin.from("external_action_events").insert({
    organization_id: ctx.orgId,
    external_action_link_id: data.id,
    event_type: "external.link_created",
    payload_json: { action_type: data.action_type, expires_at: data.expires_at },
    actor_user_id: ctx.userId,
  });

  if (isFeatureEnabled("v6AssuranceCore")) {
    await incrementV6QualityCounter(ctx.admin, ctx.orgId, "external_action_links_created_total", 1).catch(
      () => undefined
    );
  }
  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_post_external_create_link_total", 1).catch(
    () => undefined
  );

  return NextResponse.json({ externalAction: data }, { status: 201 });
}

