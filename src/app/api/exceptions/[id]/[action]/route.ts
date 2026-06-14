import { NextResponse } from "next/server";
import {
  canManageCapability,
  getApiAuthContext,
} from "@/lib/contract-operations/api-auth";
import {
  buildAssignExceptionMutationResponse,
  buildReopenExceptionMutationResponse,
  buildResolveExceptionMutationResponse,
  type ExceptionActionBody,
  type ExceptionActionRow,
} from "@/lib/exceptions/action-route";
import {
  buildV10MutationResponse,
  buildV10MutationResponseInit,
  type V10MutationResponse,
} from "@/lib/mutation-envelope";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { refreshV10ReadModelsForOrganization } from "@/lib/read-model-refresh";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import {
  rejectInvalidRouteParamEnums,
  rejectUnsafeRouteParams,
} from "@/lib/security/route-params";
import { isIsoDateOnly } from "@/lib/security/validation";
import {
  executeV10IdempotentMutation,
  getV10ExpectedVersionFromRequest,
  getV10IdempotencyKeyFromRequest,
  recordV10AuditEvent,
} from "@/lib/server-contracts";

const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };
const EXCEPTION_ACTIONS = ["assign", "resolve", "reopen"] as const;

function jsonV10(response: V10MutationResponse, replayed = false) {
  return NextResponse.json(
    response,
    buildV10MutationResponseInit(response, {
      replayed,
      headers: PRIVATE_NO_STORE_HEADERS,
    }),
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  const { id, action } = await params;
  const routeParamRejection = rejectUnsafeRouteParams(
    { id, action },
    ["id", "action"],
    "/api/exceptions/[id]/[action]",
  );
  if (routeParamRejection) return routeParamRejection;
  const routeActionRejection = rejectInvalidRouteParamEnums(
    { action },
    { action: EXCEPTION_ACTIONS },
    "/api/exceptions/[id]/[action]",
  );
  if (routeActionRejection) return routeActionRejection;
  const ctx = await getApiAuthContext();
  if (!ctx) {
    return jsonV10(
      buildV10MutationResponse({
        outcome: "unauthorized",
        message: "Not authenticated.",
        diagnosticId: "v10_exception_action_unauthorized",
        nextDestinationHref: "/login",
      }),
    );
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/exceptions/[id]/[action]",
    v10MutationResponse: true,
  });
  if (modeGate) return modeGate;
  if (!(await canManageCapability(ctx, "maintenance_manage"))) {
    return jsonV10(
      buildV10MutationResponse({
        outcome: "forbidden",
        message: "Access denied.",
        diagnosticId: "v10_exception_action_forbidden",
      }),
    );
  }

  const { data: row } = await ctx.admin
    .from("exceptions")
    .select("id, contract_id, status, severity, reopen_count, updated_at")
    .eq("id", id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!row) {
    return jsonV10(
      buildV10MutationResponse({
        outcome: "not_found",
        message: "Exception not found.",
        diagnosticId: "v10_exception_action_not_found",
      }),
    );
  }

  const _lb_body = await readJsonBodyLimited(request);
  if (!_lb_body.ok) return _lb_body.response;
  const body = (_lb_body.body ?? {}) as ExceptionActionBody;
  const dueDate = String(body.dueDate ?? "").trim() || null;
  if (dueDate && !isIsoDateOnly(dueDate)) {
    return jsonV10(
      buildV10MutationResponse({
        outcome: "validation_failed",
        message: "Invalid due date.",
        diagnosticId: "v10_exception_due_date_invalid",
        validationFailures: [
          {
            field: "dueDate",
            code: "invalid_date",
            user_visible_message: "Enter a valid due date.",
            self_fixable: true,
          },
        ],
      }),
    );
  }

  const now = new Date().toISOString();
  const actionRow = row as ExceptionActionRow;
  const dependencies = {
    recordAuditEvent: recordV10AuditEvent,
    refreshReadModelsForOrganization: refreshV10ReadModelsForOrganization,
  };
  const mutationInput = {
    ctx,
    id,
    row: actionRow,
    body,
    now,
    dependencies,
  };

  if (action === "assign") {
    const ownerId = String(body.ownerId ?? "").trim();
    const mutation = await executeV10IdempotentMutation(
      ctx.admin,
      {
        organizationId: ctx.orgId,
        actorUserId: ctx.userId,
        mutationName: "exception.assign",
        targetType: "exception",
        targetId: id,
        idempotencyKey: getV10IdempotencyKeyFromRequest(request),
        expectedVersion: getV10ExpectedVersionFromRequest(request),
        currentVersion: actionRow.updated_at ?? actionRow.status,
        payload: { action, owner_id: ownerId, due_date: dueDate },
      },
      () =>
        buildAssignExceptionMutationResponse({
          ...mutationInput,
          ownerId,
          dueDate,
        }),
    );
    return jsonV10(mutation.response, mutation.replayed);
  }

  if (action === "resolve") {
    const resolutionAction =
      String(body.resolutionAction ?? "fixed").trim() || "fixed";
    const mutation = await executeV10IdempotentMutation(
      ctx.admin,
      {
        organizationId: ctx.orgId,
        actorUserId: ctx.userId,
        mutationName: "exception.resolve",
        targetType: "exception",
        targetId: id,
        idempotencyKey: getV10IdempotencyKeyFromRequest(request),
        expectedVersion: getV10ExpectedVersionFromRequest(request),
        currentVersion: actionRow.updated_at ?? actionRow.status,
        payload: {
          action,
          resolution_action: resolutionAction,
          root_cause_state: body.rootCause?.trim()
            ? "provided"
            : "not_provided",
          resolution_note_state: body.resolutionNote?.trim()
            ? "provided"
            : "not_provided",
        },
      },
      () =>
        buildResolveExceptionMutationResponse({
          ...mutationInput,
          resolutionAction,
        }),
    );
    return jsonV10(mutation.response, mutation.replayed);
  }

  if (action === "reopen") {
    const mutation = await executeV10IdempotentMutation(
      ctx.admin,
      {
        organizationId: ctx.orgId,
        actorUserId: ctx.userId,
        mutationName: "exception.reopen",
        targetType: "exception",
        targetId: id,
        idempotencyKey: getV10IdempotencyKeyFromRequest(request),
        expectedVersion: getV10ExpectedVersionFromRequest(request),
        currentVersion: actionRow.updated_at ?? actionRow.status,
        payload: { action, reopen_count: (actionRow.reopen_count ?? 0) + 1 },
      },
      () => buildReopenExceptionMutationResponse(mutationInput),
    );
    return jsonV10(mutation.response, mutation.replayed);
  }

  return jsonV10(
    buildV10MutationResponse({
      outcome: "not_found",
      message: "Unsupported action.",
      diagnosticId: "v10_exception_action_unsupported",
    }),
  );
}
