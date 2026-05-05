import { NextResponse } from "next/server";
import { parseJsonBodyWithLimit } from "@/lib/security/read-json-body-limited";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import {
  RATE_LIMITS,
  getClientIpFromRequest,
  rateLimitCheck,
} from "@/lib/rate-limit";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { appendExternalWorkflowStep, setExternalWorkflowAckDeadline } from "@/lib/v6/external-collaboration";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";
import { enforceIdempotency } from "@/lib/idempotency";

function routeFailure(input: {
  status: number;
  error: string;
  code: string;
  diagnosticId: string;
  phase: string;
}) {
  return NextResponse.json(
    {
      ok: false,
      error: input.error,
      code: input.code,
      diagnostic_id: input.diagnosticId,
      phase: input.phase,
    },
    { status: input.status }
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const disabled = requireV5ApiFeature("v5ExternalCollaboration");
  if (disabled) return disabled;

  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`external-workflow-internal:${ip}`, RATE_LIMITS.externalWorkflowStepInternal);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil(rl.retryAfterMs / 1000))),
        },
      }
    );
  }

  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/external-actions/[token]/workflow-step",
  });
  if (modeGate) return modeGate;
  if (!(await canManageCapability(ctx, "contracts_edit"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const token = toSafeString((await params).token);
  const duplicate = await enforceIdempotency(request, {
    scope: "external-workflow.internal-step",
    actorKey: `${ctx.orgId}:${ctx.userId}:${token}`,
  });
  if (duplicate) return duplicate;
  const { data: link, error } = await ctx.admin
    .from("external_action_links")
    .select("id, organization_id")
    .eq("organization_id", ctx.orgId)
    .eq("token", token)
    .maybeSingle();

  if (error) {
    return routeFailure({
      status: 500,
      error: "Failed to load external action",
      code: "data_source_failed",
      diagnosticId: "external_action_workflow_link_load_failed",
      phase: "source_query",
    });
  }
  if (!link) return NextResponse.json({ error: "External action not found" }, { status: 404 });

  const parsedBody = await parseJsonBodyWithLimit(request, (raw) =>
    readJsonBody<{
      stepType?: string;
      payload?: Record<string, unknown>;
      ackDeadlineIso?: string;
    }>(raw ?? {}, {})
  );
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;
  const stepType = toSafeString(body.stepType) || "handoff";

  const result = await appendExternalWorkflowStep(
    ctx.admin,
    ctx.orgId,
    String(link.id),
    stepType,
    body.payload ?? {},
    ctx.userId
  );

  const errors: Array<Record<string, unknown>> = [];
  if (result.error?.message === "workflow_deadline_passed") {
    return routeFailure({
      status: 409,
      error: "External workflow deadline has passed",
      code: "workflow_deadline_passed",
      diagnosticId: "external_action_workflow_deadline_passed",
      phase: "preflight",
    });
  }
  if (result.error?.message === "external_action_event_insert_failed") {
    errors.push({
      diagnostic_id: "external_action_workflow_event_insert_failed",
      phase: "persist",
      message: "Failed to persist external workflow event",
    });
  } else if (result.error) {
    return routeFailure({
      status: 500,
      error: "Failed to persist external workflow step",
      code: "persistence_failed",
      diagnosticId: "external_action_workflow_step_persist_failed",
      phase: "persist",
    });
  }

  if (isFeatureEnabled("v6AssuranceCore")) {
    await incrementV6QualityCounter(ctx.admin, ctx.orgId, "external_workflow_step_appends_total", 1).catch(
      () => undefined
    );
  }

  const ack = toSafeString(body.ackDeadlineIso);
  if (ack) {
    const ackResult = await setExternalWorkflowAckDeadline(ctx.admin, ctx.orgId, String(link.id), ack);
    if (ackResult.error) {
      errors.push({
        diagnostic_id: "external_action_workflow_ack_deadline_persist_failed",
        phase: "persist",
        message: "Failed to persist external workflow acknowledgement deadline",
      });
    }
  }

  return NextResponse.json(
    {
      ...(errors.length > 0 ? { ok: false, partial: true, errors_count: errors.length, errors } : {}),
      externalAction: result.data,
    },
    { status: errors.length > 0 ? 207 : 201 }
  );
}
