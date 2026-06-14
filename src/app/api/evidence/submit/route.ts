import { NextResponse } from "next/server";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { getClientIpFromRequest, rateLimitCheck } from "@/lib/rate-limit";
import {
  getApiAuthContext,
  canManageCapability,
} from "@/lib/contract-operations/api-auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { runIncrementalAssuranceChecks } from "@/lib/assurance/assurance-checks";
import { incrementAssuranceQualityCounter } from "@/lib/assurance/telemetry";
import { emitProductTelemetryEvent } from "@/lib/product-telemetry";
import {
  buildV10MutationResponse,
  buildV10MutationResponseInit,
} from "@/lib/mutation-envelope";
import {
  executeV10AuditedMutation,
  getV10IdempotencyKeyFromRequest,
  recordV10AuditEvent,
} from "@/lib/server-contracts";
import { refreshV10ReadModelsForOrganization } from "@/lib/read-model-refresh";
import {
  asString,
  submitExternalEvidence,
  type EvidenceSubmitBody,
} from "@/lib/evidence/submit-external-route";

const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };
const EXTERNAL_EVIDENCE_STALE_DIAGNOSTIC_ID =
  "v10_external_evidence_submit_stale_status";

function jsonV10(
  response: ReturnType<typeof buildV10MutationResponse>,
  replayed = false,
) {
  return NextResponse.json(
    response,
    buildV10MutationResponseInit(response, {
      replayed,
      headers: PRIVATE_NO_STORE_HEADERS,
    }),
  );
}

function v10MutationStatus(outcome: string, successStatus = 200): number {
  if (outcome === "success") return successStatus;
  if (outcome === "conflict") return 409;
  if (outcome === "validation_failed") return 400;
  if (outcome === "dependency_blocked") return 424;
  if (
    outcome === "external_link_expired" ||
    outcome === "external_link_revoked"
  )
    return 410;
  if (outcome === "forbidden") return 403;
  if (outcome === "not_found") return 404;
  return 500;
}

export async function POST(request: Request) {
  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`evidence-submit:${ip}`, {
    max: 120,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    const response = buildV10MutationResponse({
      outcome: "rate_limited",
      message: "Too many requests. Try again shortly.",
      diagnosticId: "v10_evidence_submit_rate_limited",
    });
    const init = buildV10MutationResponseInit(response, {
      headers: PRIVATE_NO_STORE_HEADERS,
    });
    const headers = new Headers(init.headers);
    headers.set(
      "Retry-After",
      String(Math.max(1, Math.ceil(rl.retryAfterMs / 1000))),
    );
    return NextResponse.json(response, { ...init, headers });
  }

  const ctx = await getApiAuthContext();
  const _lb_body = await readJsonBodyLimited(request);
  if (!_lb_body.ok) return _lb_body.response;
  const body = (_lb_body.body ?? {}) as EvidenceSubmitBody;
  const externalToken =
    request.headers.get("x-v10-external-evidence-token")?.trim() ||
    asString(body.externalToken);
  if (!ctx) {
    if (externalToken) {
      return submitExternalEvidence(request, body, externalToken, {
        staleStatusDiagnosticId: EXTERNAL_EVIDENCE_STALE_DIAGNOSTIC_ID,
      });
    }
    return jsonV10(
      buildV10MutationResponse({
        outcome: "unauthorized",
        message: "Not authenticated.",
        diagnosticId: "v10_evidence_submit_unauthorized",
        nextDestinationHref: "/login",
      }),
    );
  }
  if (!(await canManageCapability(ctx, "contracts_edit"))) {
    return jsonV10(
      buildV10MutationResponse({
        outcome: "forbidden",
        message: "Access denied.",
        diagnosticId: "v10_evidence_submit_forbidden",
        nextDestinationHref: "/evidence",
      }),
    );
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/evidence/submit",
    v10MutationResponse: true,
  });
  if (modeGate) return modeGate;

  if (JSON.stringify(body).length > 50000) {
    return jsonV10(
      buildV10MutationResponse({
        outcome: "validation_failed",
        message: "Payload too large.",
        diagnosticId: "v10_evidence_submit_payload_too_large",
        validationFailures: [
          {
            field: "payload",
            code: "too_large",
            user_visible_message:
              "Evidence payload must be smaller than 50 KB.",
            self_fixable: true,
          },
        ],
      }),
    );
  }
  const requirementId = String(body.requirementId ?? "").trim();
  if (!requirementId) {
    return jsonV10(
      buildV10MutationResponse({
        outcome: "validation_failed",
        message: "requirementId is required.",
        diagnosticId: "v10_evidence_submit_requirement_required",
        validationFailures: [
          {
            field: "requirementId",
            code: "required",
            user_visible_message:
              "Select the evidence request before submitting.",
            self_fixable: true,
          },
        ],
      }),
    );
  }

  const { data: requirement } = await ctx.admin
    .from("evidence_requirements")
    .select("id, organization_id, contract_id, status")
    .eq("id", requirementId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!requirement) {
    return jsonV10(
      buildV10MutationResponse({
        outcome: "not_found",
        message: "Requirement not found.",
        diagnosticId: "v10_evidence_submit_requirement_not_found",
      }),
    );
  }
  if (
    !["required", "rejected", "overdue"].includes(
      String(requirement.status ?? ""),
    )
  ) {
    return jsonV10(
      buildV10MutationResponse({
        outcome: "conflict",
        message: "This evidence request is not accepting submissions.",
        diagnosticId: "v10_evidence_submit_not_open",
      }),
    );
  }

  const mutation = await executeV10AuditedMutation(
    ctx.admin,
    {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      mutationName: "evidence.submit",
      targetType: "evidence_request",
      targetId: requirementId,
      idempotencyKey: getV10IdempotencyKeyFromRequest(request),
      payload: { requirementId, payload: body.payload ?? {} },
      auditAction: "evidence_request.submitted",
    },
    async () => {
      const { data: claimedRequirement, error: claimError } = await ctx.admin
        .from("evidence_requirements")
        .update({ status: "submitted" })
        .eq("id", requirementId)
        .eq("organization_id", ctx.orgId)
        .in("status", ["required", "rejected", "overdue"])
        .select("id, status")
        .maybeSingle();
      if (claimError || !claimedRequirement) {
        return {
          response: buildV10MutationResponse({
            outcome: claimError ? "server_error" : "conflict",
            message: claimError
              ? "Evidence request could not be claimed."
              : "Evidence request status changed before submit.",
            diagnosticId: claimError
              ? "v10_evidence_submit_claim_failed"
              : "v10_evidence_submit_stale_status",
          }) as ReturnType<typeof buildV10MutationResponse> & {
            submission?: unknown;
          },
          auditEventId: null,
        };
      }
      const { data: submission, error } = await ctx.admin
        .from("evidence_submissions")
        .insert({
          organization_id: ctx.orgId,
          requirement_id: requirementId,
          submitted_by: ctx.userId,
          status: "submitted",
          payload_json: body.payload ?? {},
          v6_freshness_score: 100,
        })
        .select("id, requirement_id, status, submitted_at")
        .single();
      if (error) {
        await ctx.admin
          .from("evidence_requirements")
          .update({ status: requirement.status })
          .eq("id", requirementId)
          .eq("organization_id", ctx.orgId)
          .eq("status", "submitted");
        return {
          response: buildV10MutationResponse({
            outcome: "validation_failed",
            message: error.message,
            diagnosticId: "v10_evidence_submit_failed",
            validationFailures: [
              {
                field: "payload",
                code: "insert_failed",
                user_visible_message: "Evidence could not be submitted.",
                self_fixable: false,
              },
            ],
          }) as ReturnType<typeof buildV10MutationResponse> & {
            submission?: unknown;
          },
          auditEventId: null,
        };
      }

      if (isFeatureEnabled("v6AssuranceCore")) {
        await incrementAssuranceQualityCounter(
          ctx.admin,
          ctx.orgId,
          "evidence_submit_incremental_assurance_hook_total",
          1,
        ).catch(() => undefined);
        await runIncrementalAssuranceChecks(
          ctx.admin,
          ctx.orgId,
          ctx.userId,
        ).catch(() => undefined);
      }

      const auditEventId = await recordV10AuditEvent(ctx.admin, {
        organizationId: ctx.orgId,
        actorUserId: ctx.userId,
        action: "evidence_request.submitted",
        targetType: "evidence_request",
        targetId: requirementId,
        contractId: (requirement.contract_id as string | null) ?? null,
        outcome: "success",
        safeMetadata: {
          submission_id: submission.id,
          payload_state: body.payload ? "provided" : "not_provided",
        },
      });
      await emitProductTelemetryEvent(ctx.admin, {
        organizationId: ctx.orgId,
        userId: ctx.userId,
        contractId: (requirement.contract_id as string | null) ?? null,
        action: "product.v10.evidence_submitted",
        details: {
          requirement_id: requirementId,
          payload_state: body.payload ? "provided" : "not_provided",
        },
      });
      await refreshV10ReadModelsForOrganization(ctx.admin, ctx.orgId, {
        refreshScope: requirement.contract_id ? "one_contract" : "one_model",
        contractId: (requirement.contract_id as string | null) ?? undefined,
        reason: "evidence_submission_mutation",
        modelKeys: [
          "work_items",
          "contract_health_snapshots",
          "contract_activity_events",
          "evidence_request_statuses",
          "external_evidence_submissions",
          "audit_events",
          "command_search_index",
        ],
      });
      return {
        response: {
          ...buildV10MutationResponse({
            outcome: "success",
            message: "Evidence submitted.",
            changedObjectType: "evidence_request",
            changedObjectId: requirementId,
            nextDestinationHref: "/evidence",
            auditEventId,
          }),
          submission,
        },
        auditEventId,
      };
    },
  );

  return NextResponse.json(mutation.response, {
    ...buildV10MutationResponseInit(mutation.response, {
      replayed: mutation.replayed,
      headers: PRIVATE_NO_STORE_HEADERS,
    }),
    status: v10MutationStatus(
      mutation.response.outcome,
      mutation.replayed ? 200 : 201,
    ),
  });
}
