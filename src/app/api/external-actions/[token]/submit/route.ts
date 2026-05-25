import { NextResponse } from "next/server";
import { jsonForbidden, jsonNotFound, jsonProblem, jsonRateLimited } from "@/lib/http/problem";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createAdminClient } from "@/lib/supabase/server";
import {
  RATE_LIMITS,
  getClientIpFromRequest,
  rateLimitCheck,
} from "@/lib/rate-limit";
import { requireV5ApiFeature } from "@/lib/decision-intelligence/feature-guards";
import {
  externalActionTokenHash,
  externalActionTokenMatches,
  externalActionTokenPrefix,
  externalActionTokenStableKey,
  isExternalActionTokenSyntax,
  nowIso,
  verifyExternalPasscode,
  verifyExternalSubmitTicket,
} from "@/lib/decision-intelligence/api";
import { validateExternalActionPayload } from "@/lib/decision-intelligence/external-action-payload";
import {
  type ExternalActionType,
  isValidExternalActionType,
} from "@/lib/decision-intelligence/external-action-types";
import {
  appendAccountTimelineEvent,
  appendCounterpartyTimelineEvent,
} from "@/lib/decision-intelligence/relationship-timeline";
import { appendExternalWorkflowStep } from "@/lib/assurance/external-collaboration";
import { runIncrementalAssuranceChecks } from "@/lib/assurance/assurance-checks";
import { incrementAssuranceQualityCounter } from "@/lib/assurance/telemetry";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";
import { recordPublicTokenMiss } from "@/lib/security/public-token-telemetry";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROUTE = "/api/external-actions/[token]/submit";
const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const;

type TokenHashLookup = {
  eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: unknown; error: unknown }> };
};

function routeFailure(input: {
  status: number;
  error: string;
  code: string;
  diagnosticId: string;
  phase: string;
  details?: Record<string, unknown>;
}) {
  return jsonProblem(input.status, {
    error: input.error,
    code: input.code,
    diagnostic_id: input.diagnosticId,
    route: ROUTE,
    details: { phase: input.phase, ...(input.details ?? {}) },
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const disabled = requireV5ApiFeature("v5ExternalCollaboration");
  if (disabled) return disabled;
  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`external-submit:${ip}`, RATE_LIMITS.externalTokenMutate);
  if (!rl.ok) {
    return jsonRateLimited(rl.retryAfterMs, ROUTE);
  }
  const { token } = await params;
  const routeParamRejection = rejectUnsafeRouteParams({ token }, ["token"], "/api/external-actions/[token]/submit");
  if (routeParamRejection) return routeParamRejection;
  const tokenHash = externalActionTokenHash(token);
  const tokenKey = externalActionTokenStableKey(token);
  if (!isExternalActionTokenSyntax(token)) {
    recordPublicTokenMiss({ surface: "external_action", route: ROUTE, tokenKey, ip, reason: "malformed" });
    return jsonNotFound(ROUTE);
  }
  const tokenRl = await rateLimitCheck(`external-submit:token-hash:${tokenKey}`, RATE_LIMITS.externalTokenMutate);
  if (!tokenRl.ok) {
    return jsonRateLimited(tokenRl.retryAfterMs, ROUTE);
  }
  const duplicate = await enforceIdempotency(request, {
    scope: "external-action.submit",
    actorKey: tokenKey,
  });
  if (duplicate) return duplicate;
  const admin = await createAdminClient();
  const _lb_rawPayload = await readJsonBodyLimited(request);
  if (!_lb_rawPayload.ok) return _lb_rawPayload.response;
  const rawPayload = (_lb_rawPayload.body ?? {}) as Record<string, unknown>;
  const passcode = typeof rawPayload.passcode === "string" ? rawPayload.passcode : undefined;
  const submitTicket =
    typeof rawPayload.submitTicket === "string" ? rawPayload.submitTicket : undefined;

  const tokenPrefix = externalActionTokenPrefix(token);
  const query = admin
    .from("external_action_links")
    .select(
      "id, organization_id, status, expires_at, revoked_at, one_time, action_type, scope_json, passcode_hash, decision_workspace_id, requires_reauth, token_hash"
    );
  const hasHashLookup = typeof (query as { or?: unknown }).or === "function";
  const result =
    hasHashLookup
      ? await query.or(`token_prefix.eq.${tokenPrefix},token_hash.eq.${tokenHash}`).limit(10)
      : await (query as unknown as TokenHashLookup)
          .eq("token_hash", tokenHash)
          .maybeSingle();
  const candidates = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
  const linkError = result.error as { message?: string } | null;
  if (linkError) {
    console.error("[api/external-actions/submit] link query error:", linkError.message);
    return routeFailure({
      status: 500,
      error: "Failed to load external action",
      code: "data_source_failed",
      diagnosticId: "external_action_submit_link_load_failed",
      phase: "source_query",
    });
  }
  const link = hasHashLookup ? (candidates ?? []).find((row) => externalActionTokenMatches(row, token)) : candidates[0];
  if (!link) {
    recordPublicTokenMiss({ surface: "external_action", route: ROUTE, tokenKey, ip, reason: "not_found" });
    return jsonNotFound(ROUTE);
  }
  if (link.status === "revoked" || link.revoked_at) {
    recordPublicTokenMiss({ surface: "external_action", route: ROUTE, tokenKey, ip, reason: "revoked" });
    return jsonProblem(410, {
      error: "External action link revoked",
      code: "external_action_revoked",
      diagnostic_id: "external_action_submit_revoked",
      route: ROUTE,
    });
  }

  if (link.requires_reauth) {
    const ticketCheck = verifyExternalSubmitTicket(token, submitTicket, String(link.id));
    if (!ticketCheck.ok) {
      return jsonProblem(403, {
        error:
          ticketCheck.reason === "submit_ticket_required"
            ? "Submit ticket required. Call GET status before submitting."
            : "Invalid or expired submit ticket. Refresh the page to obtain a new ticket.",
        code: ticketCheck.reason,
        diagnostic_id: `external_action_${ticketCheck.reason}`,
        route: ROUTE,
      });
    }
  }

  if (!verifyExternalPasscode(passcode, link.passcode_hash ?? null)) {
    return jsonForbidden(ROUTE);
  }

  void recordApiMutationAuditEvent(admin, {
    organizationId: String(link.organization_id),
    actorUserId: null,
    actorType: "external",
    route: "/api/external-actions/[token]/submit",
    method: "POST",
  }).catch(() => undefined);

  if (link.expires_at < nowIso()) {
    const { error: expireError } = await admin
      .from("external_action_links")
      .update({ status: "expired" })
      .eq("id", link.id)
      .eq("organization_id", link.organization_id);
    if (expireError) {
      return routeFailure({
        status: 500,
        error: "Failed to persist expired external action state",
        code: "persistence_failed",
        diagnosticId: "external_action_submit_expired_state_failed",
        phase: "persist",
      });
    }
    return jsonProblem(410, {
      error: "External action link expired",
      code: "external_action_expired",
      diagnostic_id: "external_action_submit_expired",
      route: ROUTE,
    });
  }
  if (link.status === "submitted") {
    return jsonProblem(409, {
      error: "External action already submitted",
      code: "external_action_already_submitted",
      diagnostic_id: "external_action_already_submitted",
      route: ROUTE,
    });
  }

  const bodyForValidation = { ...rawPayload };
  delete bodyForValidation.passcode;
  delete bodyForValidation.submitTicket;

  const at = String(link.action_type);
  if (!isValidExternalActionType(at)) {
    return jsonProblem(400, {
      error: "Invalid action type on link",
      code: "invalid_external_action_type",
      diagnostic_id: "external_action_submit_type_invalid",
      route: ROUTE,
    });
  }
  const validated = validateExternalActionPayload(at as ExternalActionType, bodyForValidation);
  if (!validated.ok) {
    if (isFeatureEnabled("v6AssuranceCore")) {
      const prevScope = (link.scope_json as Record<string, unknown> | null) ?? {};
      const { error: correctionError } = await admin
        .from("external_action_links")
        .update({
          scope_json: {
            ...prevScope,
            correction_message: validated.error,
            correction_at: nowIso(),
            workflow_version: 2,
          },
        })
        .eq("id", link.id)
        .eq("organization_id", link.organization_id);
      if (correctionError) {
        return routeFailure({
          status: 400,
          error: validated.error,
          code: "validation_failed",
          diagnosticId: "external_action_submit_correction_state_failed",
          phase: "persist",
        });
      }
    }
    return jsonProblem(400, {
      error: validated.error,
      code: "validation_failed",
      diagnostic_id: "external_action_submit_validation_failed",
      route: ROUTE,
    });
  }
  const storePayload = validated.normalized;

  const submittedAt = nowIso();
  const { data, error } = await admin
    .from("external_action_links")
    .update({
      status: "submitted",
      submitted_payload_json: storePayload,
      submitted_at: submittedAt,
    })
    .eq("id", link.id)
    .eq("organization_id", link.organization_id)
    .neq("status", "submitted")
    .select("id, status, submitted_at")
    .maybeSingle();
  if (error) {
    console.error("[api/external-actions/submit] update error:", error.message);
    return routeFailure({
      status: 500,
      error: "Failed to persist external action submission",
      code: "persistence_failed",
      diagnosticId: "external_action_submit_persist_failed",
      phase: "persist",
    });
  }
  if (!data) {
    return jsonProblem(409, {
      error: "External action already submitted",
      code: "external_action_already_submitted",
      diagnostic_id: "external_action_already_submitted",
      route: ROUTE,
    });
  }

  const errors: Array<Record<string, unknown>> = [];

  const { error: eventError } = await admin.from("external_action_events").insert({
    organization_id: link.organization_id,
    external_action_link_id: link.id,
    event_type: "external.submitted",
    payload_json: {
      submitted_keys: Object.keys(storePayload),
      workflow_chain_length: Array.isArray((link.scope_json as Record<string, unknown> | null)?.workflow_chain)
        ? ((link.scope_json as Record<string, unknown>).workflow_chain as unknown[]).length
        : 0,
    },
  });
  if (eventError) {
    errors.push({
      diagnostic_id: "external_action_submit_event_insert_failed",
      phase: "persist",
      message: "Failed to persist external action submission event",
    });
  }

  const workflowResult = await appendExternalWorkflowStep(
    admin,
    link.organization_id,
    String(link.id),
    "submission_received",
    {
      submitted_at: submittedAt,
      submitted_keys: Object.keys(storePayload),
    }
  );
  if (workflowResult.error?.message === "external_action_event_insert_failed") {
    errors.push({
      diagnostic_id: "external_action_submit_workflow_event_insert_failed",
      phase: "persist",
      message: "Failed to persist submission workflow event",
    });
  } else if (workflowResult.error) {
    errors.push({
      diagnostic_id: "external_action_submit_workflow_step_failed",
      phase: "persist",
      message: "Failed to persist submission workflow step",
    });
  }

  const scope = link.scope_json as Record<string, unknown> | null;
  const reqRaw = scope?.evidenceRequirementId;
  const requirementId = typeof reqRaw === "string" && UUID_RE.test(reqRaw) ? reqRaw : null;
  const wantsEvidence =
    /evidence/i.test(String(link.action_type)) || requirementId !== null;
  if (requirementId && wantsEvidence) {
    const { data: reqRow, error: reqRowError } = await admin
      .from("evidence_requirements")
      .select("id")
      .eq("organization_id", link.organization_id)
      .eq("id", requirementId)
      .maybeSingle();
    if (reqRowError) {
      errors.push({
        diagnostic_id: "external_action_submit_requirement_load_failed",
        phase: "source_query",
        message: "Failed to load evidence requirement for external submission",
      });
    }
    if (reqRow) {
      const { error: evidenceInsertError } = await admin.from("evidence_submissions").insert({
        organization_id: link.organization_id,
        requirement_id: requirementId,
        submitted_by: null,
        payload_json: storePayload,
        external_action_link_id: link.id,
      });
      if (evidenceInsertError) {
        errors.push({
          diagnostic_id: "external_action_submit_evidence_persist_failed",
          phase: "persist",
          message: "Failed to persist external evidence submission",
        });
      }
    }
  }

  if (isFeatureEnabled("v5RelationshipLayer") && link.decision_workspace_id) {
    const { data: dec } = await admin
      .from("decision_workspaces")
      .select("linked_account_key, linked_counterparty_key, title")
      .eq("organization_id", link.organization_id)
      .eq("id", link.decision_workspace_id)
      .maybeSingle();
    if (dec) {
      const p = {
        external_action_link_id: link.id,
        action_type: link.action_type,
        decision_workspace_id: link.decision_workspace_id,
        title: dec.title,
      };
      if (dec.linked_account_key) {
        await appendAccountTimelineEvent(
          admin,
          link.organization_id,
          dec.linked_account_key,
          "relationship.external_submitted",
          p
        ).catch(() => {
          errors.push({
            diagnostic_id: "external_action_submit_account_timeline_failed",
            phase: "notify",
            message: "Failed to append account relationship timeline event",
          });
        });
      }
      if (dec.linked_counterparty_key) {
        await appendCounterpartyTimelineEvent(
          admin,
          link.organization_id,
          dec.linked_counterparty_key,
          "relationship.external_submitted",
          p
        ).catch(() => {
          errors.push({
            diagnostic_id: "external_action_submit_counterparty_timeline_failed",
            phase: "notify",
            message: "Failed to append counterparty relationship timeline event",
          });
        });
      }
    }
  }

  if (isFeatureEnabled("v6AssuranceCore")) {
    await incrementAssuranceQualityCounter(
      admin,
      String(link.organization_id),
      "external_collaboration_submissions_total",
      1
    ).catch(() => undefined);
    await runIncrementalAssuranceChecks(admin, String(link.organization_id), null).catch(() => undefined);
  }

  return NextResponse.json(
    {
      ...(errors.length > 0 ? { ok: false, partial: true, errors_count: errors.length, errors } : {}),
      submission: data,
    },
    { status: errors.length > 0 ? 207 : 200, headers: PRIVATE_NO_STORE_HEADERS }
  );
}
