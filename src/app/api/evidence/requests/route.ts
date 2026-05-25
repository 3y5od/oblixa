import { NextResponse } from "next/server";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { parseIsoTimestampParam } from "@/lib/security/validation";
import { getApiAuthContext, canManageCapability } from "@/lib/contract-operations/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { buildV10MutationResponse, buildV10MutationResponseInit } from "@/lib/mutation-envelope";
import {
  executeV10AuditedMutation,
  getV10ExpectedVersionFromRequest,
  getV10IdempotencyKeyFromRequest,
  recordV10AuditEvent,
} from "@/lib/server-contracts";
import { refreshV10ReadModelsForOrganization } from "@/lib/read-model-refresh";
import { emitProductTelemetryEvent } from "@/lib/product-telemetry";

const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };
const MAX_REQUIRED_NOTE_LENGTH = 500;
const MAX_ALLOWED_FILE_TYPES = 10;
const EVIDENCE_REQUEST_DUE_AT_WINDOW_DAYS = 366;

function v10MutationStatus(outcome: string, successStatus = 200): number {
  if (outcome === "success") return successStatus;
  if (outcome === "conflict" || outcome === "stale_version") return 409;
  if (outcome === "validation_failed") return 400;
  if (outcome === "forbidden") return 403;
  if (outcome === "not_found") return 404;
  return 500;
}

function v10ErrorResponse(input: {
  outcome: "unauthorized" | "forbidden";
  message: string;
  diagnosticId: string;
  nextDestinationHref?: string;
}) {
  const response = buildV10MutationResponse({
    outcome: input.outcome,
    message: input.message,
    diagnosticId: input.diagnosticId,
    nextDestinationHref: input.nextDestinationHref,
  });
  return NextResponse.json(response, buildV10MutationResponseInit(response, { headers: PRIVATE_NO_STORE_HEADERS }));
}

function normalizeAllowedFileTypes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => String(entry ?? "").trim().toLowerCase())
    .filter((entry) => entry.length > 0 && entry.length <= 80)
    .slice(0, MAX_ALLOWED_FILE_TYPES);
}

export async function POST(request: Request) {
  const ctx = await getApiAuthContext();
  if (!ctx) {
    return v10ErrorResponse({
      outcome: "unauthorized",
      message: "Not authenticated.",
      diagnosticId: "v10_evidence_request_unauthorized",
      nextDestinationHref: "/login",
    });
  }
  if (!(await canManageCapability(ctx, "contracts_edit"))) {
    return v10ErrorResponse({
      outcome: "forbidden",
      message: "Access denied.",
      diagnosticId: "v10_evidence_request_forbidden",
      nextDestinationHref: "/contracts",
    });
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/evidence/requests",
    v10MutationResponse: true,
  });
  if (modeGate) return modeGate;

  const _lb_body = await readJsonBodyLimited(request);
  if (!_lb_body.ok) return _lb_body.response;
  const body = (_lb_body.body ?? {}) as {
    contractId?: unknown;
    sourceType?: unknown;
    sourceId?: unknown;
    responderEmail?: unknown;
    dueAt?: unknown;
    requiredNote?: unknown;
    allowedFileTypes?: unknown;
  };
  const contractId = String(body.contractId ?? "").trim();
  const sourceType = String(body.sourceType ?? "contract").trim() || "contract";
  const sourceId = String(body.sourceId ?? contractId).trim() || contractId;
  const responderEmail = String(body.responderEmail ?? "").trim();
  const dueAtRaw = String(body.dueAt ?? "").trim() || null;
  const requiredNote = String(body.requiredNote ?? "").trim();
  const allowedFileTypes = normalizeAllowedFileTypes(body.allowedFileTypes);

  if (!contractId) {
    const response = buildV10MutationResponse({
      outcome: "validation_failed",
      message: "contractId is required.",
      diagnosticId: "v10_evidence_request_contract_required",
      validationFailures: [
        {
          field: "contractId",
          code: "required",
          user_visible_message: "Choose a contract before requesting evidence.",
          self_fixable: true,
        },
      ],
    });
    return NextResponse.json(response, buildV10MutationResponseInit(response, { headers: PRIVATE_NO_STORE_HEADERS }));
  }
  if (!requiredNote || requiredNote.length > MAX_REQUIRED_NOTE_LENGTH) {
    const response = buildV10MutationResponse({
      outcome: "validation_failed",
      message: "requiredNote must be 1 to 500 characters.",
      diagnosticId: "v10_evidence_request_note_invalid",
      validationFailures: [
        {
          field: "requiredNote",
          code: "length",
          user_visible_message: "Describe the evidence needed in 1 to 500 characters.",
          self_fixable: true,
        },
      ],
    });
    return NextResponse.json(response, buildV10MutationResponseInit(response, { headers: PRIVATE_NO_STORE_HEADERS }));
  }
  let dueAt: string | null = null;
  if (dueAtRaw) {
    const parsedDueAt = parseIsoTimestampParam(dueAtRaw, {
      maxLookbackDays: EVIDENCE_REQUEST_DUE_AT_WINDOW_DAYS,
      maxFutureSkewMinutes: EVIDENCE_REQUEST_DUE_AT_WINDOW_DAYS * 24 * 60,
    });
    if (parsedDueAt.ok) {
      dueAt = parsedDueAt.value ?? null;
    } else {
      const response = buildV10MutationResponse({
        outcome: "validation_failed",
        message: "dueAt must be a valid UTC ISO timestamp within the allowed date window.",
        diagnosticId: "v10_evidence_request_due_at_invalid",
        validationFailures: [
          {
            field: "dueAt",
            code: "invalid_date",
            user_visible_message: "Use a valid due date.",
            self_fixable: true,
          },
        ],
      });
      return NextResponse.json(response, buildV10MutationResponseInit(response, { headers: PRIVATE_NO_STORE_HEADERS }));
    }
  }

  const { data: contract } = await ctx.admin
    .from("contracts")
    .select("id, updated_at")
    .eq("id", contractId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!contract) {
    const response = buildV10MutationResponse({
      outcome: "not_found",
      message: "Contract not found.",
      diagnosticId: "v10_evidence_request_contract_not_found",
      nextDestinationHref: "/contracts",
    });
    return NextResponse.json(response, buildV10MutationResponseInit(response, { headers: PRIVATE_NO_STORE_HEADERS }));
  }

  const mutation = await executeV10AuditedMutation(
    ctx.admin,
    {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      mutationName: "create_evidence_request",
      targetType: "evidence_request",
      targetId: contractId,
      idempotencyKey: getV10IdempotencyKeyFromRequest(request),
      clientRequestId: request.headers.get("x-client-request-id")?.trim() || null,
      expectedVersion: getV10ExpectedVersionFromRequest(request),
      currentVersion: String((contract as { updated_at?: string | null }).updated_at ?? ""),
      payload: {
        contract_id: contractId,
        source_type: sourceType,
        source_id: sourceId,
        responder_email_state: responderEmail ? "provided" : "not_provided",
        due_at: dueAt,
        required_note_length: requiredNote.length,
        allowed_file_types: allowedFileTypes,
      },
      auditAction: "evidence_request.created",
    },
    async () => {
      const { data, error } = await ctx.admin
        .from("evidence_requirements")
        .insert({
          organization_id: ctx.orgId,
          contract_id: contractId,
          work_item_type: sourceType,
          work_item_id: sourceId,
          requirement_type: "document",
          title: requiredNote,
          status: "required",
          reviewer_id: ctx.userId,
          due_at: dueAt,
          review_due_at: dueAt,
          required: true,
          config_json: {
            source_type: sourceType,
            source_id: sourceId,
            required_note: true,
            requirement_title_state: requiredNote ? "provided" : "not_provided",
            responder_email_state: responderEmail ? "provided" : "not_provided",
            allowed_file_types: allowedFileTypes,
          },
        })
        .select("id, contract_id, status, due_at")
        .single();
      if (error) {
        return {
          response: buildV10MutationResponse({
            outcome: "validation_failed",
            message: error.message,
            diagnosticId: "v10_evidence_request_create_failed",
            validationFailures: [
              {
                field: "evidence_request",
                code: "insert_failed",
                user_visible_message: "Evidence request could not be created.",
                self_fixable: false,
              },
            ],
          }) as ReturnType<typeof buildV10MutationResponse> & { evidenceRequest?: unknown },
          auditEventId: null,
        };
      }

      const auditEventId = await recordV10AuditEvent(ctx.admin, {
        organizationId: ctx.orgId,
        actorUserId: ctx.userId,
        action: "evidence_request.created",
        targetType: "evidence_request",
        targetId: data.id,
        contractId,
        outcome: "success",
        safeMetadata: {
          source_type: sourceType,
          source_id: sourceId,
          responder_email_state: responderEmail ? "provided" : "not_provided",
          due_state: dueAt ? "provided" : "not_provided",
          allowed_file_type_count: allowedFileTypes.length,
        },
      });
      await refreshV10ReadModelsForOrganization(ctx.admin, ctx.orgId, {
        refreshScope: "one_contract",
        contractId,
        reason: "evidence_request_mutation",
        modelKeys: [
          "work_items",
          "contract_health_snapshots",
          "contract_activity_events",
          "evidence_request_statuses",
          "audit_events",
          "command_search_index",
        ],
      });
      await emitProductTelemetryEvent(ctx.admin, {
        organizationId: ctx.orgId,
        userId: ctx.userId,
        contractId,
        action: "product.v10.evidence_request_created",
        details: {
          evidence_request_id: data.id,
          due_state: dueAt ? "provided" : "not_provided",
          allowed_file_type_count: allowedFileTypes.length,
          responder_email_state: responderEmail ? "provided" : "not_provided",
        },
      });
      return {
        response: {
          ...buildV10MutationResponse({
            outcome: "success",
            message: "Evidence request created.",
            changedObjectType: "evidence_request",
            changedObjectId: data.id,
            newVersion: data.id,
            nextDestinationHref: "/contracts/evidence-studio",
            auditEventId,
          }),
          evidenceRequest: data,
        },
        auditEventId,
      };
    }
  );

  return NextResponse.json(mutation.response, {
    ...buildV10MutationResponseInit(mutation.response, { replayed: mutation.replayed, headers: PRIVATE_NO_STORE_HEADERS }),
    status: v10MutationStatus(mutation.response.outcome, mutation.replayed ? 200 : 201),
  });
}
