import { jsonOk, jsonProblem, jsonRateLimited, jsonUnauthorized } from "@/lib/http/problem";
import { readJsonBodyLimited, readTextBodyLimited } from "@/lib/security/read-json-body-limited";
import { createAdminClient } from "@/lib/supabase/server";
import { inboundOrgNotAllowedResponse } from "@/lib/security/inbound-org-allowlist";
import { RATE_LIMITS, getClientIpFromRequest, rateLimitCheck } from "@/lib/rate-limit";
import { isInboundAutomationAuthorized } from "@/lib/security/inbound-automation-token";
import { isIsoDateOnly, isUuid } from "@/lib/security/validation";
import {
  EMAIL_TASK_BODY_MAX,
  EMAIL_TASK_EXTERNAL_MESSAGE_ID_RE,
  EMAIL_TASK_FROM_MAX,
  EMAIL_TASK_SUBJECT_MAX,
} from "@/lib/email/email-inbound-limits";
import { isKillInboundAutomation, killSwitchJsonResponse } from "@/lib/security/kill-switches";
import { verifyInboundEmailHmac } from "@/lib/security/inbound-email-signing";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";

const ROUTE = "/api/tasks/from-email";
const EMAIL_INBOUND_SIGNED_BODY_MAX = 262_144;

function validationError(error: string, diagnosticId: string, status = 400) {
  return jsonProblem(status, {
    error,
    code: "validation_failed",
    diagnostic_id: diagnosticId,
    route: ROUTE,
  });
}

function persistenceError(error: string, diagnosticId: string) {
  return jsonProblem(400, {
    error,
    code: "persistence_failed",
    diagnostic_id: diagnosticId,
    route: ROUTE,
  });
}

type EmailTaskPayload = {
  organizationId: string;
  contractId: string;
  intakeType?: "task" | "exception" | "evidence_submission";
  evidenceRequirementId?: string;
  externalMessageId?: string;
  subject: string;
  body?: string;
  from?: string;
  dueDate?: string;
};

function isAuthorized(request: Request): boolean {
  return isInboundAutomationAuthorized(request, "email");
}

export async function POST(request: Request) {
  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`tasks-email:${ip}`, RATE_LIMITS.tasksFromEmailInbound);
  if (!rl.ok) {
    return jsonRateLimited(rl.retryAfterMs, ROUTE);
  }
  if (!isAuthorized(request)) {
    return jsonUnauthorized(ROUTE);
  }
  if (isKillInboundAutomation()) {
    return killSwitchJsonResponse("inbound_automation");
  }

  const hmacSecret = process.env.EMAIL_INBOUND_HMAC_SECRET?.trim();
  let payload: EmailTaskPayload | null = null;
  if (hmacSecret) {
    const _lb_raw = await readTextBodyLimited(request, EMAIL_INBOUND_SIGNED_BODY_MAX);
    if (!_lb_raw.ok) return validationError("Body too large", "email_inbound_body_too_large", 413);
    const raw = _lb_raw.body;
    const mac = verifyInboundEmailHmac({
      secret: hmacSecret,
      rawBody: raw,
      signatureHeader: request.headers.get("x-oblixa-email-signature"),
      timestampHeader: request.headers.get("x-oblixa-email-timestamp"),
    });
    if (!mac.ok) {
      return jsonProblem(401, {
        error: "Invalid email inbound signature",
        code: "invalid_signature",
        diagnostic_id: "email_inbound_signature_invalid",
        route: ROUTE,
      });
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      payload = parsed && typeof parsed === "object" ? (parsed as EmailTaskPayload) : null;
    } catch {
      return validationError("Invalid JSON", "email_inbound_invalid_json");
    }
  } else {
    const _lb_payload = await readJsonBodyLimited(request);
    if (!_lb_payload.ok) return _lb_payload.response;
    payload = (_lb_payload.body ?? null) as EmailTaskPayload | null;
  }
  if (!payload || typeof payload !== "object") {
    return validationError("Invalid JSON body", "email_inbound_invalid_json_body");
  }
  if (!payload.organizationId || !payload.contractId || !payload.subject?.trim()) {
    return validationError(
      "organizationId, contractId, and subject are required.",
      "email_inbound_required_fields_missing"
    );
  }
  if (!isUuid(payload.organizationId) || !isUuid(payload.contractId)) {
    return validationError(
      "organizationId and contractId must be valid UUIDs",
      "email_inbound_ids_invalid"
    );
  }
  const orgRate = await rateLimitCheck(
    `tasks-email:org:${payload.organizationId}`,
    RATE_LIMITS.tasksFromEmailInbound
  );
  if (!orgRate.ok) {
    return jsonRateLimited(orgRate.retryAfterMs, ROUTE);
  }
  const orgBlocked = inboundOrgNotAllowedResponse(payload.organizationId);
  if (orgBlocked) return orgBlocked;
  if (payload.subject.trim().length > EMAIL_TASK_SUBJECT_MAX) {
    return validationError(
      `subject must be ${EMAIL_TASK_SUBJECT_MAX} characters or fewer`,
      "email_inbound_subject_too_long"
    );
  }
  if (payload.body && payload.body.length > EMAIL_TASK_BODY_MAX) {
    return validationError(
      `body must be ${EMAIL_TASK_BODY_MAX} characters or fewer`,
      "email_inbound_body_too_long"
    );
  }
  if (payload.from && payload.from.length > EMAIL_TASK_FROM_MAX) {
    return validationError(
      `from must be ${EMAIL_TASK_FROM_MAX} characters or fewer`,
      "email_inbound_from_too_long"
    );
  }
  if (payload.dueDate && !isIsoDateOnly(payload.dueDate)) {
    return validationError("dueDate must be ISO date (YYYY-MM-DD)", "email_inbound_due_date_invalid");
  }
  if (payload.externalMessageId && !EMAIL_TASK_EXTERNAL_MESSAGE_ID_RE.test(payload.externalMessageId.trim())) {
    return validationError(
      "externalMessageId contains invalid characters or is too long",
      "email_inbound_external_message_id_invalid"
    );
  }

  const headerIntake = request.headers.get("x-oblixa-intake")?.trim().toLowerCase();
  let intakeType: EmailTaskPayload["intakeType"] = payload.intakeType ?? "task";
  if (headerIntake === "exception") intakeType = "exception";
  if (headerIntake === "evidence" || headerIntake === "evidence_submission") {
    intakeType = "evidence_submission";
  }
  if (headerIntake === "task") intakeType = "task";
  const title =
    intakeType === "exception"
      ? `Email exception: ${payload.subject.trim()}`
      : `Email follow-up: ${payload.subject.trim()}`;
  const details = [
    payload.body?.trim(),
    payload.from ? `From: ${payload.from}` : null,
    payload.externalMessageId?.trim() ? `external_message_id:${payload.externalMessageId.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const admin = await createAdminClient();
  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id")
    .eq("id", payload.contractId)
    .eq("organization_id", payload.organizationId)
    .maybeSingle();
  if (!contract) {
    return validationError("Contract not found in organization", "email_inbound_contract_not_found");
  }
  void recordApiMutationAuditEvent(admin, {
    organizationId: payload.organizationId,
    actorUserId: null,
    actorType: "system",
    route: "/api/tasks/from-email",
    method: "POST",
  }).catch(() => undefined);
  if (payload.externalMessageId?.trim()) {
    const replayRate = await rateLimitCheck(
      `tasks-email:event:${payload.organizationId}:${payload.externalMessageId.trim()}`,
      RATE_LIMITS.tasksFromEmailInbound
    );
    if (!replayRate.ok) {
      return jsonRateLimited(replayRate.retryAfterMs, ROUTE);
    }
    const existing = await admin
      .from("contract_tasks")
      .select("id")
      .eq("contract_id", payload.contractId)
      .eq("created_via", "integration")
      .eq("team_key", "email")
      .ilike("details", `%external_message_id:${payload.externalMessageId.trim().replace(/[_%]/g, "\\$&")}%`)
      .limit(1)
      .maybeSingle();
    if (existing.data) {
      return jsonOk({ success: true, deduped: true, taskId: existing.data.id });
    }
  }
  if (intakeType === "exception") {
    const { data: exception, error } = await admin
      .from("exceptions")
      .insert({
        organization_id: payload.organizationId,
        contract_id: payload.contractId,
        title,
        details: details || null,
        exception_type: "inbound_email",
        severity: "medium",
        status: "open",
      })
      .select("id")
      .single();
    if (error) return persistenceError(error.message, "email_inbound_exception_create_failed");
    return jsonOk({ success: true, exceptionId: exception.id });
  }

  if (intakeType === "evidence_submission") {
    const requirementId = String(payload.evidenceRequirementId ?? "").trim();
    if (!requirementId) {
      return validationError(
        "evidenceRequirementId is required for evidence_submission",
        "email_inbound_evidence_requirement_id_required"
      );
    }
    const { data: submission, error } = await admin
      .from("evidence_submissions")
      .insert({
        organization_id: payload.organizationId,
        requirement_id: requirementId,
        submitted_by: null,
        status: "submitted",
        payload_json: {
          source: "email",
          subject: payload.subject.trim(),
          body: payload.body?.trim() || null,
          from: payload.from?.trim() || null,
          external_message_id: payload.externalMessageId?.trim() || null,
        },
      })
      .select("id")
      .single();
    if (error) return persistenceError(error.message, "email_inbound_evidence_submission_create_failed");
    await admin
      .from("evidence_requirements")
      .update({ status: "submitted" })
      .eq("organization_id", payload.organizationId)
      .eq("id", requirementId);
    return jsonOk({ success: true, submissionId: submission.id });
  }

  const { data: task, error } = await admin
    .from("contract_tasks")
    .insert({
      organization_id: payload.organizationId,
      contract_id: payload.contractId,
      title,
      details: details || null,
      due_date: payload.dueDate?.trim() || null,
      priority: "medium",
      status: "open",
      created_via: "integration",
      team_key: "email",
    })
    .select("id")
    .single();

  if (error) return persistenceError(error.message, "email_inbound_task_create_failed");
  await admin.from("contract_task_events").insert({
    organization_id: payload.organizationId,
    contract_id: payload.contractId,
    task_id: task.id,
    actor_id: null,
    event_type: "created",
    details: { created_via: "integration", source: "email", external_message_id: payload.externalMessageId ?? null },
  });
  return jsonOk({ success: true, taskId: task.id });
}
